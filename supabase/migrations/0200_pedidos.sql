-- Cupons, clientes, pedidos e as funções de dinheiro/estoque (base: 090 Tokstec).
-- Tudo que mexe em estoque e dinheiro roda aqui dentro, numa transação só, e só o servidor
-- (service_role) pode chamar. Duas pessoas comprando a última unidade: só uma leva.
-- Ciclo: criar_pedido separa o estoque -> Stripe avisa que pagou -> confirmar_pagamento.
-- Sem pagamento até reserva_expira_em, liberar_reservas_vencidas devolve (pg_cron a cada minuto).

create table public.cupons (
  codigo text primary key check (codigo = upper(codigo) and codigo ~ '^[A-Z0-9_-]{3,30}$'),
  descricao text,
  tipo text not null check (tipo in ('percentual', 'valor')),
  valor int not null check (valor > 0),          -- percentual: 10 = 10%; valor: centavos
  minimo_centavos int not null default 0 check (minimo_centavos >= 0),
  valido_de timestamptz,
  valido_ate timestamptz,
  limite_usos int check (limite_usos is null or limite_usos > 0),
  usos int not null default 0,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  check (tipo <> 'percentual' or valor <= 100)
);

create table public.clientes (
  id uuid primary key default gen_random_uuid(),
  email text not null unique check (email = lower(email)),
  nome text not null,
  cpf text,
  telefone text,
  quer_novidades boolean not null default false,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table public.pedidos (
  id uuid primary key default gen_random_uuid(),
  numero bigint generated always as identity (start with 10001) unique,
  cliente_id uuid not null references public.clientes (id),
  status text not null default 'aguardando_pagamento' check (status in (
    'aguardando_pagamento', 'pago', 'separando', 'enviado', 'entregue',
    'cancelado', 'expirado', 'estornado')),
  metodo text not null check (metodo in ('pix', 'cartao')),
  parcelas int not null default 1 check (parcelas between 1 and 12),
  subtotal_centavos int not null default 0,
  desconto_pix_centavos int not null default 0,
  desconto_cupom_centavos int not null default 0,
  frete_centavos int not null default 0,
  total_centavos int not null default 0 check (total_centavos >= 0),
  cupom_codigo text references public.cupons (codigo),
  endereco jsonb not null,                        -- cep, rua, numero, comp, bairro, cidade, uf
  frete jsonb,                                    -- regiao, prazo_dias, gratis
  stripe_pi text unique,                          -- PaymentIntent
  reserva_expira_em timestamptz,
  rastreio text,
  observacao text,
  exemplo boolean not null default false,         -- pedido fictício (npm run exemplo)
  criado_em timestamptz not null default now(),
  pago_em timestamptz,
  separado_em timestamptz,
  enviado_em timestamptz,
  entregue_em timestamptz,
  cancelado_em timestamptz,
  atualizado_em timestamptz not null default now()
);
create index on public.pedidos (cliente_id);
create index on public.pedidos (status, reserva_expira_em);
create index on public.pedidos (criado_em desc);
create index on public.pedidos (pago_em desc);
create trigger pedidos_atualizado before update on public.pedidos for each row execute function public.tocar_atualizado_em();
create trigger clientes_atualizado before update on public.clientes for each row execute function public.tocar_atualizado_em();

create table public.pedido_itens (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null references public.pedidos (id) on delete cascade,
  variante_id uuid references public.variantes (id) on delete set null,
  produto_id uuid references public.produtos (id) on delete set null,
  produto_nome text not null,                     -- cópia: o pedido não muda se o produto mudar
  variante_nome text not null,
  foto text,
  quantidade int not null check (quantidade > 0),
  preco_unit_centavos int not null
);
create index on public.pedido_itens (pedido_id);
create index on public.pedido_itens (produto_id);

-- aviso da Stripe gravado cru antes de processar (repetido não processa 2x)
create table public.eventos (
  id uuid primary key default gen_random_uuid(),
  origem text not null check (origem in ('stripe')),
  evento_id text,
  tipo text,
  payload jsonb not null,
  processado_em timestamptz,
  erro text,
  recebido_em timestamptz not null default now(),
  unique (origem, evento_id)
);

create table public.inscritos (
  id uuid primary key default gen_random_uuid(),
  email text not null unique check (email = lower(email)),
  origem text not null default 'rodape',
  criado_em timestamptz not null default now()
);

-- quem entra no painel: usuário do Supabase Auth + papel
create table public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  email text not null unique check (email = lower(email)),
  nome text not null,
  papel text not null default 'admin' check (papel in ('admin', 'operador')),
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);

