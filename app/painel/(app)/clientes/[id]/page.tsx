import Link from "next/link";
import { notFound } from "next/navigation";
import { exigirAdmin } from "@/lib/painel/sessao";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { brl, data, dataHora, STATUS, type Status } from "@/lib/painel/formato";
import { Icone } from "@/components/painel/Icone";

export const metadata = { title: "Cliente" };

export default async function Cliente({ params }: { params: Promise<{ id: string }> }) {
  await exigirAdmin();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const { data: c } = await supabaseAdmin().from("clientes")
    .select("*, pedidos(numero, status, total_centavos, criado_em, metodo, endereco)").eq("id", id).maybeSingle();
  if (!c) notFound();
  const pedidos = [...(c.pedidos as { numero: number; status: Status; total_centavos: number; criado_em: string; metodo: string; endereco: { cidade: string; uf: string } }[])]
    .sort((a, b) => b.criado_em.localeCompare(a.criado_em));
  const pagos = pedidos.filter((p) => ["pago", "separando", "enviado", "entregue"].includes(p.status));
  const gasto = pagos.reduce((s, p) => s + p.total_centavos, 0);
  const fone = (c.telefone ?? "").replace(/\D/g, "");

  return (
    <>
      <Link href="/painel/clientes" className="p-voltar"><Icone n="voltar" /> Clientes</Link>
      <div className="p-cabeca">
        <div className="p-entra"><h1>{c.nome}</h1><p>Cliente desde {data(c.criado_em)}{pedidos[0]?.endereco ? ` · ${pedidos[0].endereco.cidade}/${pedidos[0].endereco.uf}` : ""}</p></div>
        {fone && (
          <div className="p-cabeca__acoes p-entra" style={{ "--i": 1 } as React.CSSProperties}>
            <a className="p-btn p-btn--vidro" href={`https://wa.me/${fone.length <= 11 ? "55" + fone : fone}`} target="_blank" rel="noopener"><Icone n="whats" /> WhatsApp</a>
          </div>
        )}
      </div>

      <section className="p-grade p-kpis" style={{ marginBottom: 16 }}>
        <div className="p-card p-kpi p-kpi--destaque p-entra" style={{ "--i": 1 } as React.CSSProperties}><div className="p-kpi__nome"><Icone n="dinheiro" /> Total gasto</div><div className="p-kpi__valor">{brl(gasto)}</div></div>
        <div className="p-card p-kpi p-entra" style={{ "--i": 2 } as React.CSSProperties}><div className="p-kpi__nome"><Icone n="pedidos" /> Pedidos pagos</div><div className="p-kpi__valor">{pagos.length}</div></div>
        <div className="p-card p-kpi p-entra" style={{ "--i": 3 } as React.CSSProperties}><div className="p-kpi__nome"><Icone n="ticket" /> Ticket médio</div><div className="p-kpi__valor">{brl(pagos.length ? Math.round(gasto / pagos.length) : 0)}</div></div>
        <div className="p-card p-kpi p-entra" style={{ "--i": 4 } as React.CSSProperties}><div className="p-kpi__nome"><Icone n="clientes" /> Contato</div>
          <div style={{ marginTop: 10, fontSize: 13.5, overflowWrap: "anywhere" }}>{c.email}<br />{c.telefone}<br /><span style={{ color: "var(--texto-2)" }}>{c.quer_novidades ? "Aceita receber novidades" : "Não pediu novidades"}</span></div></div>
      </section>

      <div className="p-card p-entra" style={{ "--i": 5 } as React.CSSProperties}>
        <div className="p-card__cab"><h2>Pedidos</h2></div>
        <div className="p-tabela-caixa">
          <table className="p-tabela">
            <tbody>
              {pedidos.map((p) => {
                const st = STATUS[p.status];
                return (
                  <tr key={p.numero}>
                    <td><Link className="p-linha" href={`/painel/pedidos/${p.numero}`}>#{p.numero}</Link><div className="fraco">{dataHora(p.criado_em)}</div></td>
                    <td>{p.metodo === "pix" ? "Pix" : "Cartão"}</td>
                    <td><span className={`p-selo p-selo--${st.cor}`}>{st.nome}</span></td>
                    <td className="num"><b>{brl(p.total_centavos)}</b></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

// painel: depende do login, renderiza na hora (sem casca estática)
export const instant = false;
