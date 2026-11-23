-- Titânio Importes: catálogo (categorias, produtos, variações) e configuração da loja.
-- Dinheiro sempre em centavos (int). O preço que vale é o do banco: o site nunca manda preço.

create table public.categorias (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  nome text not null,
  imagem text,                                   -- URL pública da imagem do círculo
  pai_id uuid references public.categorias (id) on delete set null,
  ordem int not null default 0,
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);

create table public.produtos (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  nome text not null check (length(trim(nome)) > 0),
  marca text,
  descricao text not null default '',
  especificacoes jsonb not null default '[]',    -- [{nome, valor}]
  fotos text[] not null default '{}',            -- URLs públicas, a 1ª é a capa
  categoria_id uuid references public.categorias (id) on delete set null,
  preco_centavos int not null check (preco_centavos > 0),
  preco_de_centavos int check (preco_de_centavos is null or preco_de_centavos > preco_centavos),
  mais_vendido boolean not null default false,
  oferta boolean not null default false,
  destaque boolean not null default false,
  ativo boolean not null default true,
  ordem int not null default 0,
  -- pacote de uma unidade embalada (frete)
  peso_gramas int not null default 1000 check (peso_gramas > 0),
  altura_cm int not null default 10 check (altura_cm > 0),
  largura_cm int not null default 20 check (largura_cm > 0),
  comprimento_cm int not null default 30 check (comprimento_cm > 0),
  busca tsvector generated always as (
    to_tsvector('portuguese', coalesce(nome, '') || ' ' || coalesce(marca, '') || ' ' || coalesce(descricao, ''))
  ) stored,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index on public.produtos (categoria_id);
create index on public.produtos using gin (busca);

-- o que o cliente escolhe ("Preto / 128 GB"). Produto sem escolha tem uma variante "Único".
create table public.variantes (
  id uuid primary key default gen_random_uuid(),
  produto_id uuid not null references public.produtos (id) on delete cascade,
  nome text not null default 'Único',
  atributos jsonb not null default '{}',         -- {"Cor": "Preto", "Armazenamento": "128 GB"}
  sku text unique,
  estoque int not null default 0 check (estoque >= 0),
  preco_centavos int check (preco_centavos is null or preco_centavos > 0),   -- null = preço do produto
  ativo boolean not null default true,
  ordem int not null default 0,
  unique (produto_id, nome)
);
create index on public.variantes (produto_id);

-- ajustes da loja (o painel edita). publico = o site pode ler.
create table public.config (
  chave text primary key,
  valor jsonb not null,
  publico boolean not null default false,
  atualizado_em timestamptz not null default now()
);
insert into public.config (chave, valor, publico) values
  ('pagamento', '{"pix_desconto_pct": 5, "parcelas_sem_juros": 10, "parcela_minima_centavos": 2000}', true),
  ('frete', '{"gratis_acima_centavos": 29900, "regioes": {"SE": {"centavos": 1990, "prazo_dias": 5}, "S": {"centavos": 2490, "prazo_dias": 7}, "CO": {"centavos": 2990, "prazo_dias": 8}, "NE": {"centavos": 3490, "prazo_dias": 10}, "N": {"centavos": 3990, "prazo_dias": 12}}}', true),
  ('loja', '{"nome": "Titânio Importes", "razao_social": "Titânio Intermediações Internacional LTDA", "cnpj": "69.755.685/0001-82", "whatsapp": "5521988739397", "email": ""}', true);

create function public.tocar_atualizado_em() returns trigger language plpgsql as $$
begin new.atualizado_em := now(); return new; end $$;
create trigger produtos_atualizado before update on public.produtos for each row execute function public.tocar_atualizado_em();
create trigger config_atualizado before update on public.config for each row execute function public.tocar_atualizado_em();

-- vitrine: o que o site lê (security_invoker: respeita o RLS de quem lê)
create view public.vitrine with (security_invoker = on) as
select pr.id, pr.slug, pr.nome, pr.marca, pr.descricao, pr.especificacoes, pr.fotos,
       c.slug as categoria_slug, c.nome as categoria,
       pr.preco_centavos, pr.preco_de_centavos, pr.mais_vendido, pr.oferta, pr.destaque, pr.ordem,
       coalesce((select jsonb_agg(jsonb_build_object('id', v.id, 'nome', v.nome, 'atributos', v.atributos,
                   'estoque', v.estoque, 'preco_centavos', coalesce(v.preco_centavos, pr.preco_centavos)) order by v.ordem)
                 from public.variantes v where v.produto_id = pr.id and v.ativo), '[]') as variantes,
       coalesce((select sum(v.estoque) from public.variantes v where v.produto_id = pr.id and v.ativo), 0)::int as estoque_total
from public.produtos pr left join public.categorias c on c.id = pr.categoria_id
where pr.ativo;
