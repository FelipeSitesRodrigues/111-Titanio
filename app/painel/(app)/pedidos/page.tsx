import Link from "next/link";
import { connection } from "next/server";
import { exigirAdmin } from "@/lib/painel/sessao";
import { rpc } from "@/lib/painel/rpc";
import { lerPeriodo, somarDias } from "@/lib/painel/periodo";
import { brl, dataHora, inicioDoDia, METODO, STATUS, type Status } from "@/lib/painel/formato";
import { Icone } from "@/components/painel/Icone";
import Periodo from "@/components/painel/Periodo";

export const metadata = { title: "Pedidos" };

const ABAS: { chave: string; nome: string; status: Status[] | null }[] = [
  { chave: "", nome: "Todos", status: null },
  { chave: "a-enviar", nome: "A enviar", status: ["pago", "separando"] },
  { chave: "aguardando", nome: "Aguardando pagamento", status: ["aguardando_pagamento"] },
  { chave: "enviados", nome: "Enviados", status: ["enviado"] },
  { chave: "entregues", nome: "Entregues", status: ["entregue"] },
  { chave: "cancelados", nome: "Cancelados", status: ["cancelado", "expirado", "estornado"] },
];
const POR_PAGINA = 25;

type Linha = { numero: number; status: Status; metodo: string; parcelas: number; total_centavos: number; criado_em: string;
  cliente_nome: string; cliente_email: string; cidade: string; uf: string; itens: number; foto: string | null; exemplo: boolean };

export default async function Pedidos({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await exigirAdmin();
  await connection();
  const q = await searchParams;
  const aba = ABAS.find((a) => a.chave === (q.status ?? "")) ?? ABAS[0];
  const comPeriodo = Boolean(q.periodo || (q.de && q.ate));
  const per = { ...lerPeriodo(q), todos: !comPeriodo };
  const pagina = Math.max(1, Number(q.pagina) || 1);
  const r = await rpc<{ total: number; contagem: Record<string, number>; linhas: Linha[] }>("painel_pedidos", {
    p_status: aba.status, p_busca: q.q ?? "",
    p_de: comPeriodo ? inicioDoDia(per.de) : null, p_ate: comPeriodo ? inicioDoDia(somarDias(per.ate, 1)) : null,
    p_limite: POR_PAGINA, p_pular: (pagina - 1) * POR_PAGINA,
  });
  const conta = (a: (typeof ABAS)[number]) => (a.status ? a.status.reduce((s, st) => s + (r.contagem[st] ?? 0), 0) : Object.values(r.contagem).reduce((s, n) => s + n, 0));
  const link = (mudar: Record<string, string | undefined>) => {
    const u = new URLSearchParams(Object.entries({ ...q, ...mudar }).filter(([, v]) => v) as [string, string][]);
    if (!("pagina" in mudar)) u.delete("pagina");
    const s = u.toString();
    return `/painel/pedidos${s ? `?${s}` : ""}`;
  };
  const paginas = Math.max(1, Math.ceil(r.total / POR_PAGINA));

  return (
    <>
      <div className="p-cabeca">
        <div className="p-entra"><h1>Pedidos</h1><p>{r.total} {r.total === 1 ? "pedido" : "pedidos"}{aba.status ? ` em "${aba.nome}"` : ""}{q.q ? ` com "${q.q}"` : ""}</p></div>
        <div className="p-cabeca__acoes p-entra" style={{ "--i": 1 } as React.CSSProperties}>
          <Periodo per={per} />
          {comPeriodo && <Link className="p-btn p-btn--fantasma" href={link({ periodo: undefined, de: undefined, ate: undefined, comparar: undefined })}>Todo o período</Link>}
        </div>
      </div>

      <div className="p-entra" style={{ "--i": 2, display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center", marginBottom: 16 } as React.CSSProperties}>
        <nav className="p-abas vidro" aria-label="Filtrar por situação">
          {ABAS.map((a) => (
            <Link key={a.chave} href={link({ status: a.chave || undefined })} aria-current={a === aba ? "page" : undefined}>
              {a.nome} <b>{conta(a)}</b>
            </Link>
          ))}
        </nav>
        <form className="p-busca" action="/painel/pedidos">
          <Icone n="busca" />
          {Object.entries(q).filter(([k, v]) => v && !["q", "pagina"].includes(k)).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
          <input className="p-input" name="q" defaultValue={q.q ?? ""} placeholder="Nº do pedido, nome, e-mail ou CPF" aria-label="Buscar pedido" />
        </form>
      </div>

      <div className="p-card p-entra" style={{ "--i": 3 } as React.CSSProperties}>
        {r.linhas.length === 0 ? (
          <div className="p-vazio"><Icone n="pedidos" /><b>Nenhum pedido aqui</b>Troque a aba, a busca ou o período.</div>
        ) : (
          <div className="p-tabela-caixa">
            <table className="p-tabela">
              <thead><tr><th>Pedido</th><th>Cliente</th><th>Itens</th><th>Pagamento</th><th>Situação</th><th className="num">Total</th></tr></thead>
              <tbody>
                {r.linhas.map((p) => {
                  const st = STATUS[p.status];
                  return (
                    <tr key={p.numero}>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                          {p.foto ? <img className="p-lista__foto" src={p.foto} alt="" /> : <span className="p-lista__foto" />}
                          <div><Link className="p-linha" href={`/painel/pedidos/${p.numero}`}>#{p.numero}</Link><div className="fraco">{dataHora(p.criado_em)}</div></div>
                        </div>
                      </td>
                      <td><div>{p.cliente_nome}</div><div className="fraco">{p.cidade}/{p.uf}{p.exemplo ? " · exemplo" : ""}</div></td>
                      <td>{p.itens}</td>
                      <td>{METODO[p.metodo]}{p.metodo === "cartao" && p.parcelas > 1 ? ` ${p.parcelas}x` : ""}</td>
                      <td><span className={`p-selo p-selo--${st.cor}`}>{st.nome}</span></td>
                      <td className="num"><b>{brl(p.total_centavos)}</b></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {paginas > 1 && (
        <div className="p-paginas">
          <span>Página {pagina} de {paginas}</span>
          <div>
            {pagina > 1 && <Link className="p-btn p-btn--vidro p-btn--p" href={link({ pagina: String(pagina - 1) })}><Icone n="voltar" /> Anterior</Link>}
            {pagina < paginas && <Link className="p-btn p-btn--vidro p-btn--p" href={link({ pagina: String(pagina + 1) })}>Próxima <Icone n="avancar" /></Link>}
          </div>
        </div>
      )}
    </>
  );
}

// painel: depende do login, renderiza na hora (sem casca estática)
export const instant = false;
