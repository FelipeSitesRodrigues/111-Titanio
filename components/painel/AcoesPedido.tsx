"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Icone } from "./Icone";
import { useAviso } from "./Avisos";
import { cancelarPedido, estornarPedido, mudarStatus, salvarObservacao } from "@/app/painel/acoes/pedidos";

type Janela = null | "enviar" | "cancelar" | "estornar";

export function AcoesPedido({ numero, status, metodo }: { numero: number; status: string; metodo: string }) {
  const [janela, setJanela] = useState<Janela>(null);
  const [texto, setTexto] = useState("");
  const [indo, comecar] = useTransition();
  const avisar = useAviso();
  const router = useRouter();

  const rodar = (acao: () => Promise<{ ok: boolean; erro?: string }>, ok: string) =>
    comecar(async () => {
      const r = await acao();
      if (!r.ok) { avisar(r.erro ?? "Não deu certo.", true); return; }
      setJanela(null); setTexto("");
      avisar(ok);
      router.refresh();
    });

  const pago = ["pago", "separando", "enviado", "entregue"].includes(status);
  return (
    <>
      <div className="p-cabeca__acoes">
        {status === "pago" && (
          <button className="p-btn p-btn--vidro" disabled={indo} onClick={() => rodar(() => mudarStatus(numero, "separando"), "Pedido em separação")}>
            <Icone n="caixa" /> Separar
          </button>
        )}
        {(status === "pago" || status === "separando") && (
          <button className="p-btn p-btn--vermelho" disabled={indo} onClick={() => setJanela("enviar")}><Icone n="caminhao" /> Marcar como enviado</button>
        )}
        {status === "enviado" && (
          <button className="p-btn p-btn--vermelho" disabled={indo} onClick={() => rodar(() => mudarStatus(numero, "entregue"), "Pedido entregue")}>
            <Icone n="check" /> Marcar como entregue
          </button>
        )}
        {(status === "aguardando_pagamento" || status === "pago" || status === "separando") && (
          <button className="p-btn p-btn--fantasma" disabled={indo} onClick={() => setJanela(pago ? "estornar" : "cancelar")}>
            {pago ? "Cancelar e estornar" : "Cancelar"}
          </button>
        )}
        {(status === "enviado" || status === "entregue") && (
          <button className="p-btn p-btn--fantasma" disabled={indo} onClick={() => setJanela("estornar")}>Estornar</button>
        )}
      </div>

      {janela && (
        <>
          <div className="p-veu" onClick={() => !indo && setJanela(null)} />
          <div className="p-janela vidro" role="dialog" aria-modal="true" aria-labelledby="janela-titulo">
            {janela === "enviar" ? (
              <form onSubmit={(e) => { e.preventDefault(); rodar(() => mudarStatus(numero, "enviado", texto), "Pedido enviado"); }}>
                <h2 id="janela-titulo">Pedido #{numero} enviado</h2>
                <p>O código de rastreio aparece pro cliente acompanhar a entrega.</p>
                <label className="p-campo">
                  <span>Código de rastreio</span>
                  <input className="p-input" autoFocus required value={texto} onChange={(e) => setTexto(e.target.value.toUpperCase())} placeholder="Ex.: AB123456789BR" />
                </label>
                <div className="p-janela__acoes">
                  <button type="button" className="p-btn p-btn--fantasma" onClick={() => setJanela(null)}>Voltar</button>
                  <button className="p-btn p-btn--vermelho" disabled={indo || !texto.trim()}>{indo ? <span className="p-girando" /> : "Confirmar envio"}</button>
                </div>
              </form>
            ) : (
              <form onSubmit={(e) => {
                e.preventDefault();
                rodar(() => (janela === "estornar" ? estornarPedido(numero, texto) : cancelarPedido(numero, texto)), janela === "estornar" ? "Pedido estornado" : "Pedido cancelado");
              }}>
                <h2 id="janela-titulo">{janela === "estornar" ? `Estornar o pedido #${numero}?` : `Cancelar o pedido #${numero}?`}</h2>
                <p>
                  {janela === "estornar"
                    ? `O valor volta pro cliente ${metodo === "pix" ? "pela Stripe (Pix devolvido na conta dele)" : "no cartão, pela Stripe"}. Se o produto ainda não saiu, o estoque volta.`
                    : "O pedido não foi pago. O estoque separado volta pra loja."}
                </p>
                <label className="p-campo">
                  <span>Motivo (só o painel vê)</span>
                  <input className="p-input" autoFocus value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Ex.: cliente desistiu" />
                </label>
                <div className="p-janela__acoes">
                  <button type="button" className="p-btn p-btn--fantasma" onClick={() => setJanela(null)}>Voltar</button>
                  <button className="p-btn p-btn--perigo" disabled={indo}>{indo ? <span className="p-girando" /> : janela === "estornar" ? "Estornar" : "Cancelar pedido"}</button>
                </div>
              </form>
            )}
          </div>
        </>
      )}
    </>
  );
}

export function Observacao({ numero, inicial }: { numero: number; inicial: string }) {
  const [texto, setTexto] = useState(inicial);
  const [indo, comecar] = useTransition();
  const avisar = useAviso();
  const mudou = texto !== inicial;
  return (
    <div className="p-campo">
      <textarea className="p-input" value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Anotações internas sobre esse pedido" style={{ minHeight: 90 }} />
      {mudou && (
        <button className="p-btn p-btn--vidro p-btn--p" style={{ alignSelf: "flex-end" }} disabled={indo}
          onClick={() => comecar(async () => { const r = await salvarObservacao(numero, texto); avisar(r.ok ? "Anotação salva" : "Não salvou", !r.ok); })}>
          {indo ? <span className="p-girando" /> : "Salvar anotação"}
        </button>
      )}
    </div>
  );
}
