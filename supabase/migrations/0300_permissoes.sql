-- Quem lê o quê. O site (anon) lê só o catálogo ativo e a config pública; todo o resto passa
-- pelo servidor com a service_role. Grants explícitos (projeto novo do Supabase pode vir sem
-- grant de tabela pra service_role: lição da 083 Canosa).

alter table public.categorias enable row level security;
alter table public.produtos enable row level security;
alter table public.variantes enable row level security;
alter table public.config enable row level security;
alter table public.cupons enable row level security;
alter table public.clientes enable row level security;
alter table public.pedidos enable row level security;
alter table public.pedido_itens enable row level security;
alter table public.eventos enable row level security;
alter table public.inscritos enable row level security;
alter table public.admins enable row level security;

revoke all on all tables in schema public from anon, authenticated;
revoke all on all functions in schema public from public, anon, authenticated;

grant select on public.categorias, public.produtos, public.variantes, public.config, public.vitrine to anon, authenticated;
create policy categorias_ativas on public.categorias for select to anon, authenticated using (ativo);
create policy produtos_ativos on public.produtos for select to anon, authenticated using (ativo);
create policy variantes_ativas on public.variantes for select to anon, authenticated
  using (ativo and exists (select 1 from public.produtos p where p.id = produto_id and p.ativo));
create policy config_publica on public.config for select to anon, authenticated using (publico);

-- o próprio admin lê a linha dele (o login confere o papel)
grant select on public.admins to authenticated;
create policy admin_le_a_si on public.admins for select to authenticated using (user_id = auth.uid());

grant usage on schema public to service_role;
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;
alter default privileges in schema public grant all on tables to service_role;
alter default privileges in schema public grant all on sequences to service_role;
alter default privileges in schema public grant execute on functions to service_role;
alter default privileges in schema public revoke execute on functions from public;

-- fotos dos produtos e das categorias: leitura pública, escrita só pelo servidor
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('produtos', 'produtos', true, 5242880, array['image/webp', 'image/png', 'image/jpeg'])
on conflict (id) do nothing;

-- devolve reservas vencidas a cada minuto
create extension if not exists pg_cron;
select cron.schedule('liberar-reservas', '* * * * *', 'select public.liberar_reservas_vencidas()');
