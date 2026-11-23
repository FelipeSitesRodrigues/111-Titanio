import Link from "next/link";
import { connection } from "next/server";
import { exigirAdmin } from "@/lib/painel/sessao";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { lerPeriodo } from "@/lib/painel/periodo";
import { resumo, grao, serieCheia, type Resumo } from "@/lib/painel/resumo";
import { brl, dataHora, STATUS, type Status } from "@/lib/painel/formato";
import { Icone } from "@/components/painel/Icone";
import { TEXTO, turnoAgora } from "@/lib/painel/saudacao";
import { Numero } from "@/components/painel/Numero";
import Periodo from "@/components/painel/Periodo";

export const metadata = { title: "Início" };

type Busca = Promise<Record<string, string | undefined>>;

function Delta({ agora, antes, contra }: { agora: number; antes: number | undefined; contra: string }) {
  if (antes === undefined) return null;
  if (antes === 0 && agora === 0) return <span className="p-kpi__comp"><span className="p-delta p-delta--igual">igual</span> {contra}</span>;
  if (antes === 0) return <span className="p-kpi__comp"><span className="p-delta p-delta--sobe">novo</span> {contra}</span>;
  const pct = Math.round(((agora - antes) / antes) * 100);
  const tipo = pct > 0 ? "sobe" : pct < 0 ? "desce" : "igual";
  return (
    <span className="p-kpi__comp">
      <span className={`p-delta p-delta--${tipo}`}>{pct > 0 ? "↑" : pct < 0 ? "↓" : ""} {Math.abs(pct)}%</span> {contra}
    </span>
  );
}

