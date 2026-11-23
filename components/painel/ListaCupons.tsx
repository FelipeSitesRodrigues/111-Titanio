"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Icone } from "./Icone";
import { useAviso } from "./Avisos";
import { alternarCupom, excluirCupom, salvarCupom, type CupomForm } from "@/app/painel/acoes/loja";

export type Cupom = { codigo: string; descricao: string | null; tipo: "percentual" | "valor"; valor: number; minimo_centavos: number;
  valido_de: string | null; valido_ate: string | null; limite_usos: number | null; usos: number; ativo: boolean; vendas_centavos: number };

const brl = (c: number) => (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dia = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" }) : "");
const diaBR = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "");

function situacao(c: Cupom) {
  const agora = Date.now();
  if (!c.ativo) return { nome: "Desativado", cor: "neutro" };
  if (c.valido_ate && new Date(c.valido_ate).getTime() < agora) return { nome: "Vencido", cor: "neutro" };
  if (c.valido_de && new Date(c.valido_de).getTime() > agora) return { nome: "Agendado", cor: "info" };
  if (c.limite_usos && c.usos >= c.limite_usos) return { nome: "Esgotado", cor: "alerta" };
  return { nome: "Valendo", cor: "ok" };
}

const VAZIO: CupomForm = { codigo: "", novo: true, descricao: "", tipo: "percentual", valor: "", minimo: "", valido_de: "", valido_ate: "", limite_usos: "", ativo: true };

