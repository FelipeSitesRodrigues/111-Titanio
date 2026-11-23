// @ts-nocheck
// Portado da 090 Tokstec (painel/lib/periodo.js) sem mudança de regra.
// Período dos relatórios, no jeito do gerenciador de anúncios: atalhos (hoje, últimos 7 dias,
// mês passado...) ou de/até livre, com comparação opcional com o período anterior.
// Tudo em datas de São Paulo (YYYY-MM-DD), o dia comercial da loja. Roda no servidor e no navegador.

const DIA = 86400000;
const paraData = (s) => new Date(`${s}T12:00:00Z`);
const paraTexto = (d) => d.toISOString().slice(0, 10);
export const somarDias = (s, n) => paraTexto(new Date(paraData(s).getTime() + n * DIA));
export const diasEntre = (de, ate) => Math.round((paraData(ate) - paraData(de)) / DIA) + 1;
export const diaDaSemana = (s) => (paraData(s).getUTCDay() + 6) % 7; // 0 = segunda
export const hojeSP = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
export const dataValida = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s || '') && !Number.isNaN(paraData(s).getTime()) && paraTexto(paraData(s)) === s;
const segunda = (s) => somarDias(s, -diaDaSemana(s));
export const inicioMes = (s) => `${s.slice(0, 8)}01`;
export const fimMes = (s) => somarDias(inicioMes(somarDias(inicioMes(s), 32)), -1);
export const somarMeses = (s, n) => {
  const [a, m] = s.split('-').map(Number);
  const t = a * 12 + (m - 1) + n;
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}-01`;
};

export const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
export const MESES_LONGOS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
// "14 de nov de 2026"
export const porExtenso = (s) => `${Number(s.slice(8, 10))} de ${MESES[Number(s.slice(5, 7)) - 1]} de ${s.slice(0, 4)}`;
export const textoIntervalo = (de, ate) => (de === ate ? porExtenso(de) : `${porExtenso(de)} – ${porExtenso(ate)}`);

// [chave, nome, (hoje) => { de, ate, antes?, contra? }]
export const ATALHOS = [
  ['hoje', 'Hoje', (h) => ({ de: h, ate: h, contra: 'que ontem' })],
  ['ontem', 'Ontem', (h) => ({ de: somarDias(h, -1), ate: somarDias(h, -1), contra: 'que anteontem' })],
  ['hoje-ontem', 'Hoje e ontem', (h) => ({ de: somarDias(h, -1), ate: h })],
  ['7d', 'Últimos 7 dias', (h) => ({ de: somarDias(h, -6), ate: h })],
  ['14d', 'Últimos 14 dias', (h) => ({ de: somarDias(h, -13), ate: h })],
  ['28d', 'Últimos 28 dias', (h) => ({ de: somarDias(h, -27), ate: h })],
  ['30d', 'Últimos 30 dias', (h) => ({ de: somarDias(h, -29), ate: h })],
  ['semana', 'Esta semana', (h) => {
    const de = segunda(h);
    return { de, ate: h, antes: { de: somarDias(de, -7), ate: somarDias(h, -7) }, contra: 'que o mesmo trecho da semana passada' };
  }],
  ['semana-passada', 'Semana passada', (h) => {
    const de = somarDias(segunda(h), -7);
    return { de, ate: somarDias(de, 6), contra: 'que a semana anterior' };
  }],
  ['mes', 'Este mês', (h) => {
    const a = somarMeses(h, -1);
    const mesmoDia = `${a.slice(0, 8)}${h.slice(8, 10)}`;
    return { de: inicioMes(h), ate: h, antes: { de: a, ate: mesmoDia > fimMes(a) ? fimMes(a) : mesmoDia }, contra: 'que o mesmo trecho do mês passado' };
  }],
  ['mes-passado', 'Mês passado', (h) => {
    const de = somarMeses(h, -1);
    const a = somarMeses(h, -2);
    return { de, ate: fimMes(de), antes: { de: a, ate: fimMes(a) }, contra: 'que o mês anterior' };
  }],
  ['90d', 'Últimos 90 dias', (h) => ({ de: somarDias(h, -89), ate: h })],
  ['ano', 'Este ano', (h) => ({ de: `${h.slice(0, 4)}-01-01`, ate: h })],
];
export const NOME_ATALHO = Object.fromEntries(ATALHOS.map(([k, n]) => [k, n]));
const MAX_DIAS = 400;
export const PADRAO = '30d';

// completa o anterior e o texto da comparação
function fechar(chave, { de, ate, antes, contra }, hoje, comparar) {
  const dias = diasEntre(de, ate);
  antes = antes || { de: somarDias(de, -dias), ate: somarDias(de, -1) };
  contra = contra || (dias === 1 ? 'que o dia anterior' : `que os ${dias} dias anteriores`);
  return { chave, nome: NOME_ATALHO[chave] || 'Personalizado', de, ate, dias, antes, contra, comparar, hoje, titulo: textoIntervalo(de, ate) };
}

// a partir do endereço: ?periodo=7d  ou  ?de=2026-11-03&ate=2026-11-09   (+ &comparar=0 pra desligar)
export function lerPeriodo(query = {}, hoje = hojeSP()) {
  const comparar = query.comparar !== '0';
  const chave = String(query.periodo || '');
  const atalho = ATALHOS.find(([k]) => k === chave);
  if (atalho) return fechar(chave, atalho[2](hoje), hoje, comparar);
  if (dataValida(query.de) && dataValida(query.ate)) {
    let [de, ate] = query.de <= query.ate ? [query.de, query.ate] : [query.ate, query.de];
    if (ate > hoje) ate = hoje;
    if (de > ate) de = ate;
    if (diasEntre(de, ate) > MAX_DIAS) de = somarDias(ate, -(MAX_DIAS - 1));
    return fechar('livre', { de, ate }, hoje, comparar);
  }
  return fechar(PADRAO, ATALHOS.find(([k]) => k === PADRAO)[2](hoje), hoje, comparar);
}

// intervalo de um atalho (pro seletor desenhar no calendário antes de aplicar)
export const intervaloDoAtalho = (chave, hoje) => {
  const a = ATALHOS.find(([k]) => k === chave);
  return a ? fechar(chave, a[2](hoje), hoje, true) : null;
};
// período anterior de um intervalo livre
export const anteriorDe = (de, ate) => fechar('livre', { de, ate }, de, true).antes;