-- ---------------------------------------------------------------- frete
create function public.regiao_uf(p_uf text) returns text language sql immutable as $$
  select case upper(p_uf)
    when 'SP' then 'SE' when 'RJ' then 'SE' when 'MG' then 'SE' when 'ES' then 'SE'
    when 'PR' then 'S' when 'SC' then 'S' when 'RS' then 'S'
    when 'DF' then 'CO' when 'GO' then 'CO' when 'MT' then 'CO' when 'MS' then 'CO'
    when 'BA' then 'NE' when 'SE' then 'NE' when 'AL' then 'NE' when 'PE' then 'NE' when 'PB' then 'NE'
    when 'RN' then 'NE' when 'CE' then 'NE' when 'PI' then 'NE' when 'MA' then 'NE'
    when 'PA' then 'N' when 'AM' then 'N' when 'AP' then 'N' when 'RR' then 'N' when 'RO' then 'N'
    when 'AC' then 'N' when 'TO' then 'N'
  end $$;

-- frete pela tabela do painel: {centavos, prazo_dias, regiao, gratis}
create function public.cotar_frete(p_uf text, p_subtotal int) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  cfg jsonb := (select valor from config where chave = 'frete');
  reg text := regiao_uf(p_uf);
  linha jsonb;
  gratis boolean;
begin
  if reg is null then raise exception 'UF_INVALIDA'; end if;
  linha := cfg -> 'regioes' -> reg;
  gratis := (cfg ->> 'gratis_acima_centavos') is not null and p_subtotal >= (cfg ->> 'gratis_acima_centavos')::int;
  return jsonb_build_object('regiao', reg, 'prazo_dias', (linha ->> 'prazo_dias')::int, 'gratis', gratis,
    'centavos', case when gratis then 0 else (linha ->> 'centavos')::int end);
end $$;

-- ---------------------------------------------------------------- contas do pedido
-- itens [{variante_id, quantidade}] -> linhas resolvidas com o preço do banco (soma repetidas)
create function public._linhas(p_itens jsonb)
returns table (variante_id uuid, produto_id uuid, produto_nome text, variante_nome text, foto text,
               estoque int, preco int, qtd int)
language sql stable security definer set search_path = public as $$
  select va.id, pr.id, pr.nome, va.nome, pr.fotos[1], va.estoque,
         coalesce(va.preco_centavos, pr.preco_centavos), sum(x.quantidade)::int
  from jsonb_to_recordset(p_itens) as x(variante_id uuid, quantidade int)
  left join variantes va on va.id = x.variante_id and va.ativo
  left join produtos pr on pr.id = va.produto_id and pr.ativo
  group by va.id, pr.id, pr.nome, va.nome, pr.fotos[1], va.estoque, va.preco_centavos, pr.preco_centavos
  order by va.id
$$;

-- desconto do cupom (levanta erro se não vale); não mexe em usos
create function public._desconto_cupom(p_codigo text, p_sub int) returns int
language plpgsql stable security definer set search_path = public as $$
declare c cupons%rowtype;
begin
  select * into c from cupons where codigo = p_codigo;
  if not found or not c.ativo
     or (c.valido_de is not null and now() < c.valido_de)
     or (c.valido_ate is not null and now() > c.valido_ate)
     or (c.limite_usos is not null and c.usos >= c.limite_usos) then
    raise exception 'CUPOM_INVALIDO';
  end if;
  if p_sub < c.minimo_centavos then raise exception 'CUPOM_MINIMO' using detail = c.minimo_centavos::text; end if;
  return case when c.tipo = 'percentual' then round(p_sub * c.valor / 100.0)::int else least(c.valor, p_sub) end;
