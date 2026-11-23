-- Números do painel. Venda conta pelo dia em que foi PAGA (pago_em), no fuso de São Paulo.
-- grao: 'hour' | 'day' | 'week' (o painel escolhe pelo tamanho do período).

create function public.painel_resumo(p_de timestamptz, p_ate timestamptz, p_grao text default 'day') returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  pagos constant text[] := array['pago', 'separando', 'enviado', 'entregue'];
  r jsonb;
begin
  if p_grao not in ('hour', 'day', 'week') then raise exception 'GRAO_INVALIDO'; end if;
  with vend as (
    select * from pedidos where pago_em >= p_de and pago_em < p_ate and status = any (pagos)
  ), est as (
    select * from pedidos where pago_em >= p_de and pago_em < p_ate and status = 'estornado'
  )
  select jsonb_build_object(
    'vendas_centavos', coalesce((select sum(total_centavos) from vend), 0),
    'pedidos', (select count(*) from vend),
    'ticket_centavos', coalesce((select round(avg(total_centavos)) from vend), 0),
    'itens', coalesce((select sum(i.quantidade) from pedido_itens i join vend on vend.id = i.pedido_id), 0),
    'estornos_centavos', coalesce((select sum(total_centavos) from est), 0),
    'serie', coalesce((
      select jsonb_agg(jsonb_build_object('t', t, 'centavos', centavos, 'pedidos', n) order by t)
      from (select date_trunc(p_grao, pago_em at time zone 'America/Sao_Paulo') as t,
                   sum(total_centavos) as centavos, count(*) as n
            from vend group by 1) s), '[]'),
    'mais_vendidos', coalesce((
      select jsonb_agg(m order by (m ->> 'quantidade')::int desc)
      from (select jsonb_build_object('produto_id', i.produto_id, 'nome', max(i.produto_nome), 'foto', max(i.foto),
                     'quantidade', sum(i.quantidade), 'centavos', sum(i.quantidade * i.preco_unit_centavos)) as m
            from pedido_itens i join vend on vend.id = i.pedido_id
            group by i.produto_id order by sum(i.quantidade) desc limit 6) x), '[]'),
    'a_enviar', (select count(*) from pedidos where status in ('pago', 'separando')),
    'aguardando', (select count(*) from pedidos where status = 'aguardando_pagamento'),
    'estoque_baixo', coalesce((
      select jsonb_agg(e) from (
        select jsonb_build_object('produto_id', p.id, 'nome', p.nome, 'variante', v.nome, 'estoque', v.estoque,
                                  'foto', p.fotos[1]) as e
        from variantes v join produtos p on p.id = v.produto_id
        where v.ativo and p.ativo and v.estoque <= 3
        order by v.estoque, p.nome limit 8) y), '[]')
  ) into r;
  return r;
end $$;
revoke execute on function public.painel_resumo(timestamptz, timestamptz, text) from public, anon, authenticated;
grant execute on function public.painel_resumo(timestamptz, timestamptz, text) to service_role;
