import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { ProdutoForm } from "@/app/painel/acoes/produtos";

const reais = (c: number | null) => (c ? (c / 100).toFixed(2).replace(".", ",") : "");

export async function dadosDoEditor(id?: string) {
  const sb = supabaseAdmin();
  const [cats, pag, prod] = await Promise.all([
    sb.from("categorias").select("id, nome").order("ordem"),
    sb.from("config").select("valor").eq("chave", "pagamento").single(),
    id ? sb.from("produtos").select("*, variantes(*)").eq("id", id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const p = prod.data;
  const inicial: ProdutoForm | null = id && !p ? null : p ? {
    id: p.id, nome: p.nome, slug: p.slug, marca: p.marca ?? "", categoria_id: p.categoria_id ?? "", descricao: p.descricao ?? "",
    especificacoes: p.especificacoes ?? [], fotos: p.fotos ?? [], preco: reais(p.preco_centavos), preco_de: reais(p.preco_de_centavos),
    mais_vendido: p.mais_vendido, oferta: p.oferta, destaque: p.destaque, ativo: p.ativo,
    peso_gramas: p.peso_gramas, altura_cm: p.altura_cm, largura_cm: p.largura_cm, comprimento_cm: p.comprimento_cm,
    variantes: [...(p.variantes as { id: string; nome: string; sku: string | null; estoque: number; preco_centavos: number | null; ativo: boolean; ordem: number }[])]
      .sort((a, b) => a.ordem - b.ordem)
      .map((v) => ({ id: v.id, nome: v.nome, sku: v.sku ?? "", estoque: v.estoque, preco: reais(v.preco_centavos), ativo: v.ativo })),
  } : {
    nome: "", slug: "", marca: "", categoria_id: "", descricao: "", especificacoes: [], fotos: [], preco: "", preco_de: "",
    mais_vendido: false, oferta: false, destaque: false, ativo: true, peso_gramas: 1000, altura_cm: 10, largura_cm: 20, comprimento_cm: 30,
    variantes: [{ nome: "Único", sku: "", estoque: 0, preco: "", ativo: true }],
  };
  return { inicial, categorias: (cats.data ?? []) as { id: string; nome: string }[], pagamento: pag.data?.valor ?? { pix_desconto_pct: 5, parcelas_sem_juros: 10 } };
}
