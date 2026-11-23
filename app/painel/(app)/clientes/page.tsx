import Link from "next/link";
import { exigirAdmin } from "@/lib/painel/sessao";
import { rpc } from "@/lib/painel/rpc";
import { brl, data } from "@/lib/painel/formato";
import { Icone } from "@/components/painel/Icone";

export const metadata = { title: "Clientes" };

type Linha = { id: string; nome: string; email: string; telefone: string | null; quer_novidades: boolean; pedidos: number; gasto: number; ultimo: string | null; criado_em: string };
const POR_PAGINA = 30;

export default async function Clientes({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await exigirAdmin();
  const q = await searchParams;
  const pagina = Math.max(1, Number(q.pagina) || 1);
  const r = await rpc<{ total: number; linhas: Linha[] }>("painel_clientes", { p_busca: q.q ?? "", p_limite: POR_PAGINA, p_pular: (pagina - 1) * POR_PAGINA });
  const paginas = Math.max(1, Math.ceil(r.total / POR_PAGINA));
  const link = (p: number) => `/painel/clientes?${new URLSearchParams({ ...(q.q ? { q: q.q } : {}), pagina: String(p) })}`;

  return (
    <>
      <div className="p-cabeca">
        <div className="p-entra"><h1>Clientes</h1><p>{r.total} {r.total === 1 ? "pessoa" : "pessoas"} já fizeram pedido. Ordem: quem mais comprou.</p></div>
        <div className="p-cabeca__acoes p-entra" style={{ "--i": 1 } as React.CSSProperties}>
          <form className="p-busca" action="/painel/clientes">
            <Icone n="busca" />
            <input className="p-input" name="q" defaultValue={q.q ?? ""} placeholder="Nome ou e-mail" aria-label="Buscar cliente" />
          </form>
          <a className="p-btn p-btn--vidro" href="/api/painel/clientes"><Icone n="baixar" /> Planilha</a>
        </div>
      </div>

      <div className="p-card p-entra" style={{ "--i": 2 } as React.CSSProperties}>
        {r.linhas.length === 0 ? (
          <div className="p-vazio"><Icone n="clientes" /><b>Ninguém por aqui</b>{q.q ? "Tente outro nome." : "Os clientes aparecem depois do primeiro pedido."}</div>
        ) : (
          <div className="p-tabela-caixa">
            <table className="p-tabela">
              <thead><tr><th>Cliente</th><th>Contato</th><th className="num">Pedidos pagos</th><th className="num">Total gasto</th><th>Último pedido</th></tr></thead>
              <tbody>
                {r.linhas.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <Link className="p-linha" href={`/painel/clientes/${c.id}`}>{c.nome}</Link>
                      {c.quer_novidades && <div className="fraco">aceita novidades</div>}
                    </td>
                    <td><div>{c.email}</div>{c.telefone && <div className="fraco">{c.telefone}</div>}</td>
                    <td className="num">{c.pedidos}</td>
                    <td className="num"><b>{brl(c.gasto)}</b></td>
                    <td className="fraco">{data(c.ultimo)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {paginas > 1 && (
        <div className="p-paginas">
          <span>Página {pagina} de {paginas}</span>
          <div>
            {pagina > 1 && <Link className="p-btn p-btn--vidro p-btn--p" href={link(pagina - 1)}><Icone n="voltar" /> Anterior</Link>}
            {pagina < paginas && <Link className="p-btn p-btn--vidro p-btn--p" href={link(pagina + 1)}>Próxima <Icone n="avancar" /></Link>}
          </div>
        </div>
      )}
    </>
  );
}

// painel: depende do login, renderiza na hora (sem casca estática)
export const instant = false;
