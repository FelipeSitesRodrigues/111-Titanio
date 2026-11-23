-- Testes das regras de pedido/estoque/cupom. Cada teste monta o próprio cenário, confere, e
-- termina com raise 'OK', que desfaz tudo o que ele gravou (subtransação). Nada fica no banco.
-- Resultado: tabela temporária _r (teste, ok, msg), lida no fim.

drop table if exists pg_temp._r;
create temp table _r (n serial, teste text, ok boolean, msg text);

create or replace function pg_temp.cenario() returns void language plpgsql as $$
declare c uuid; p uuid;
begin
  insert into categorias (slug, nome) values ('teste-cat', 'Teste') returning id into c;
  insert into produtos (slug, nome, categoria_id, preco_centavos, fotos)
    values ('teste-prod', 'Produto Teste', c, 10000, '{https://x/foto.webp}') returning id into p;
  insert into variantes (produto_id, nome, sku, estoque, ordem) values (p, 'A', 'T-A', 1, 0);
  insert into variantes (produto_id, nome, sku, estoque, preco_centavos, ordem) values (p, 'B', 'T-B', 5, 12000, 1);
  insert into cupons (codigo, tipo, valor) values ('TDEZ', 'percentual', 10);
  insert into cupons (codigo, tipo, valor, valido_ate) values ('TVELHO', 'percentual', 10, now() - interval '1 day');
  insert into cupons (codigo, tipo, valor, minimo_centavos) values ('TMIN', 'valor', 500, 100000);
  insert into cupons (codigo, tipo, valor, limite_usos) values ('TUMA', 'valor', 500, 1);
end $$;

create or replace function pg_temp.v(p_nome text) returns uuid language sql as $$
  select id from variantes where sku = 'T-' || p_nome $$;

-- payload de pedido: itens como 'A:1,B:2'
create or replace function pg_temp.ped(p_itens text, p_metodo text default 'pix', p_cupom text default null,
                                       p_uf text default 'SP', p_email text default 'cliente@teste.com') returns jsonb
language sql as $$
  select jsonb_build_object(
    'cliente', jsonb_build_object('email', p_email, 'nome', 'Cliente Teste'),
    'endereco', jsonb_build_object('cep', '01001000', 'rua', 'Praça da Sé', 'numero', '1', 'bairro', 'Sé',
                                   'cidade', 'São Paulo', 'uf', p_uf),
    'itens', (select jsonb_agg(jsonb_build_object('variante_id', pg_temp.v(split_part(x, ':', 1)),
                                                  'quantidade', split_part(x, ':', 2)::int))
              from unnest(string_to_array(p_itens, ',')) x),
    'metodo', p_metodo, 'parcelas', 1, 'cupom', p_cupom) $$;

create or replace function pg_temp.erro_de(p_sql text) returns text language plpgsql as $$
begin execute p_sql; return 'SEM_ERRO'; exception when others then return sqlerrm; end $$;

create or replace function pg_temp.est(p_nome text) returns int language sql as $$
  select estoque from variantes where sku = 'T-' || p_nome $$;

-- 1. Pix com cupom 10%: desconto Pix sobre o valor já com cupom; preço da variante B (12000)
do $$ declare r jsonb; begin begin
  perform pg_temp.cenario();
  r := criar_pedido(pg_temp.ped('B:2', 'pix', 'tdez'));
  assert (r ->> 'subtotal_centavos')::int = 24000, 'subtotal ' || r;
  assert (r ->> 'desconto_cupom_centavos')::int = 2400, 'cupom ' || r;
  assert (r ->> 'desconto_pix_centavos')::int = 1080, 'pix ' || r;
  assert (r ->> 'frete_centavos')::int = 1990, 'frete ' || r;
  assert (r ->> 'total_centavos')::int = 22510, 'total ' || r;
  assert pg_temp.est('B') = 3, 'estoque B';
  assert (select usos from cupons where codigo = 'TDEZ') = 1, 'usos do cupom';
  raise exception 'OK';
exception when assert_failure or others then insert into _r (teste, ok, msg) values ('pix com cupom e preco da variante', sqlerrm = 'OK', sqlerrm); end; end $$;

-- 2. orçamento bate com o pedido e não mexe no estoque
do $$ declare r jsonb; begin begin
  perform pg_temp.cenario();
  r := orcar_pedido(jsonb_build_object('itens', pg_temp.ped('B:2') -> 'itens', 'cupom', 'TDEZ', 'metodo', 'pix', 'uf', 'SP'));
  assert (r ->> 'total_centavos')::int = 22510, 'total ' || r;
  assert pg_temp.est('B') = 5, 'estoque mexeu';
  raise exception 'OK';
exception when assert_failure or others then insert into _r (teste, ok, msg) values ('orcamento igual ao pedido', sqlerrm = 'OK', sqlerrm); end; end $$;

