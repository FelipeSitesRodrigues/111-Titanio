import Link from "next/link";
import { notFound } from "next/navigation";
import { exigirAdmin } from "@/lib/painel/sessao";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { brl, dataHora, METODO, STATUS, type Status } from "@/lib/painel/formato";
import { Icone } from "@/components/painel/Icone";
import { AcoesPedido, Observacao } from "@/components/painel/AcoesPedido";

type Pedido = {
  id: string; numero: number; status: Status; metodo: string; parcelas: number; subtotal_centavos: number; desconto_pix_centavos: number;
  desconto_cupom_centavos: number; frete_centavos: number; total_centavos: number; cupom_codigo: string | null;
  endereco: { cep: string; rua: string; numero: string; comp?: string; bairro: string; cidade: string; uf: string };
  frete: { regiao?: string; prazo_dias?: number; gratis?: boolean } | null; rastreio: string | null; observacao: string | null;
  stripe_pi: string | null; exemplo: boolean; criado_em: string; pago_em: string | null; separado_em: string | null; enviado_em: string | null;
  entregue_em: string | null; cancelado_em: string | null;
  clientes: { id: string; nome: string; email: string; cpf: string | null; telefone: string | null };
  pedido_itens: { id: string; produto_id: string | null; produto_nome: string; variante_nome: string; foto: string | null; quantidade: number; preco_unit_centavos: number }[];
};

export async function generateMetadata({ params }: { params: Promise<{ numero: string }> }) {
  return { title: `Pedido #${(await params).numero}` };
}

