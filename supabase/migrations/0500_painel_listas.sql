-- Listas do painel com busca, filtro e contagem numa ida só ao banco.

-- pedidos: p_status null = todos; busca por número, nome, e-mail ou CPF; período opcional (criado_em)
create function public.painel_pedidos(p_status text[], p_busca text, p_de timestamptz, p_ate timestamptz,
                                      p_limite int default 25, p_pular int default 0) returns jsonb
language sql stable security definer set search_path = public as $$
  with base as (
    select p.*, c.nome as cliente_nome, c.email as cliente_email
    from pedidos p join clientes c on c.id = p.cliente_id
    where (p_de is null or p.criado_em >= p_de) and (p_ate is null or p.criado_em < p_ate)
      and (coalesce(trim(p_busca), '') = ''
           or p.numero::text = trim(both '#' from trim(p_busca))
           or c.nome ilike '%' || trim(p_busca) || '%'
           or c.email ilike '%' || trim(p_busca) || '%'
           or regexp_replace(coalesce(c.cpf, ''), '\D', '', 'g') = nullif(regexp_replace(p_busca, '\D', '', 'g'), ''))
  ), filtrado as (
    select * from base where p_status is null or status = any (p_status)
  )
  select jsonb_build_object(
    'total', (select count(*) from filtrado),
    'contagem', (select coalesce(jsonb_object_agg(status, n), '{}') from (select status, count(*) n from base group by status) s),
    'linhas', coalesce((select jsonb_agg(l) from (
      select jsonb_build_object('numero', numero, 'status', status, 'metodo', metodo, 'parcelas', parcelas,
        'total_centavos', total_centavos, 'criado_em', criado_em, 'cliente_nome', cliente_nome, 'cliente_email', cliente_email,
        'cidade', endereco ->> 'cidade', 'uf', endereco ->> 'uf', 'exemplo', exemplo,
        'itens', (select coalesce(sum(quantidade), 0) from pedido_itens i where i.pedido_id = filtrado.id),
        'foto', (select i.foto from pedido_itens i where i.pedido_id = filtrado.id limit 1)) as l
      from filtrado order by criado_em desc limit p_limite offset p_pular) x), '[]'));
$$;

-- clientes com quanto gastaram (só pedidos pagos contam)
create function public.painel_clientes(p_busca text, p_limite int default 30, p_pular int default 0) returns jsonb
language sql stable security definer set search_path = public as $$
  with base as (
    select c.*,
      (select count(*) from pedidos p where p.cliente_id = c.id and p.status in ('pago','separando','enviado','entregue')) as pedidos,
      (select coalesce(sum(total_centavos), 0) from pedidos p where p.cliente_id = c.id and p.status in ('pago','separando','enviado','entregue')) as gasto,
      (select max(criado_em) from pedidos p where p.cliente_id = c.id) as ultimo
    from clientes c
    where coalesce(trim(p_busca), '') = '' or c.nome ilike '%' || trim(p_busca) || '%' or c.email ilike '%' || trim(p_busca) || '%'
  )
  select jsonb_build_object('total', (select count(*) from base),
    'linhas', coalesce((select jsonb_agg(to_jsonb(b) - 'atualizado_em') from (select * from base order by gasto desc, ultimo desc nulls last limit p_limite offset p_pular) b), '[]'));
$$;

-- produtos do painel: estoque somado e vendas dos últimos 30 dias
create function public.painel_produtos(p_busca text, p_categoria text, p_filtro text, p_limite int default 60, p_pular int default 0) returns jsonb
language sql stable security definer set search_path = public as $$
  with base as (
    select pr.id, pr.slug, pr.nome, pr.marca, pr.fotos[1] as foto, pr.preco_centavos, pr.preco_de_centavos, pr.ativo,
      pr.mais_vendido, pr.oferta, pr.destaque, c.nome as categoria, c.slug as categoria_slug, pr.atualizado_em,
      (select coalesce(sum(estoque), 0) from variantes v where v.produto_id = pr.id and v.ativo)::int as estoque,
      (select count(*) from variantes v where v.produto_id = pr.id)::int as variantes,
      (select coalesce(sum(i.quantidade), 0) from pedido_itens i join pedidos p on p.id = i.pedido_id
        where i.produto_id = pr.id and p.status in ('pago','separando','enviado','entregue') and p.pago_em > now() - interval '30 days')::int as vendidos_30d
    from produtos pr left join categorias c on c.id = pr.categoria_id
    where (coalesce(trim(p_busca), '') = '' or pr.nome ilike '%' || trim(p_busca) || '%' or pr.marca ilike '%' || trim(p_busca) || '%')
      and (coalesce(p_categoria, '') = '' or c.slug = p_categoria)
  ), filtrado as (
    select * from base where case coalesce(p_filtro, '')
      when 'ativos' then ativo when 'inativos' then not ativo
      when 'baixo' then estoque <= 3 when 'esgotados' then estoque = 0 else true end
  )
  select jsonb_build_object('total', (select count(*) from filtrado),
    'linhas', coalesce((select jsonb_agg(to_jsonb(f)) from (select * from filtrado order by ativo desc, atualizado_em desc limit p_limite offset p_pular) f), '[]'));
$$;

revoke execute on function public.painel_pedidos(text[], text, timestamptz, timestamptz, int, int) from public, anon, authenticated;
revoke execute on function public.painel_clientes(text, int, int) from public, anon, authenticated;
revoke execute on function public.painel_produtos(text, text, text, int, int) from public, anon, authenticated;
grant execute on function public.painel_pedidos(text[], text, timestamptz, timestamptz, int, int) to service_role;
grant execute on function public.painel_clientes(text, int, int) to service_role;
grant execute on function public.painel_produtos(text, text, text, int, int) to service_role;