-- 3. última unidade: o 2º pedido leva ESGOTADO
do $$ begin begin
  perform pg_temp.cenario();
  perform criar_pedido(pg_temp.ped('A:1'));
  assert pg_temp.est('A') = 0, 'estoque A';
  assert pg_temp.erro_de(format('select criar_pedido(%L)', pg_temp.ped('A:1', 'cartao', null, 'RJ', 'outro@teste.com'))) = 'ESGOTADO', 'nao esgotou';
  raise exception 'OK';
exception when assert_failure or others then insert into _r (teste, ok, msg) values ('ultima unidade', sqlerrm = 'OK', sqlerrm); end; end $$;

-- 4. reserva vencida devolve estoque e uso do cupom
do $$ declare r jsonb; begin begin
  perform pg_temp.cenario();
  r := criar_pedido(pg_temp.ped('A:1', 'pix', 'TDEZ'));
  update pedidos set reserva_expira_em = now() - interval '1 minute' where id = (r ->> 'id')::uuid;
  assert liberar_reservas_vencidas() = 1, 'nao liberou';
  assert pg_temp.est('A') = 1, 'estoque nao voltou';
  assert (select usos from cupons where codigo = 'TDEZ') = 0, 'uso nao voltou';
  assert (select status from pedidos where id = (r ->> 'id')::uuid) = 'expirado', 'status';
  raise exception 'OK';
exception when assert_failure or others then insert into _r (teste, ok, msg) values ('reserva vencida', sqlerrm = 'OK', sqlerrm); end; end $$;

-- 5. pagou depois de vencer e a peça já foi pra outro: SEM_ESTOQUE_PAGO_TARDE
do $$ declare r jsonb; begin begin
  perform pg_temp.cenario();
  r := criar_pedido(pg_temp.ped('A:1'));
  update pedidos set reserva_expira_em = now() - interval '1 minute' where id = (r ->> 'id')::uuid;
  perform liberar_reservas_vencidas();
  perform criar_pedido(pg_temp.ped('A:1', 'pix', null, 'SP', 'outro@teste.com'));
  assert pg_temp.erro_de(format('select confirmar_pagamento(%L)', r ->> 'id')) = 'SEM_ESTOQUE_PAGO_TARDE', 'nao barrou';
  raise exception 'OK';
exception when assert_failure or others then insert into _r (teste, ok, msg) values ('pago tarde sem estoque', sqlerrm = 'OK', sqlerrm); end; end $$;

-- 6. pago tarde COM estoque: separa de novo e fica pago
do $$ declare r jsonb; begin begin
  perform pg_temp.cenario();
  r := criar_pedido(pg_temp.ped('B:1'));
  update pedidos set reserva_expira_em = now() - interval '1 minute' where id = (r ->> 'id')::uuid;
  perform liberar_reservas_vencidas();
  assert confirmar_pagamento((r ->> 'id')::uuid, 'pi_teste') = 'pago', 'nao pagou';
  assert pg_temp.est('B') = 4, 'estoque';
  raise exception 'OK';
exception when assert_failure or others then insert into _r (teste, ok, msg) values ('pago tarde com estoque', sqlerrm = 'OK', sqlerrm); end; end $$;

-- 7. estorno devolve o estoque; confirmar 2x não muda nada
do $$ declare r jsonb; begin begin
  perform pg_temp.cenario();
  r := criar_pedido(pg_temp.ped('B:2', 'cartao'));
  assert confirmar_pagamento((r ->> 'id')::uuid) = 'pago', 'pagar';
  assert confirmar_pagamento((r ->> 'id')::uuid) = 'pago', 'pagar 2x';
  assert cancelar_pedido((r ->> 'id')::uuid, 'estornado', 'cliente desistiu') = 'estornado', 'estornar';
  assert pg_temp.est('B') = 5, 'estoque nao voltou';
  raise exception 'OK';
exception when assert_failure or others then insert into _r (teste, ok, msg) values ('estorno devolve estoque', sqlerrm = 'OK', sqlerrm); end; end $$;

-- 8. cupons: vencido, mínimo, limite de usos
do $$ begin begin
  perform pg_temp.cenario();
  assert pg_temp.erro_de(format('select criar_pedido(%L)', pg_temp.ped('B:1', 'pix', 'TVELHO'))) = 'CUPOM_INVALIDO', 'vencido';
  assert pg_temp.erro_de(format('select criar_pedido(%L)', pg_temp.ped('B:1', 'pix', 'TMIN'))) = 'CUPOM_MINIMO', 'minimo';
  perform criar_pedido(pg_temp.ped('B:1', 'pix', 'TUMA'));
  assert pg_temp.erro_de(format('select criar_pedido(%L)', pg_temp.ped('B:1', 'pix', 'TUMA', 'SP', 'b@teste.com'))) = 'CUPOM_INVALIDO', 'limite';
  assert pg_temp.erro_de(format('select criar_pedido(%L)', pg_temp.ped('B:1', 'pix', 'NAOEXISTE'))) = 'CUPOM_INVALIDO', 'inexistente';
  raise exception 'OK';