export default async function PedidoPagina({ params }: { params: Promise<{ numero: string }> }) {
  await exigirAdmin();
  const numero = Number((await params).numero);
  if (!Number.isInteger(numero)) notFound();
  const { data } = await supabaseAdmin().from("pedidos").select("*, clientes(id, nome, email, cpf, telefone), pedido_itens(*)").eq("numero", numero).maybeSingle();
  if (!data) notFound();
  const p = data as Pedido;
  const st = STATUS[p.status];
  const c = p.clientes;
  const e = p.endereco;
  const fone = (c.telefone ?? "").replace(/\D/g, "");
  const wa = fone ? `https://wa.me/${fone.length <= 11 ? "55" + fone : fone}?text=${encodeURIComponent(`Olá, ${c.nome.split(" ")[0]}! Aqui é da Titânio Importes, sobre o seu pedido #${p.numero}.`)}` : null;
  const cancelado = ["cancelado", "expirado", "estornado"].includes(p.status);

  const etapas = [
    { nome: "Pedido feito", quando: p.criado_em },
    { nome: "Pagamento aprovado", quando: p.pago_em },
    { nome: "Separado", quando: p.separado_em },
    { nome: "Enviado", quando: p.enviado_em, extra: p.rastreio ? `Rastreio ${p.rastreio}` : undefined },
    { nome: "Entregue", quando: p.entregue_em },
  ].filter((x, i) => !(i === 2 && !x.quando && p.enviado_em)); // pulou a separação
  const atual = etapas.findIndex((x) => !x.quando);

  return (
    <>
      <Link href="/painel/pedidos" className="p-voltar"><Icone n="voltar" /> Pedidos</Link>
      <div className="p-cabeca">
        <div className="p-entra">
          <h1 style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
            Pedido #{p.numero} <span className={`p-selo p-selo--${st.cor}`} style={{ fontSize: 13, height: 28, letterSpacing: 0, textTransform: "none", fontStretch: "100%" }}>{st.nome}</span>
          </h1>
          <p>Feito em {dataHora(p.criado_em)}{p.exemplo ? " · pedido de exemplo" : ""}</p>
        </div>
        <div className="p-entra" style={{ "--i": 1 } as React.CSSProperties}>
          <AcoesPedido numero={p.numero} status={p.status} metodo={p.metodo} />
        </div>
      </div>

      <div className="p-grade p-duas">
        <div className="p-grade" style={{ alignContent: "start" }}>
          <section className="p-card p-entra" style={{ "--i": 2 } as React.CSSProperties}>
            <div className="p-card__cab"><h2>Itens</h2><span className="fraco" style={{ color: "var(--texto-2)", fontSize: 13 }}>{p.pedido_itens.reduce((s, i) => s + i.quantidade, 0)} un.</span></div>
            <ul className="p-lista">
              {p.pedido_itens.map((i) => (
                <li key={i.id}>
                  {i.foto ? <img className="p-lista__foto" src={i.foto} alt="" style={{ width: 56, height: 56 }} /> : <span className="p-lista__foto" />}
                  <div className="p-lista__txt">
                    {i.produto_id ? <Link href={`/painel/produtos/${i.produto_id}`}><b style={{ whiteSpace: "normal" }}>{i.produto_nome}</b></Link> : <b>{i.produto_nome}</b>}
                    <small>{i.variante_nome !== "Único" ? `${i.variante_nome} · ` : ""}{i.quantidade} × {brl(i.preco_unit_centavos)}</small>
                  </div>
                  <span className="p-lista__val">{brl(i.quantidade * i.preco_unit_centavos)}</span>
                </li>
              ))}
            </ul>
            <div className="p-contas">
              <div><span>Subtotal</span><span>{brl(p.subtotal_centavos)}</span></div>
              {p.desconto_cupom_centavos > 0 && <div className="desc"><span>Cupom {p.cupom_codigo}</span><span>− {brl(p.desconto_cupom_centavos)}</span></div>}
              {p.desconto_pix_centavos > 0 && <div className="desc"><span>Desconto Pix</span><span>− {brl(p.desconto_pix_centavos)}</span></div>}
              <div><span>Frete{p.frete?.gratis ? " (grátis)" : ""}{p.frete?.prazo_dias ? ` · até ${p.frete.prazo_dias} dias úteis` : ""}</span><span>{brl(p.frete_centavos)}</span></div>
              <div className="total"><span>Total</span><span>{brl(p.total_centavos)}</span></div>
              <div style={{ color: "var(--texto-2)", fontSize: 13 }}>
                <span>{METODO[p.metodo]}{p.metodo === "cartao" ? ` em ${p.parcelas}x ${p.parcelas > 1 ? `de ${brl(Math.round(p.total_centavos / p.parcelas))}` : ""}` : ""}</span>
                <span>{p.stripe_pi && !p.stripe_pi.startsWith("pi_exemplo") ? p.stripe_pi : ""}</span>
              </div>
            </div>
          </section>

          <section className="p-card p-entra" style={{ "--i": 4 } as React.CSSProperties}>
            <div className="p-card__cab"><h2>Anotações</h2></div>
            <Observacao numero={p.numero} inicial={p.observacao ?? ""} />
          </section>
        </div>

        <div className="p-grade" style={{ alignContent: "start" }}>
          <section className="p-card p-entra" style={{ "--i": 3 } as React.CSSProperties}>
            <div className="p-card__cab"><h2>Andamento</h2></div>
            {cancelado ? (
              <ol className="p-tempo">
                <li className="feito"><i><Icone n="check" /></i><div><b>Pedido feito</b><small>{dataHora(p.criado_em)}</small></div></li>
                {p.pago_em && <li className="feito"><i><Icone n="check" /></i><div><b>Pagamento aprovado</b><small>{dataHora(p.pago_em)}</small></div></li>}
                <li className="atual"><i><Icone n="x" /></i><div><b>{st.nome}</b><small>{dataHora(p.cancelado_em)}</small></div></li>
              </ol>
            ) : (
              <ol className="p-tempo">
                {etapas.map((x, i) => (
                  <li key={x.nome} className={x.quando ? "feito" : i === atual ? "atual" : ""}>
                    <i>{x.quando ? <Icone n="check" /> : null}</i>
                    <div><b>{x.nome}</b><small>{x.quando ? dataHora(x.quando) : i === atual ? "Próxima etapa" : ""}{x.extra && x.quando ? ` · ${x.extra}` : ""}</small></div>
                  </li>
                ))}
              </ol>
            )}
          </section>

          <section className="p-card p-entra" style={{ "--i": 5 } as React.CSSProperties}>
            <div className="p-card__cab"><h2>Cliente</h2><Link href={`/painel/clientes/${c.id}`}>Ver cliente</Link></div>
            <dl className="p-dados">
              <dt>Nome</dt><dd>{c.nome}</dd>
              <dt>E-mail</dt><dd><a href={`mailto:${c.email}`}>{c.email}</a></dd>
              {c.cpf && (<><dt>CPF</dt><dd>{c.cpf}</dd></>)}
              {c.telefone && (<><dt>Telefone</dt><dd>{c.telefone}</dd></>)}
            </dl>
            {wa && <a className="p-btn p-btn--vidro" style={{ width: "100%", marginTop: 16 }} href={wa} target="_blank" rel="noopener"><Icone n="whats" /> Chamar no WhatsApp</a>}
          </section>

          <section className="p-card p-entra" style={{ "--i": 6 } as React.CSSProperties}>
            <div className="p-card__cab"><h2>Entrega</h2></div>
            <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6 }}>
              {e.rua}, {e.numero}{e.comp ? ` · ${e.comp}` : ""}<br />{e.bairro}, {e.cidade}/{e.uf}<br />CEP {e.cep?.replace(/(\d{5})(\d{3})/, "$1-$2")}
            </p>
          </section>
        </div>
      </div>
    </>
  );
}

// painel: depende do login, renderiza na hora (sem casca estática)
export const instant = false;