export function ListaCupons({ cupons }: { cupons: Cupom[] }) {
  const [ed, setEd] = useState<CupomForm | null>(null);
  const [indo, comecar] = useTransition();
  const avisar = useAviso();
  const router = useRouter();
  const editar = (c: Cupom) => setEd({
    codigo: c.codigo, novo: false, descricao: c.descricao ?? "", tipo: c.tipo,
    valor: c.tipo === "percentual" ? String(c.valor) : (c.valor / 100).toFixed(2).replace(".", ","),
    minimo: c.minimo_centavos ? (c.minimo_centavos / 100).toFixed(2).replace(".", ",") : "",
    valido_de: dia(c.valido_de), valido_ate: dia(c.valido_ate), limite_usos: c.limite_usos ? String(c.limite_usos) : "", ativo: c.ativo,
  });

  return (
    <>
      <div className="p-cabeca">
        <div className="p-entra"><h1>Cupons</h1><p>Códigos de desconto que o cliente digita no checkout.</p></div>
        <div className="p-cabeca__acoes p-entra" style={{ "--i": 1 } as React.CSSProperties}>
          <button className="p-btn p-btn--vermelho" onClick={() => setEd({ ...VAZIO })}><Icone n="mais" /> Novo cupom</button>
        </div>
      </div>

      <div className="p-card p-entra" style={{ "--i": 2 } as React.CSSProperties}>
        {cupons.length === 0 ? (
          <div className="p-vazio"><Icone n="cupons" /><b>Nenhum cupom ainda</b>Crie o primeiro, por exemplo um de boas-vindas.</div>
        ) : (
          <div className="p-tabela-caixa">
            <table className="p-tabela">
              <thead><tr><th>Código</th><th>Desconto</th><th>Regras</th><th className="num">Usos</th><th className="num">Vendeu</th><th>Situação</th><th /></tr></thead>
              <tbody>
                {cupons.map((c) => {
                  const s = situacao(c);
                  return (
                    <tr key={c.codigo} className="p-clicavel" onClick={() => editar(c)}>
                      <td><b style={{ fontFamily: "ui-monospace, monospace", letterSpacing: ".04em" }}>{c.codigo}</b>{c.descricao && <div className="fraco">{c.descricao}</div>}</td>
                      <td><b>{c.tipo === "percentual" ? `${c.valor}%` : brl(c.valor)}</b></td>
                      <td className="fraco" style={{ whiteSpace: "normal" }}>
                        {[c.minimo_centavos ? `acima de ${brl(c.minimo_centavos)}` : "", c.valido_ate ? `até ${diaBR(c.valido_ate)}` : "", c.valido_de && new Date(c.valido_de).getTime() > Date.now() ? `a partir de ${diaBR(c.valido_de)}` : ""].filter(Boolean).join(" · ") || "Sem regras"}
                      </td>
                      <td className="num">{c.usos}{c.limite_usos ? ` / ${c.limite_usos}` : ""}</td>
                      <td className="num">{brl(c.vendas_centavos)}</td>
                      <td><span className={`p-selo p-selo--${s.cor}`}>{s.nome}</span></td>
                      <td onClick={(e) => e.stopPropagation()}>
                        <label className="p-chave" title={c.ativo ? "Desativar" : "Ativar"}>
                          <input type="checkbox" checked={c.ativo} aria-label={`Cupom ${c.codigo} ativo`}
                            onChange={(e) => { const v = e.target.checked; comecar(async () => { const r = await alternarCupom(c.codigo, v); avisar(r.ok ? (v ? "Cupom ativado" : "Cupom desativado") : r.erro, !r.ok); router.refresh(); }); }} />
                          <i />
                        </label>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {ed && (
        <>
          <div className="p-veu" onClick={() => !indo && setEd(null)} />
          <form className="p-janela vidro" role="dialog" aria-modal="true" style={{ width: "min(560px, calc(100vw - 32px))" }}
            onSubmit={(e) => { e.preventDefault(); comecar(async () => { const r = await salvarCupom(ed); if (!r.ok) { avisar(r.erro, true); return; } avisar(ed.novo ? "Cupom criado" : "Cupom salvo"); setEd(null); router.refresh(); }); }}>
            <h2>{ed.novo ? "Novo cupom" : `Cupom ${ed.codigo}`}</h2>
            <p>O desconto vale sobre os produtos, antes do frete. O desconto do Pix entra depois do cupom.</p>
            <div className="p-form p-form--2">
              <label className="p-campo">
                <span>Código</span>
                <input className="p-input" autoFocus={ed.novo} readOnly={!ed.novo} value={ed.codigo} onChange={(e) => setEd({ ...ed, codigo: e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, "") })} placeholder="BEMVINDO10" style={{ fontFamily: "ui-monospace, monospace", letterSpacing: ".04em" }} />
              </label>
              <label className="p-campo">
                <span>Descrição (só o painel vê)</span>
                <input className="p-input" value={ed.descricao} onChange={(e) => setEd({ ...ed, descricao: e.target.value })} placeholder="Ex.: Instagram de novembro" />
              </label>
              <div className="p-campo p-cheio">
                <span>Tipo de desconto</span>
                <div className="p-abas vidro" role="tablist" style={{ width: "fit-content" }}>
                  <button type="button" role="tab" aria-selected={ed.tipo === "percentual"} onClick={() => setEd({ ...ed, tipo: "percentual" })}>Porcentagem</button>
                  <button type="button" role="tab" aria-selected={ed.tipo === "valor"} onClick={() => setEd({ ...ed, tipo: "valor" })}>Valor fixo</button>
                </div>
              </div>
              <label className="p-campo">
                <span>{ed.tipo === "percentual" ? "Desconto (%)" : "Desconto (R$)"}</span>
                <div className="p-prefixo"><b>{ed.tipo === "percentual" ? "%" : "R$"}</b><input className="p-input" inputMode="decimal" value={ed.valor} onChange={(e) => setEd({ ...ed, valor: e.target.value })} placeholder={ed.tipo === "percentual" ? "10" : "50,00"} /></div>
              </label>
              <label className="p-campo">
                <span>Pedido mínimo</span>
                <div className="p-prefixo"><b>R$</b><input className="p-input" inputMode="decimal" value={ed.minimo} onChange={(e) => setEd({ ...ed, minimo: e.target.value })} placeholder="Sem mínimo" /></div>
              </label>
              <label className="p-campo"><span>Começa em</span><input className="p-input" type="date" value={ed.valido_de} onChange={(e) => setEd({ ...ed, valido_de: e.target.value })} /></label>
              <label className="p-campo"><span>Termina em</span><input className="p-input" type="date" value={ed.valido_ate} onChange={(e) => setEd({ ...ed, valido_ate: e.target.value })} /></label>
              <label className="p-campo"><span>Limite de usos</span><input className="p-input" type="number" min={1} value={ed.limite_usos} onChange={(e) => setEd({ ...ed, limite_usos: e.target.value })} placeholder="Sem limite" /></label>
              <label className="p-chave" style={{ alignSelf: "end", height: 44 }}><input type="checkbox" checked={ed.ativo} onChange={(e) => setEd({ ...ed, ativo: e.target.checked })} /><i />Ativo</label>
            </div>
            <div className="p-janela__acoes" style={{ justifyContent: "space-between" }}>
              {!ed.novo ? (
                <button type="button" className="p-btn p-btn--perigo" disabled={indo} onClick={() => {
                  if (!confirm(`Excluir o cupom ${ed.codigo}?`)) return;
                  comecar(async () => { const r = await excluirCupom(ed.codigo); avisar(r.ok ? "Cupom excluído" : r.erro, !r.ok); if (r.ok) { setEd(null); router.refresh(); } });
                }}><Icone n="lixo" /> Excluir</button>
              ) : <span />}
              <div style={{ display: "flex", gap: 10 }}>
                <button type="button" className="p-btn p-btn--fantasma" onClick={() => setEd(null)}>Voltar</button>
                <button className="p-btn p-btn--vermelho" disabled={indo}>{indo ? <span className="p-girando" /> : "Salvar"}</button>
              </div>
            </div>
          </form>
        </>
      )}
    </>
  );
}