export default async function Inicio({ searchParams }: { searchParams: Busca }) {
  const admin = await exigirAdmin();
  await connection(); // usa a hora de agora (hoje, saudação): sempre na hora do pedido
  const per = lerPeriodo(await searchParams);
  const g = grao(per.de, per.ate);
  const [r, antes, ultimos] = await Promise.all([
    resumo(per.de, per.ate, g),
    per.comparar ? resumo(per.antes.de, per.antes.ate, g) : Promise.resolve(undefined as Resumo | undefined),
    supabaseAdmin().from("pedidos").select("numero, status, total_centavos, criado_em, clientes(nome)").order("criado_em", { ascending: false }).limit(6),
  ]);
  const pontos = serieCheia(r, per.de, per.ate, g);
  const maior = Math.max(1, ...pontos.map((p) => p.centavos));
  const contra = per.comparar ? per.contra : "";
  const primeiroNome = admin.nome.split(" ")[0];
  const saudacao = TEXTO[turnoAgora()];
  const qs = new URLSearchParams({ de: per.de, ate: per.ate });

  return (
    <>
      <div className="p-cabeca">
        <div className="p-entra">
          <h1>{saudacao}, {primeiroNome}</h1>
          <p>
            {r.a_enviar > 0
              ? <>Tem <Link href="/painel/pedidos?status=a-enviar" style={{ color: "var(--vermelho)", fontWeight: 700 }}>{r.a_enviar} {r.a_enviar === 1 ? "pedido pago" : "pedidos pagos"}</Link> esperando envio.</>
              : "Nenhum pedido esperando envio."}
          </p>
        </div>
        <div className="p-cabeca__acoes p-entra" style={{ "--i": 1 } as React.CSSProperties}>
          <Periodo per={per} />
          <a className="p-btn p-btn--vidro" href={`/api/painel/relatorio?${qs}`}><Icone n="baixar" /> Planilha</a>
        </div>
      </div>

      <section className="p-grade p-kpis" aria-label="Números do período">
        <div className="p-card p-kpi p-kpi--destaque p-entra" style={{ "--i": 1 } as React.CSSProperties}>
          <div className="p-kpi__nome"><Icone n="dinheiro" /> Vendas</div>
          <div className="p-kpi__valor"><Numero valor={r.vendas_centavos} dinheiro /></div>
          <Delta agora={r.vendas_centavos} antes={antes?.vendas_centavos} contra={contra} />
        </div>
        <div className="p-card p-kpi p-entra" style={{ "--i": 2 } as React.CSSProperties}>
          <div className="p-kpi__nome"><Icone n="pedidos" /> Pedidos pagos</div>
          <div className="p-kpi__valor"><Numero valor={r.pedidos} /></div>
          <Delta agora={r.pedidos} antes={antes?.pedidos} contra={contra} />
        </div>
        <div className="p-card p-kpi p-entra" style={{ "--i": 3 } as React.CSSProperties}>
          <div className="p-kpi__nome"><Icone n="ticket" /> Ticket médio</div>
          <div className="p-kpi__valor"><Numero valor={r.ticket_centavos} dinheiro /></div>
          <Delta agora={r.ticket_centavos} antes={antes?.ticket_centavos} contra={contra} />
        </div>
        <div className="p-card p-kpi p-entra" style={{ "--i": 4 } as React.CSSProperties}>
          <div className="p-kpi__nome"><Icone n="caixa" /> Itens vendidos</div>
          <div className="p-kpi__valor"><Numero valor={r.itens} /></div>
          <Delta agora={r.itens} antes={antes?.itens} contra={contra} />
        </div>
      </section>

      <section className="p-grade p-duas" style={{ marginTop: 16 }}>
        <div className="p-card p-entra" style={{ "--i": 5 } as React.CSSProperties}>
          <div className="p-card__cab">
            <h2>Vendas {g === "hour" ? "por hora" : g === "day" ? "por dia" : "por semana"}</h2>
            {r.estornos_centavos > 0 && <span className="p-selo p-selo--erro">{brl(r.estornos_centavos)} estornados</span>}
          </div>
          <div className="p-graf" role="img" aria-label={`Gráfico de vendas, total ${brl(r.vendas_centavos)}`}>
            <div className="p-graf__linhas" aria-hidden="true">
              <span>{brl(maior)}</span><span>{brl(maior / 2)}</span><span />
            </div>
            {pontos.map((p, i) => (
              <div className="p-graf__col" key={p.chave}>
                <div
                  className={`p-graf__barra${p.centavos === 0 ? " p-graf__barra--zero" : ""}`}
                  style={{ height: `${(p.centavos / maior) * 100}%`, "--i": i } as React.CSSProperties}
                />
                <span className={`p-graf__dica${i < pontos.length * 0.3 ? " p-graf__dica--esq" : i > pontos.length * 0.7 ? " p-graf__dica--dir" : ""}`}>{p.rotulo}: {brl(p.centavos)} · {p.pedidos} {p.pedidos === 1 ? "pedido" : "pedidos"}</span>
              </div>
            ))}
          </div>
          <div className="p-graf__eixo" aria-hidden="true">
            <span>{pontos[0]?.rotulo}</span>
            {pontos.length > 2 && <span>{pontos[Math.floor(pontos.length / 2)]?.rotulo}</span>}
            <span>{pontos.at(-1)?.rotulo}</span>
          </div>
        </div>

        <div className="p-card p-entra" style={{ "--i": 6 } as React.CSSProperties}>
          <div className="p-card__cab"><h2>Mais vendidos</h2><Link href="/painel/produtos">Produtos</Link></div>
          {r.mais_vendidos.length === 0 ? (
            <div className="p-vazio" style={{ padding: "24px 0" }}><b>Sem vendas no período</b>Troque o período lá em cima.</div>
          ) : (
            <ul className="p-lista">
              {r.mais_vendidos.map((m) => (
                <li key={m.produto_id}>
                  {m.foto ? <img className="p-lista__foto" src={m.foto} alt="" /> : <span className="p-lista__foto" />}
                  <div className="p-lista__txt"><b>{m.nome}</b><small>{m.quantidade} {m.quantidade === 1 ? "unidade" : "unidades"}</small></div>
                  <span className="p-lista__val">{brl(m.centavos)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="p-grade p-duas" style={{ marginTop: 16 }}>
        <div className="p-card p-entra" style={{ "--i": 7 } as React.CSSProperties}>
          <div className="p-card__cab"><h2>Últimos pedidos</h2><Link href="/painel/pedidos">Ver todos</Link></div>
          {(ultimos.data ?? []).length === 0 ? (
            <div className="p-vazio" style={{ padding: "24px 0" }}><Icone n="pedidos" /><b>Nenhum pedido ainda</b>Quando alguém comprar, aparece aqui.</div>
          ) : (
            <div className="p-tabela-caixa">
              <table className="p-tabela">
                <tbody>
                  {(ultimos.data ?? []).map((p) => {
                    const st = STATUS[p.status as Status];
                    const cli = p.clientes as unknown as { nome: string } | null;
                    return (
                      <tr key={p.numero}>
                        <td><Link className="p-linha" href={`/painel/pedidos/${p.numero}`}>#{p.numero}</Link><div className="fraco">{dataHora(p.criado_em)}</div></td>
                        <td className="p-esconde-cel">{cli?.nome}</td>
                        <td><span className={`p-selo p-selo--${st.cor}`}>{st.nome}</span></td>
                        <td className="num">{brl(p.total_centavos)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="p-card p-entra" style={{ "--i": 8 } as React.CSSProperties}>
          <div className="p-card__cab"><h2>Estoque acabando</h2><Link href="/painel/produtos?estoque=baixo">Ver</Link></div>
          {r.estoque_baixo.length === 0 ? (
            <div className="p-vazio" style={{ padding: "24px 0" }}><b>Tudo com estoque</b>Nenhum produto com 3 unidades ou menos.</div>
          ) : (
            <ul className="p-lista">
              {r.estoque_baixo.map((e) => (
                <li key={e.produto_id + e.variante}>
                  {e.foto ? <img className="p-lista__foto" src={e.foto} alt="" /> : <span className="p-lista__foto" />}
                  <div className="p-lista__txt">
                    <Link href={`/painel/produtos/${e.produto_id}`}><b>{e.nome}</b></Link>
                    <small>{e.variante === "Único" ? "Sem variação" : e.variante}</small>
                  </div>
                  <span className={`p-selo p-selo--${e.estoque === 0 ? "erro" : "alerta"}`}>{e.estoque === 0 ? "Esgotado" : `${e.estoque} un.`}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </>
  );
}

// painel: depende do login, renderiza na hora (sem casca estática)
export const instant = false;