end $$;

-- orçamento sem separar estoque (sacola e checkout mostram os valores certos)
-- p: {itens: [{variante_id, quantidade}], cupom, metodo, uf}
create function public.orcar_pedido(p jsonb) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  l record;
  v_sub int := 0;
  v_desc_cupom int := 0;
  v_desc_pix int := 0;
  v_frete jsonb := null;
  v_codigo text := nullif(upper(trim(coalesce(p ->> 'cupom', ''))), '');
  v_pag jsonb := (select valor from config where chave = 'pagamento');
  v_itens jsonb := '[]';
begin
  for l in select * from _linhas(coalesce(p -> 'itens', '[]')) loop
    if l.variante_id is null or l.produto_id is null then raise exception 'PRODUTO_INEXISTENTE'; end if;
    v_sub := v_sub + l.qtd * l.preco;
    v_itens := v_itens || jsonb_build_object('variante_id', l.variante_id, 'quantidade', l.qtd,
      'preco_unit_centavos', l.preco, 'disponivel', l.estoque >= l.qtd, 'estoque', l.estoque);
  end loop;
  if v_codigo is not null then v_desc_cupom := _desconto_cupom(v_codigo, v_sub); end if;
  if p ->> 'metodo' = 'pix' then
    v_desc_pix := round((v_sub - v_desc_cupom) * (v_pag ->> 'pix_desconto_pct')::int / 100.0)::int;
  end if;
  if nullif(p ->> 'uf', '') is not null then v_frete := cotar_frete(p ->> 'uf', v_sub); end if;
  return jsonb_build_object('itens', v_itens, 'subtotal_centavos', v_sub, 'desconto_cupom_centavos', v_desc_cupom,
    'desconto_pix_centavos', v_desc_pix, 'frete', v_frete,
    'total_centavos', v_sub - v_desc_cupom - v_desc_pix + coalesce((v_frete ->> 'centavos')::int, 0));
end $$;

create function public.liberar_reservas_vencidas() returns int
language plpgsql security definer set search_path = public as $$
declare
  n int := 0;
  ped record;
begin
  for ped in
    select id, cupom_codigo from pedidos
    where status = 'aguardando_pagamento' and reserva_expira_em < now()
    for update skip locked
  loop
    update variantes v set estoque = v.estoque + i.quantidade
      from pedido_itens i where i.pedido_id = ped.id and i.variante_id = v.id;
    if ped.cupom_codigo is not null then
      update cupons set usos = greatest(0, usos - 1) where codigo = ped.cupom_codigo;
    end if;
    update pedidos set status = 'expirado', reserva_expira_em = null where id = ped.id;
    n := n + 1;
  end loop;
  return n;
end $$;

