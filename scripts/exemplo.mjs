// Pedidos fictícios pra ver o painel funcionando (marcados exemplo = true, e-mails @exemplo.com).
//   npm run exemplo -- --sim-estou-no-banco-de-teste          cria 60 pedidos nos últimos 90 dias
//   npm run exemplo -- --apagar --sim-estou-no-banco-de-teste apaga todos os de exemplo
// Passam pelas mesmas funções da loja (criar_pedido, confirmar_pagamento...); o estoque usado volta no fim.
import { db } from './_catalogo.mjs';

if (!process.argv.includes('--sim-estou-no-banco-de-teste')) {
  console.error('Isso grava pedidos falsos. Rode só antes da loja abrir, com --sim-estou-no-banco-de-teste.');
  process.exit(1);
}
const rpc = async (fn, args) => { const { data, error } = await db.rpc(fn, args); if (error) throw new Error(`${fn}: ${error.message}`); return data; };

if (process.argv.includes('--apagar')) {
  const { data: peds } = await db.from('pedidos').select('id').eq('exemplo', true);
  // o estoque dos exemplos já voltou quando foram criados: só apagar (cancelar devolveria 2x)
  await db.from('pedidos').delete().eq('exemplo', true);
  await db.from('clientes').delete().like('email', '%@exemplo.com');
  await db.from('cupons').delete().in('codigo', ['BEMVINDO10', 'TITANIO50']).eq('usos', 0);
  console.log(`✓ ${peds?.length ?? 0} pedidos de exemplo apagados`);
  process.exit(0);
}

const NOMES = ['Ana Souza', 'Bruno Lima', 'Carla Mendes', 'Diego Rocha', 'Eduarda Alves', 'Felipe Costa', 'Gabriela Dias', 'Henrique Silva',
  'Isabela Martins', 'João Pereira', 'Karen Oliveira', 'Lucas Ribeiro', 'Mariana Santos', 'Nicolas Ferreira', 'Patrícia Gomes', 'Rafael Araújo',
  'Sabrina Barbosa', 'Thiago Cardoso', 'Vanessa Teixeira', 'William Correia', 'Yasmin Moreira', 'Rodrigo Nunes'];
const LUGARES = [['São Paulo', 'SP'], ['Rio de Janeiro', 'RJ'], ['Niterói', 'RJ'], ['Belo Horizonte', 'MG'], ['Curitiba', 'PR'], ['Porto Alegre', 'RS'],
  ['Salvador', 'BA'], ['Recife', 'PE'], ['Brasília', 'DF'], ['Goiânia', 'GO'], ['Manaus', 'AM'], ['Fortaleza', 'CE']];
const sorte = (a) => a[Math.floor(Math.random() * a.length)];

await db.from('cupons').upsert([
  { codigo: 'BEMVINDO10', descricao: 'Primeira compra', tipo: 'percentual', valor: 10, minimo_centavos: 0 },
  { codigo: 'TITANIO50', descricao: 'R$ 50 acima de R$ 500', tipo: 'valor', valor: 5000, minimo_centavos: 50000 },
], { onConflict: 'codigo', ignoreDuplicates: true });

const { data: vars } = await db.from('variantes').select('id, estoque, produtos!inner(ativo, preco_centavos)').eq('ativo', true).eq('produtos.ativo', true);
// produtos mais baratos vendem mais
const pesados = vars.flatMap((v) => Array(v.produtos.preco_centavos < 50000 ? 3 : 1).fill(v.id));