exception when assert_failure or others then insert into _r (teste, ok, msg) values ('cupons invalidos', sqlerrm = 'OK', sqlerrm); end; end $$;

-- 9. andamento do pedido
do $$ declare r jsonb; vid uuid; begin begin
  perform pg_temp.cenario();
  r := criar_pedido(pg_temp.ped('B:1')); vid := (r ->> 'id')::uuid;
  assert pg_temp.erro_de(format('select mudar_status(%L, %L)', vid, 'enviado')) = 'MUDANCA_INVALIDA', 'enviar sem pagar';
  perform confirmar_pagamento(vid);
  assert pg_temp.erro_de(format('select mudar_status(%L, %L)', vid, 'enviado')) = 'RASTREIO_OBRIGATORIO', 'sem rastreio';
  assert mudar_status(vid, 'separando') = 'separando', 'separar';
  assert mudar_status(vid, 'enviado', ' BR123 ') = 'enviado', 'enviar';
  assert (select rastreio from pedidos where pedidos.id = vid) = 'BR123', 'rastreio';
  assert pg_temp.erro_de(format('select cancelar_pedido(%L)', vid)) = 'JA_ENVIADO', 'cancelar enviado';
  assert mudar_status(vid, 'entregue') = 'entregue', 'entregar';
  raise exception 'OK';
exception when assert_failure or others then insert into _r (teste, ok, msg) values ('andamento do pedido', sqlerrm = 'OK', sqlerrm); end; end $$;

-- 10. frete grátis acima de R$ 299 e UF inválida
do $$ declare r jsonb; begin begin
  perform pg_temp.cenario();
  r := criar_pedido(pg_temp.ped('B:3', 'cartao', null, 'AM'));
  assert (r ->> 'frete_centavos')::int = 0, 'frete nao zerou ' || r;
  assert pg_temp.erro_de(format('select criar_pedido(%L)', pg_temp.ped('B:1', 'pix', null, 'XX'))) = 'UF_INVALIDA', 'uf';
  assert (cotar_frete('AM', 1000) ->> 'centavos')::int = 3990, 'frete norte';
  raise exception 'OK';
exception when assert_failure or others then insert into _r (teste, ok, msg) values ('frete', sqlerrm = 'OK', sqlerrm); end; end $$;

-- 11. produto desativado não vende; quantidade absurda barrada
do $$ begin begin
  perform pg_temp.cenario();
  assert pg_temp.erro_de(format('select criar_pedido(%L)', pg_temp.ped('B:50'))) = 'QUANTIDADE_INVALIDA', 'qtd';
  update produtos set ativo = false where slug = 'teste-prod';
  assert pg_temp.erro_de(format('select criar_pedido(%L)', pg_temp.ped('B:1'))) = 'PRODUTO_INEXISTENTE', 'inativo';
  raise exception 'OK';
exception when assert_failure or others then insert into _r (teste, ok, msg) values ('produto inativo e quantidade', sqlerrm = 'OK', sqlerrm); end; end $$;

-- 12. resumo do painel conta o pedido pago
do $$ declare r jsonb; s jsonb; begin begin
  perform pg_temp.cenario();
  r := criar_pedido(pg_temp.ped('B:1', 'cartao'));
  perform confirmar_pagamento((r ->> 'id')::uuid);
  s := painel_resumo(now() - interval '1 hour', now() + interval '1 hour', 'hour');
  assert (s ->> 'pedidos')::int >= 1, 'pedidos ' || s;
  assert (s -> 'serie') <> '[]'::jsonb, 'serie';
  raise exception 'OK';
exception when assert_failure or others then insert into _r (teste, ok, msg) values ('resumo do painel', sqlerrm = 'OK', sqlerrm); end; end $$;

-- 13. o site (anon) lê a vitrine mas não lê pedidos, clientes nem cupons, e não chama funções
do $$ declare n int; begin begin
  perform pg_temp.cenario();
  set local role anon;
  select count(*) into n from vitrine where slug = 'teste-prod';
  assert n = 1, 'anon nao ve a vitrine';
  assert pg_temp.erro_de('select count(*) from pedidos') like 'permission denied%', 'anon le pedidos';
  assert pg_temp.erro_de('select count(*) from clientes') like 'permission denied%', 'anon le clientes';
  assert pg_temp.erro_de('select count(*) from cupons') like 'permission denied%', 'anon le cupons';
  assert pg_temp.erro_de(format('select criar_pedido(%L)', '{}')) like 'permission denied%', 'anon cria pedido';
  raise exception 'OK';
exception when assert_failure or others then insert into _r (teste, ok, msg) values ('anon so le o catalogo', sqlerrm = 'OK', sqlerrm); end; end $$;

select teste, ok, case when ok then '' else msg end as msg from _r order by n;