-- p: {cliente: {email, nome, cpf, telefone, quer_novidades},
--     endereco: {cep, rua, numero, comp, bairro, cidade, uf},
--     itens: [{variante_id, quantidade}], metodo: 'pix'|'cartao', parcelas, cupom}
create function public.criar_pedido(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_cliente uuid;
  v_pedido uuid;
  v_numero bigint;
  l record;
  v_sub int := 0;
  v_desc_cupom int := 0;
  v_desc_pix int := 0;
  v_frete jsonb;
  v_metodo text := p ->> 'metodo';
  v_parcelas int := coalesce((p ->> 'parcelas')::int, 1);
  v_pag jsonb := (select valor from config where chave = 'pagamento');
  v_total int;
  v_email text := lower(trim(p -> 'cliente' ->> 'email'));
  v_codigo text := nullif(upper(trim(coalesce(p ->> 'cupom', ''))), '');
  v_uf text := upper(p -> 'endereco' ->> 'uf');
begin
  perform liberar_reservas_vencidas();

  if v_email is null or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'EMAIL_INVALIDO'; end if;
  if coalesce(trim(p -> 'cliente' ->> 'nome'), '') = '' then raise exception 'NOME_INVALIDO'; end if;
  if v_metodo is null or v_metodo not in ('pix', 'cartao') then raise exception 'METODO_INVALIDO'; end if;
  if v_metodo = 'pix' then v_parcelas := 1; end if;
  if v_parcelas not between 1 and (v_pag ->> 'parcelas_sem_juros')::int then raise exception 'PARCELAS_INVALIDAS'; end if;
  if jsonb_array_length(coalesce(p -> 'itens', '[]')) = 0 then raise exception 'SACOLA_VAZIA'; end if;
  if regiao_uf(v_uf) is null then raise exception 'UF_INVALIDA'; end if;

  insert into clientes (email, nome, cpf, telefone, quer_novidades)
  values (v_email, trim(p -> 'cliente' ->> 'nome'), p -> 'cliente' ->> 'cpf', p -> 'cliente' ->> 'telefone',
          coalesce((p -> 'cliente' ->> 'quer_novidades')::boolean, false))
  on conflict (email) do update set nome = excluded.nome, cpf = coalesce(excluded.cpf, clientes.cpf),
    telefone = coalesce(excluded.telefone, clientes.telefone),
    quer_novidades = clientes.quer_novidades or excluded.quer_novidades
  returning id into v_cliente;

  insert into pedidos (cliente_id, metodo, parcelas, endereco, reserva_expira_em)
  values (v_cliente, v_metodo, v_parcelas, p -> 'endereco',
          now() + case when v_metodo = 'pix' then interval '30 minutes' else interval '15 minutes' end)
  returning id, numero into v_pedido, v_numero;

  -- linhas na ordem do id da variante: duas compras ao mesmo tempo travam na mesma ordem
  for l in select * from _linhas(p -> 'itens') loop
    if l.variante_id is null or l.produto_id is null then raise exception 'PRODUTO_INEXISTENTE'; end if;
    if l.qtd is null or l.qtd < 1 or l.qtd > 20 then raise exception 'QUANTIDADE_INVALIDA'; end if;
    update variantes set estoque = estoque - l.qtd where id = l.variante_id and estoque >= l.qtd;
    if not found then raise exception 'ESGOTADO' using detail = l.variante_id::text; end if;
    insert into pedido_itens (pedido_id, variante_id, produto_id, produto_nome, variante_nome, foto, quantidade, preco_unit_centavos)
    values (v_pedido, l.variante_id, l.produto_id, l.produto_nome, l.variante_nome, l.foto, l.qtd, l.preco);
    v_sub := v_sub + l.qtd * l.preco;
  end loop;

  if v_codigo is not null then
    perform 1 from cupons where codigo = v_codigo for update;
    v_desc_cupom := _desconto_cupom(v_codigo, v_sub);
    update cupons set usos = usos + 1 where codigo = v_codigo;
  end if;
  if v_metodo = 'pix' then
    v_desc_pix := round((v_sub - v_desc_cupom) * (v_pag ->> 'pix_desconto_pct')::int / 100.0)::int;
  end if;
  v_frete := cotar_frete(v_uf, v_sub);
  v_total := v_sub - v_desc_cupom - v_desc_pix + (v_frete ->> 'centavos')::int;

  update pedidos set subtotal_centavos = v_sub, desconto_cupom_centavos = v_desc_cupom,
    desconto_pix_centavos = v_desc_pix, frete_centavos = (v_frete ->> 'centavos')::int,
    frete = v_frete - 'centavos', total_centavos = v_total, cupom_codigo = v_codigo
  where id = v_pedido;

  return jsonb_build_object('id', v_pedido, 'numero', v_numero, 'subtotal_centavos', v_sub,
    'desconto_cupom_centavos', v_desc_cupom, 'desconto_pix_centavos', v_desc_pix,
    'frete_centavos', (v_frete ->> 'centavos')::int, 'total_centavos', v_total,
    'metodo', v_metodo, 'parcelas', v_parcelas);
end $$;

-- a Stripe avisou que pagou. Pago depois da reserva vencer: separa de novo; sem estoque, erro
-- (o servidor estorna e marca o pedido).
create function public.confirmar_pagamento(p_pedido uuid, p_ref text default null) returns text
language plpgsql security definer set search_path = public as $$
declare
  ped pedidos%rowtype;
  it record;
begin
  select * into ped from pedidos where id = p_pedido for update;
  if not found then raise exception 'PEDIDO_INEXISTENTE'; end if;
  if ped.status in ('pago', 'separando', 'enviado', 'entregue') then return ped.status; end if;

  if ped.status = 'expirado' then
    for it in select variante_id, quantidade from pedido_itens where pedido_id = p_pedido order by variante_id loop
      update variantes set estoque = estoque - it.quantidade where id = it.variante_id and estoque >= it.quantidade;
      if not found then raise exception 'SEM_ESTOQUE_PAGO_TARDE'; end if;
    end loop;
    if ped.cupom_codigo is not null then update cupons set usos = usos + 1 where codigo = ped.cupom_codigo; end if;
  elsif ped.status <> 'aguardando_pagamento' then
    raise exception 'STATUS_NAO_PAGAVEL' using detail = ped.status;
  end if;

  update pedidos set status = 'pago', pago_em = now(), reserva_expira_em = null,
    stripe_pi = coalesce(p_ref, stripe_pi)
  where id = p_pedido;
  return 'pago';
end $$;

-- cancelar (antes de enviar) ou estornar: devolve o estoque se ainda estava separado
create function public.cancelar_pedido(p_pedido uuid, p_status text default 'cancelado', p_motivo text default null)
returns text
language plpgsql security definer set search_path = public as $$
declare ped pedidos%rowtype;
begin
  if p_status not in ('cancelado', 'estornado') then raise exception 'STATUS_INVALIDO'; end if;
  select * into ped from pedidos where id = p_pedido for update;
  if not found then raise exception 'PEDIDO_INEXISTENTE'; end if;
  if ped.status in ('cancelado', 'estornado') then return ped.status; end if;
  if ped.status in ('enviado', 'entregue') and p_status = 'cancelado' then raise exception 'JA_ENVIADO'; end if;
  if ped.status in ('aguardando_pagamento', 'expirado') and p_status = 'estornado' then raise exception 'NAO_PAGO'; end if;

  if ped.status in ('aguardando_pagamento', 'pago', 'separando') then
    update variantes v set estoque = v.estoque + i.quantidade
      from pedido_itens i where i.pedido_id = p_pedido and i.variante_id = v.id;
    if ped.cupom_codigo is not null then
      update cupons set usos = greatest(0, usos - 1) where codigo = ped.cupom_codigo;
    end if;
  end if;
  update pedidos set status = p_status, reserva_expira_em = null, cancelado_em = now(),
    observacao = concat_ws(' · ', observacao, p_motivo)
  where id = p_pedido;
  return p_status;
end $$;

-- andamento depois de pago: pago -> separando -> enviado -> entregue (pode pular o separando)
create function public.mudar_status(p_pedido uuid, p_status text, p_rastreio text default null) returns text
language plpgsql security definer set search_path = public as $$
declare ped pedidos%rowtype;
begin
  select * into ped from pedidos where id = p_pedido for update;
  if not found then raise exception 'PEDIDO_INEXISTENTE'; end if;
  if ped.status = p_status then return p_status; end if;
  if not ((ped.status = 'pago' and p_status in ('separando', 'enviado'))
       or (ped.status = 'separando' and p_status = 'enviado')
       or (ped.status = 'enviado' and p_status = 'entregue')) then
    raise exception 'MUDANCA_INVALIDA' using detail = ped.status || '->' || p_status;
  end if;
  if p_status = 'enviado' and coalesce(trim(p_rastreio), '') = '' then raise exception 'RASTREIO_OBRIGATORIO'; end if;
  update pedidos set status = p_status,
    separado_em = case when p_status = 'separando' then now() else separado_em end,
    enviado_em = case when p_status = 'enviado' then now() else enviado_em end,
    entregue_em = case when p_status = 'entregue' then now() else entregue_em end,
    rastreio = case when p_status = 'enviado' then trim(p_rastreio) else rastreio end
  where id = p_pedido;
  return p_status;
end $$;
