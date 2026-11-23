import Link from "next/link";
import { exigirAdmin } from "@/lib/painel/sessao";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { rpc } from "@/lib/painel/rpc";
import { brl } from "@/lib/painel/formato";
import { Icone } from "@/components/painel/Icone";
import { ChaveAtivo } from "@/components/painel/ChaveAtivo";

export const metadata = { title: "Produtos" };

type Linha = { id: string; nome: string; foto: string | null; preco_centavos: number; preco_de_centavos: number | null; ativo: boolean;
  mais_vendido: boolean; oferta: boolean; destaque: boolean; categoria: string | null; estoque: number; variantes: number; vendidos_30d: number };

const FILTROS = [["", "Todos"], ["ativos", "Na loja"], ["inativos", "Escondidos"], ["baixo", "Estoque baixo"], ["esgotados", "Esgotados"]];

export default async function Produtos({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await exigirAdmin();
  const q = await searchParams;
  const filtro = q.estoque === "baixo" ? "baixo" : (q.filtro ?? "");
  const [r, cats] = await Promise.all([
    rpc<{ total: number; linhas: Linha[] }>("painel_produtos", { p_busca: q.q ?? "", p_categoria: q.categoria ?? "", p_filtro: filtro, p_limite: 200, p_pular: 0 }),
    supabaseAdmin().from("categorias").select("slug, nome").order("ordem"),
  ]);
  const link = (mudar: Record<string, string | undefined>) => {
    const u = new URLSearchParams(Object.entries({ ...q, estoque: undefined, ...mudar } as Record<string, string | undefined>).filter((e): e is [string, string] => Boolean(e[1])));
    const s = u.toString();
    return `/painel/produtos${s ? `?${s}` : ""}`;
  };

  return (
    <>
      <div className="p-cabeca">
        <div className="p-entra"><h1>Produtos</h1><p>{r.total} {r.total === 1 ? "produto" : "produtos"}</p></div>
        <div className="p-cabeca__acoes p-entra" style={{ "--i": 1 } as React.CSSProperties}>
          <Link className="p-btn p-btn--vermelho" href="/painel/produtos/novo"><Icone n="mais" /> Novo produto</Link>
        </div>
      </div>

      <div className="p-entra" style={{ "--i": 2, display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center", marginBottom: 18 } as React.CSSProperties}>
        <nav className="p-abas vidro" aria-label="Filtrar produtos">
          {FILTROS.map(([k, n]) => <Link key={k} href={link({ filtro: k || undefined })} aria-current={filtro === k ? "page" : undefined}>{n}</Link>)}
        </nav>
        <form className="p-busca" action="/painel/produtos" style={{ display: "flex", gap: 8, maxWidth: 560 }}>
          <Icone n="busca" />
          {q.filtro && <input type="hidden" name="filtro" value={q.filtro} />}
          <input className="p-input" name="q" defaultValue={q.q ?? ""} placeholder="Buscar por nome ou marca" aria-label="Buscar produto" />
          <select className="p-input" name="categoria" defaultValue={q.categoria ?? ""} aria-label="Categoria" style={{ width: 210, flex: "none", borderRadius: 999 }}>
            <option value="">Todas as categorias</option>
            {(cats.data ?? []).map((c) => <option key={c.slug} value={c.slug}>{c.nome}</option>)}
          </select>
          <button className="p-btn p-btn--vidro" aria-label="Filtrar">Filtrar</button>
        </form>
      </div>

      {r.linhas.length === 0 ? (
        <div className="p-card p-vazio p-entra"><Icone n="produtos" /><b>Nenhum produto aqui</b>Troque o filtro ou cadastre um produto novo.</div>
      ) : (
        <div className="p-prod-grade">
          {r.linhas.map((p, i) => (
            <article key={p.id} className={`p-prod p-entra${p.ativo ? "" : " p-prod--inativo"}`} style={{ "--i": Math.min(i, 16) + 3 } as React.CSSProperties}>
              <Link className="p-prod__link" href={`/painel/produtos/${p.id}`} aria-label={`Editar ${p.nome}`} />
              <div className="p-prod__foto">{p.foto ? <img src={p.foto} alt="" loading="lazy" /> : <Icone n="foto" />}</div>
              <div className="p-prod__selos">
                {p.mais_vendido && <span>Mais vendido</span>}
                {p.oferta && <span className="v">Oferta</span>}
                {!p.ativo && <span>Escondido</span>}
              </div>
              <div className="p-prod__corpo">
                <h3>{p.nome}</h3>
                <div className="p-prod__preco">{p.preco_de_centavos ? <s>{brl(p.preco_de_centavos)}</s> : null}{brl(p.preco_centavos)}</div>
                <div className="p-prod__pe">
                  <span>
                    <span className={`p-selo p-selo--${p.estoque === 0 ? "erro" : p.estoque <= 3 ? "alerta" : "neutro"}`}>{p.estoque === 0 ? "Esgotado" : `${p.estoque} em estoque`}</span>
                  </span>
                  <ChaveAtivo id={p.id} ativo={p.ativo} nome={p.nome} />
                </div>
                <small style={{ color: "var(--texto-2)", fontSize: 12 }}>{p.categoria ?? "Sem categoria"}{p.variantes > 1 ? ` · ${p.variantes} variações` : ""}{p.vendidos_30d ? ` · ${p.vendidos_30d} vendidos em 30 dias` : ""}</small>
              </div>
            </article>
          ))}
        </div>
      )}
    </>
  );
}

// painel: depende do login, renderiza na hora (sem casca estática)
export const instant = false;
