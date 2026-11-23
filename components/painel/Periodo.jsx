'use client';
// Portado da 090 Tokstec (components/SeletorPeriodo.js) pro visual da Titânio.
// Seletor de período no jeito do gerenciador de anúncios: botão "Hoje: 14 de nov de 2026",
// lista de atalhos à esquerda, dois meses de calendário (clica no início e no fim), "Comparar",
// e Cancelar / Atualizar. Só muda a página ao clicar em Atualizar.
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  anteriorDe, ATALHOS, diaDaSemana, fimMes, inicioMes, intervaloDoAtalho, MESES, MESES_LONGOS,
  NOME_ATALHO, porExtenso, somarDias, somarMeses, textoIntervalo,
} from '@/lib/painel/periodo';
import { Icone } from './Icone';

const SEMANA = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
const RECENTES = 'ti-periodos-recentes';
const lerRecentes = () => { try { return JSON.parse(localStorage.getItem(RECENTES) || '[]').filter((k) => NOME_ATALHO[k]); } catch { return []; } };
const guardarRecente = (k) => {
  if (!NOME_ATALHO[k]) return;
  try { localStorage.setItem(RECENTES, JSON.stringify([k, ...lerRecentes().filter((x) => x !== k)].slice(0, 3))); } catch {}
};

