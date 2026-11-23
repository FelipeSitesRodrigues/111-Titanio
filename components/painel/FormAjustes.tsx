"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Icone } from "./Icone";
import { useAviso } from "./Avisos";
import { alternarAdmin, convidarAdmin, salvarAjustes, type Ajustes } from "@/app/painel/acoes/loja";

const REGIOES: [string, string][] = [["SE", "Sudeste"], ["S", "Sul"], ["CO", "Centro-Oeste"], ["NE", "Nordeste"], ["N", "Norte"]];
const emReais = (c: number | null) => (c == null ? "" : (c / 100).toFixed(2).replace(".", ","));
const centavos = (v: string) => { const t = v.trim(); if (!t) return null; const n = Number(t.replace(/\./g, "").replace(",", ".")); return Number.isFinite(n) ? Math.round(n * 100) : NaN; };

type Admin = { user_id: string; email: string; nome: string; papel: "admin" | "operador"; ativo: boolean };

export function FormAjustes({ inicial, admins, euId, souAdmin }: { inicial: Ajustes; admins: Admin[]; euId: string; souAdmin: boolean }) {
  const [a, setA] = useState(inicial);
  const [textos, setTextos] = useState(() => ({
    gratis: emReais(inicial.frete.gratis_acima_centavos),
    regioes: Object.fromEntries(REGIOES.map(([k]) => [k, emReais(inicial.frete.regioes[k]?.centavos ?? 0)])) as Record<string, string>,
  }));
  const [novo, setNovo] = useState<{ email: string; nome: string; senha: string; papel: "admin" | "operador" } | null>(null);
  const [indo, comecar] = useTransition();
  const avisar = useAviso();
  const router = useRouter();
  const mudou = JSON.stringify(a) !== JSON.stringify(inicial) || textos.gratis !== emReais(inicial.frete.gratis_acima_centavos)
    || REGIOES.some(([k]) => textos.regioes[k] !== emReais(inicial.frete.regioes[k]?.centavos ?? 0));

  const salvar = () => comecar(async () => {
    const gratis = centavos(textos.gratis);
    const regioes: Ajustes["frete"]["regioes"] = {};
    for (const [k, nome] of REGIOES) {
      const c = centavos(textos.regioes[k]);
      if (c === null || Number.isNaN(c)) { avisar(`Frete do ${nome} inválido.`, true); return; }
      regioes[k] = { centavos: c, prazo_dias: a.frete.regioes[k]?.prazo_dias ?? 7 };
    }
    if (Number.isNaN(gratis)) { avisar("Valor do frete grátis inválido.", true); return; }
    const r = await salvarAjustes({ ...a, frete: { gratis_acima_centavos: gratis, regioes } });
    avisar(r.ok ? "Ajustes salvos" : r.erro, !r.ok);
    if (r.ok) router.refresh();
  });
  const muda = <S extends keyof Ajustes, K extends keyof Ajustes[S]>(s: S, k: K, v: Ajustes[S][K]) => setA((x) => ({ ...x, [s]: { ...x[s], [k]: v } }));

  return (
    <>
      <div className="p-grade p-meio">
        <section className="p-card p-entra" style={{ "--i": 1 } as React.CSSProperties}>
          <div className="p-card__cab"><h2>Pagamento</h2></div>
          <div className="p-form p-form--2">
            <label className="p-campo"><span>Desconto no Pix</span><div className="p-prefixo"><b>%</b><input className="p-input" type="number" min={0} max={30} value={a.pagamento.pix_desconto_pct} disabled={!souAdmin} onChange={(e) => muda("pagamento", "pix_desconto_pct", Number(e.target.value))} /></div></label>
            <label className="p-campo"><span>Parcelas sem juros (até)</span><input className="p-input" type="number" min={1} max={12} value={a.pagamento.parcelas_sem_juros} disabled={!souAdmin} onChange={(e) => muda("pagamento", "parcelas_sem_juros", Number(e.target.value))} /></label>
            <label className="p-campo p-cheio"><span>Parcela mínima</span><div className="p-prefixo"><b>R$</b><input className="p-input" inputMode="decimal" disabled={!souAdmin} value={emReais(a.pagamento.parcela_minima_centavos)} onChange={(e) => { const c = centavos(e.target.value); if (c !== null && !Number.isNaN(c)) muda("pagamento", "parcela_minima_centavos", c); }} /></div>
              <small>Compra pequena parcela em menos vezes pra cada parcela não ficar abaixo disso.</small></label>
          </div>
        </section>

        <section className="p-card p-entra" style={{ "--i": 2 } as React.CSSProperties}>
          <div className="p-card__cab"><h2>Frete</h2><small style={{ color: "var(--texto-2)" }}>Tabela simples até ligar a transportadora</small></div>
          <label className="p-campo" style={{ marginBottom: 16 }}><span>Frete grátis acima de</span><div className="p-prefixo"><b>R$</b><input className="p-input" inputMode="decimal" disabled={!souAdmin} value={textos.gratis} onChange={(e) => setTextos({ ...textos, gratis: e.target.value })} placeholder="Sem frete grátis" /></div></label>
          <div className="p-variantes">
            {REGIOES.map(([k, nome]) => (
              <div key={k} style={{ display: "grid", gridTemplateColumns: "1.1fr 1fr 0.9fr", gap: 10, alignItems: "end" }}>
                <b style={{ fontSize: 14, paddingBottom: 12 }}>{nome}</b>
                <label className="p-campo"><span>Valor</span><div className="p-prefixo"><b>R$</b><input className="p-input" inputMode="decimal" disabled={!souAdmin} value={textos.regioes[k]} onChange={(e) => setTextos({ ...textos, regioes: { ...textos.regioes, [k]: e.target.value } })} /></div></label>
                <label className="p-campo"><span>Prazo (dias úteis)</span><input className="p-input" type="number" min={1} disabled={!souAdmin} value={a.frete.regioes[k]?.prazo_dias ?? 7}
                  onChange={(e) => setA((x) => ({ ...x, frete: { ...x.frete, regioes: { ...x.frete.regioes, [k]: { centavos: x.frete.regioes[k]?.centavos ?? 0, prazo_dias: Number(e.target.value) } } } }))} /></label>
              </div>
            ))}
          </div>
        </section>

        <section className="p-card p-entra" style={{ "--i": 3 } as React.CSSProperties}>
          <div className="p-card__cab"><h2>Dados da loja</h2><small style={{ color: "var(--texto-2)" }}>Aparecem no rodapé e nos e-mails</small></div>
          <div className="p-form p-form--2">
            <label className="p-campo"><span>Nome da loja</span><input className="p-input" disabled={!souAdmin} value={a.loja.nome} onChange={(e) => muda("loja", "nome", e.target.value)} /></label>
            <label className="p-campo"><span>CNPJ</span><input className="p-input" disabled={!souAdmin} value={a.loja.cnpj} onChange={(e) => muda("loja", "cnpj", e.target.value)} /></label>
            <label className="p-campo p-cheio"><span>Razão social</span><input className="p-input" disabled={!souAdmin} value={a.loja.razao_social} onChange={(e) => muda("loja", "razao_social", e.target.value)} /></label>
            <label className="p-campo"><span>WhatsApp (com DDD)</span><input className="p-input" disabled={!souAdmin} value={a.loja.whatsapp} onChange={(e) => muda("loja", "whatsapp", e.target.value.replace(/\D/g, ""))} /></label>
            <label className="p-campo"><span>E-mail de atendimento</span><input className="p-input" type="email" disabled={!souAdmin} value={a.loja.email} onChange={(e) => muda("loja", "email", e.target.value)} /></label>
          </div>
        </section>

        <section className="p-card p-entra" style={{ "--i": 4 } as React.CSSProperties}>
          <div className="p-card__cab">
            <h2>Quem entra no painel</h2>
            {souAdmin && <button type="button" className="p-btn p-btn--vidro p-btn--p" onClick={() => setNovo({ email: "", nome: "", senha: "", papel: "operador" })}><Icone n="mais" /> Adicionar</button>}
          </div>
          <ul className="p-lista">
            {admins.map((u) => (
              <li key={u.user_id}>
                <span className="p-eu__ini" style={{ background: u.ativo ? undefined : "var(--prata)" }}>{u.nome.split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase()}</span>
                <div className="p-lista__txt"><b>{u.nome}{u.user_id === euId ? " (você)" : ""}</b><small>{u.email} · {u.papel === "admin" ? "Administrador" : "Operador (não muda ajustes)"}</small></div>
                {souAdmin && u.user_id !== euId && (
                  <label className="p-chave" title={u.ativo ? "Tirar acesso" : "Devolver acesso"}>
                    <input type="checkbox" checked={u.ativo} aria-label={`Acesso de ${u.nome}`}
                      onChange={(e) => { const v = e.target.checked; comecar(async () => { const r = await alternarAdmin(u.user_id, v); avisar(r.ok ? (v ? "Acesso devolvido" : "Acesso tirado") : r.erro, !r.ok); router.refresh(); }); }} />
                    <i />
                  </label>
                )}
              </li>
            ))}
          </ul>
        </section>
      </div>

      {souAdmin && mudou && (
        <div className="p-salvar-barra vidro">
          <span>{mudou ? "Alterações não salvas" : "Tudo salvo"}</span>
          <button type="button" className="p-btn p-btn--vermelho" disabled={indo || !mudou} onClick={salvar}>{indo ? <span className="p-girando" /> : <><Icone n="check" /> Salvar ajustes</>}</button>
        </div>
      )}

      {novo && (
        <>
          <div className="p-veu" onClick={() => !indo && setNovo(null)} />
          <form className="p-janela vidro" role="dialog" aria-modal="true"
            onSubmit={(e) => { e.preventDefault(); comecar(async () => { const r = await convidarAdmin(novo.email, novo.nome, novo.senha, novo.papel); avisar(r.ok ? "Acesso criado" : r.erro, !r.ok); if (r.ok) { setNovo(null); router.refresh(); } }); }}>
            <h2>Novo acesso ao painel</h2>
            <p>Passe o e-mail e a senha pra pessoa. Ela pode trocar a senha em &quot;Esqueci a senha&quot;.</p>
            <div className="p-form">
              <label className="p-campo"><span>Nome</span><input className="p-input" autoFocus value={novo.nome} onChange={(e) => setNovo({ ...novo, nome: e.target.value })} /></label>
              <label className="p-campo"><span>E-mail</span><input className="p-input" type="email" value={novo.email} onChange={(e) => setNovo({ ...novo, email: e.target.value })} /></label>
              <label className="p-campo"><span>Senha provisória</span><input className="p-input" value={novo.senha} onChange={(e) => setNovo({ ...novo, senha: e.target.value })} placeholder="Pelo menos 8 caracteres" /></label>
              <div className="p-abas vidro" role="tablist" style={{ width: "fit-content" }}>
                <button type="button" role="tab" aria-selected={novo.papel === "operador"} onClick={() => setNovo({ ...novo, papel: "operador" })}>Operador</button>
                <button type="button" role="tab" aria-selected={novo.papel === "admin"} onClick={() => setNovo({ ...novo, papel: "admin" })}>Administrador</button>
              </div>
            </div>
            <div className="p-janela__acoes">
              <button type="button" className="p-btn p-btn--fantasma" onClick={() => setNovo(null)}>Voltar</button>
              <button className="p-btn p-btn--vermelho" disabled={indo}>{indo ? <span className="p-girando" /> : "Criar acesso"}</button>
            </div>
          </form>
        </>
      )}
    </>
  );
}