let feitos = 0;
for (let n = 0; n < 60; n++) {
  const nome = sorte(NOMES);
  const [cidade, uf] = sorte(LUGARES);
  const itens = [...new Set(Array.from({ length: 1 + (Math.random() < .3 ? 1 : 0) }, () => sorte(pesados)))]
    .map((variante_id) => ({ variante_id, quantidade: Math.random() < .85 ? 1 : 2 }));
  const metodo = Math.random() < .55 ? 'pix' : 'cartao';
  const cupom = Math.random() < .15 ? 'BEMVINDO10' : null;
  const email = `${nome.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(' ', '.')}@exemplo.com`;
  let ped;
  try {
    ped = await rpc('criar_pedido', { p: {
      cliente: { email, nome, cpf: String(10000000000 + Math.floor(Math.random() * 89999999999)), telefone: '21999990000' },
      endereco: { cep: '01001000', rua: 'Rua de Exemplo', numero: String(10 + n), bairro: 'Centro', cidade, uf },
      itens, metodo, parcelas: metodo === 'cartao' ? sorte([1, 2, 3, 5, 10]) : 1, cupom,
    } });
  } catch (e) { console.log('  pulei:', e.message); continue; }

  // quando aconteceu: mais pedidos nos dias recentes
  const diasAtras = Math.floor(Math.pow(Math.random(), 2.2) * 90);
  const criado = new Date(Date.now() - diasAtras * 86400000 - Math.floor(Math.random() * 14 + 8) * 3600000 * (diasAtras === 0 ? .1 : 1));
  const sorteio = Math.random();
  const destino = diasAtras > 12 ? (sorteio < .82 ? 'entregue' : sorteio < .9 ? 'estornado' : sorteio < .95 ? 'cancelado' : 'expirado')
    : diasAtras > 4 ? (sorteio < .6 ? 'enviado' : sorteio < .85 ? 'entregue' : 'expirado')
    : (sorteio < .45 ? 'pago' : sorteio < .7 ? 'separando' : sorteio < .9 ? 'enviado' : 'expirado');

  if (destino === 'expirado') {
    await db.from('pedidos').update({ reserva_expira_em: new Date(Date.now() - 60000).toISOString() }).eq('id', ped.id);
    await rpc('liberar_reservas_vencidas', {});
  } else if (destino === 'cancelado') {
    await rpc('cancelar_pedido', { p_pedido: ped.id, p_status: 'cancelado', p_motivo: 'exemplo' });
  } else {
    await rpc('confirmar_pagamento', { p_pedido: ped.id, p_ref: `pi_exemplo_${n}` });
    if (destino === 'estornado') await rpc('cancelar_pedido', { p_pedido: ped.id, p_status: 'estornado', p_motivo: 'exemplo' });
    if (['separando', 'enviado', 'entregue'].includes(destino)) await rpc('mudar_status', { p_pedido: ped.id, p_status: 'separando' });
    if (['enviado', 'entregue'].includes(destino)) await rpc('mudar_status', { p_pedido: ped.id, p_status: 'enviado', p_rastreio: `BR${100000000 + n}BR` });
    if (destino === 'entregue') await rpc('mudar_status', { p_pedido: ped.id, p_status: 'entregue' });
    // estoque usado volta (exemplo não pode esgotar a loja)
    if (destino !== 'estornado') for (const it of itens) {
      const { data: v } = await db.from('variantes').select('estoque').eq('id', it.variante_id).single();
      await db.from('variantes').update({ estoque: v.estoque + it.quantidade }).eq('id', it.variante_id);
    }
  }
  const h = (min) => new Date(criado.getTime() + min * 60000).toISOString();
  await db.from('pedidos').update({
    exemplo: true, criado_em: criado.toISOString(),
    ...(['pago', 'separando', 'enviado', 'entregue', 'estornado'].includes(destino) && { pago_em: h(4) }),
    ...(['separando', 'enviado', 'entregue'].includes(destino) && { separado_em: h(60 * 20) }),
    ...(['enviado', 'entregue'].includes(destino) && { enviado_em: h(60 * 30) }),
    ...(destino === 'entregue' && { entregue_em: h(60 * 24 * 5) }),
  }).eq('id', ped.id);
  feitos++;
}
console.log(`✓ ${feitos} pedidos de exemplo`);