function Mes({ inicio, hoje, ano0, rascunho, previa, comparar, aoClicar, aoPassar, aoTrocarMes }) {
  const fim = fimMes(inicio);
  const vazios = diaDaSemana(inicio);
  const dias = [];
  for (let d = inicio; d <= fim; d = somarDias(d, 1)) dias.push(d);
  const [de, ate] = previa;
  const ant = comparar ? anteriorDe(rascunho.de, rascunho.ate) : null;
  const antes = comparar && rascunho.antes ? rascunho.antes : ant;
  const anos = [];
  for (let a = ano0; a <= Number(hoje.slice(0, 4)); a++) anos.push(a);
  return (
    <div className="p-mes">
      <div className="p-mes__cab">
        <select aria-label="Mês" value={Number(inicio.slice(5, 7)) - 1} onChange={(e) => aoTrocarMes(`${inicio.slice(0, 4)}-${String(Number(e.target.value) + 1).padStart(2, '0')}-01`)}>
          {MESES.map((m, i) => <option key={m} value={i}>{m}</option>)}
        </select>
        <select aria-label="Ano" value={Number(inicio.slice(0, 4))} onChange={(e) => aoTrocarMes(`${e.target.value}-${inicio.slice(5, 7)}-01`)}>
          {anos.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
      </div>
      <div className="p-mes__grade" role="grid" aria-label={`${MESES_LONGOS[Number(inicio.slice(5, 7)) - 1]} de ${inicio.slice(0, 4)}`}>
        {SEMANA.map((s) => <span key={s} className="p-mes__sem">{s}</span>)}
        {Array.from({ length: vazios }, (_, i) => <span key={`v${i}`} />)}
        {dias.map((d) => {
          const futuro = d > hoje;
          const cls = [
            d >= de && d <= ate && 'dentro',
            d === de && 'ini',
            d === ate && 'fim',
            antes && d >= antes.de && d <= antes.ate && 'antes',
            d === hoje && 'hoje',
          ].filter(Boolean).join(' ');
          return (
            <button key={d} type="button" className={cls} disabled={futuro} aria-pressed={d >= de && d <= ate}
              aria-label={porExtenso(d)} onClick={() => aoClicar(d)} onMouseEnter={() => aoPassar(d)}>
              {Number(d.slice(8, 10))}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function Periodo({ per }) {
  const router = useRouter();
  const caminho = usePathname();
  const [aberto, setAberto] = useState(false);
  const [r, setR] = useState(null); // rascunho: { chave, de, ate, comparar }
  const [mes, setMes] = useState(null); // mês da esquerda
  const [marcando, setMarcando] = useState(null); // 1º clique no calendário
  const [passando, setPassando] = useState(null);
  const [recentes, setRecentes] = useState([]);
  const caixa = useRef(null);
  const hoje = per.hoje;

  const abrir = () => {
    setR({ chave: per.chave, de: per.de, ate: per.ate, comparar: per.comparar, antes: per.chave !== 'livre' ? per.antes : null });
    setMes(somarMeses(per.ate, -1));
    setMarcando(null); setPassando(null);
    setRecentes(lerRecentes());
    setAberto(true);
  };

  // atalho escolhido à vista (no celular a lista vira uma fileira que rola de lado)
  useEffect(() => {
    if (!aberto) return;
    const lista = caixa.current?.querySelector('.p-per__lista');
    const op = lista?.querySelector('input[name="atalho-a"]:checked')?.parentElement;
    if (!op) return;
    if (lista.scrollWidth > lista.clientWidth) lista.scrollLeft = op.offsetLeft - (lista.clientWidth - op.offsetWidth) / 2;
    else if (lista.scrollHeight > lista.clientHeight) lista.scrollTop = op.offsetTop - lista.clientHeight / 2;
  }, [aberto]);

  useEffect(() => {
    if (!aberto) return undefined;
    const fora = (e) => { if (caixa.current && !caixa.current.contains(e.target)) setAberto(false); };
    const esc = (e) => { if (e.key === 'Escape') setAberto(false); };
    document.addEventListener('mousedown', fora);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', fora); document.removeEventListener('keydown', esc); };
  }, [aberto]);

  const escolherAtalho = (k) => {
    const i = intervaloDoAtalho(k, hoje);
    setR((x) => ({ ...x, chave: k, de: i.de, ate: i.ate, antes: i.antes }));
    setMes(somarMeses(i.ate, -1));
    setMarcando(null);
  };
  const clicarDia = (d) => {
    if (!marcando) { setMarcando(d); setR((x) => ({ ...x, chave: 'livre', de: d, ate: d, antes: null })); return; }
    const [de, ate] = d < marcando ? [d, marcando] : [marcando, d];
    setR((x) => ({ ...x, chave: 'livre', de, ate, antes: null }));
    setMarcando(null);
  };
  const trocarData = (campo, v) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v) || v > hoje) return;
    setR((x) => {
      const n = { ...x, chave: 'livre', antes: null, [campo]: v };
      if (n.de > n.ate) [n.de, n.ate] = [n.ate, n.de];
      return n;
    });
    setMes(somarMeses(campo === 'ate' ? v : r.ate, -1));
  };
  const atualizar = () => {
    const query = r.chave === 'livre' ? { de: r.de, ate: r.ate } : { periodo: r.chave };
    if (!r.comparar) query.comparar = '0';
    guardarRecente(r.chave);
    setAberto(false);
    // mantém os outros filtros da página (status, busca), troca só o período
    const qs = new URLSearchParams(window.location.search);
    ['periodo', 'de', 'ate', 'comparar', 'pagina'].forEach((k) => qs.delete(k));
    Object.entries(query).forEach(([k, v]) => qs.set(k, v));
    router.push(`${caminho}?${qs}`);
  };

  // enquanto marca o fim, o calendário mostra o intervalo até onde o mouse está
  const previa = useMemo(() => {
    if (!r) return [per.de, per.ate];
    if (marcando && passando) return passando < marcando ? [passando, marcando] : [marcando, passando];
    return [r.de, r.ate];
  }, [r, marcando, passando, per]);

  const rotulo = per.todos ? 'Todo o período' : per.chave === 'livre' ? per.titulo : `${per.nome}: ${per.titulo}`;
  const antesR = r && (r.antes || anteriorDe(r.de, r.ate));
  const lista = (ks, nome) => ks.map((k) => (
    <label key={`${nome}-${k}`} className="p-per__op">
      <input type="radio" name={`atalho-${nome}`} checked={r.chave === k} onChange={() => escolherAtalho(k)} />
      <span>{NOME_ATALHO[k]}</span>
    </label>
  ));

  return (
    <div className="p-per" ref={caixa}>
      <button type="button" className="p-per__botao vidro" aria-expanded={aberto} aria-haspopup="dialog" onClick={() => (aberto ? setAberto(false) : abrir())}>
        <Icone n="calendario" />
        <span>{rotulo}</span>
        <Icone n="seta" />
      </button>

      {aberto && r && (
        <div className="p-per__caixa vidro" role="dialog" aria-label="Escolher período">
          <div className="p-per__lista">
            {recentes.length > 0 && (<><b>Usados recentemente</b>{lista(recentes, 'r')}<hr /></>)}
            {lista(ATALHOS.map(([k]) => k), 'a')}
            <label className="p-per__op">
              <input type="radio" name="atalho-a" checked={r.chave === 'livre'} onChange={() => setR((x) => ({ ...x, chave: 'livre', antes: null }))} />
              <span>Personalizado</span>
            </label>
          </div>

          <div className="p-per__direita">
            <div className="p-per__meses" onMouseLeave={() => setPassando(null)}>
              <button type="button" className="p-per__nav p-per__nav--ant" aria-label="Mês anterior" onClick={() => setMes(somarMeses(mes, -1))}>
                <Icone n="voltar" />
              </button>
              {[mes, somarMeses(mes, 1)].map((m) => (
                <Mes key={m} inicio={m} hoje={hoje} ano0={2025} rascunho={r} previa={previa} comparar={r.comparar}
                  aoClicar={clicarDia} aoPassar={setPassando}
                  aoTrocarMes={(novo) => setMes(m === mes ? novo : somarMeses(novo, -1))} />
              ))}
              <button type="button" className="p-per__nav p-per__nav--prox" aria-label="Próximo mês" disabled={somarMeses(mes, 1) >= inicioMes(hoje)} onClick={() => setMes(somarMeses(mes, 1))}>
                <Icone n="avancar" />
              </button>
            </div>

            <label className="p-per__comparar">
              <input type="checkbox" checked={r.comparar} onChange={(e) => setR((x) => ({ ...x, comparar: e.target.checked }))} />
              Comparar
            </label>
            <div className="p-per__linha">
              <i className="p-per__cor" />
              <select aria-label="Período" value={r.chave} onChange={(e) => (e.target.value === 'livre' ? setR((x) => ({ ...x, chave: 'livre', antes: null })) : escolherAtalho(e.target.value))}>
                {ATALHOS.map(([k, n]) => <option key={k} value={k}>{n}</option>)}
                <option value="livre">Personalizado</option>
              </select>
              <input type="date" aria-label="Início" value={r.de} max={hoje} onChange={(e) => trocarData('de', e.target.value)} />
              <span>–</span>
              <input type="date" aria-label="Fim" value={r.ate} max={hoje} onChange={(e) => trocarData('ate', e.target.value)} />
            </div>
            {r.comparar && (
              <div className="p-per__linha p-per__linha--antes">
                <i className="p-per__cor p-per__cor--antes" />
                <span className="p-per__fixo">Período anterior</span>
                <span className="p-per__datas">{textoIntervalo(antesR.de, antesR.ate)}</span>
              </div>
            )}

            <div className="p-per__rodape">
              <small>{marcando ? 'Agora clique no último dia.' : 'Fuso horário das datas: Horário de São Paulo'}</small>
              <div>
                <button type="button" className="p-btn p-btn--fantasma p-btn--p" onClick={() => setAberto(false)}>Cancelar</button>
                <button type="button" className="p-btn p-btn--vermelho p-btn--p" onClick={atualizar}>Atualizar</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
