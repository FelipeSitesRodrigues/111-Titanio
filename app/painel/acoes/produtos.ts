"use server";
import { revalidatePath, revalidateTag } from "next/cache";
import { exigirAdmin } from "@/lib/painel/sessao";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { mensagemErro } from "@/lib/painel/formato";

export type VarianteForm = { id?: string; nome: string; sku: string; estoque: number; preco: string; ativo: boolean };
export type ProdutoForm = {
  id?: string; nome: string; slug: string; marca: string; categoria_id: string; descricao: string;
  especificacoes: { nome: string; valor: string }[]; fotos: string[];
  preco: string; preco_de: string; mais_vendido: boolean; oferta: boolean; destaque: boolean; ativo: boolean;
  peso_gramas: number; altura_cm: number; largura_cm: number; comprimento_cm: number;
  variantes: VarianteForm[];
};
type Resp = { ok: true; id: string } | { ok: false; erro: string; campo?: string };

const slugify = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
  .replace(/["']/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);

// "1.299,90" | "1299.9" | "1299" → centavos; vazio → null; inválido → NaN
function centavos(v: string): number | null {
  const t = String(v ?? "").trim().replace(/[R$\s]/g, "");
  if (!t) return null;
  const n = Number(t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t);
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : NaN;
}

function atualizarLoja(slug?: string) {
  revalidateTag("catalogo", "max");
  if (slug) revalidateTag(`produto:${slug}`, "max");
  revalidatePath("/painel/produtos");
}

export async function salvarProduto(f: ProdutoForm): Promise<Resp> {
  await exigirAdmin();
  const nome = f.nome.trim();
  if (!nome) return { ok: false, erro: "Dê um nome ao produto.", campo: "nome" };
  const slug = slugify(f.slug || nome) || slugify(nome);
  const preco = centavos(f.preco);
  const de = centavos(f.preco_de);
  if (!preco || Number.isNaN(preco)) return { ok: false, erro: "Preço inválido.", campo: "preco" };
  if (Number.isNaN(de)) return { ok: false, erro: "Preço \"de\" inválido.", campo: "preco_de" };
  if (de !== null && de <= preco) return { ok: false, erro: "O preço \"de\" precisa ser maior que o preço de venda.", campo: "preco_de" };
  const vs = f.variantes.filter((v) => v.nome.trim());
  if (vs.length === 0) return { ok: false, erro: "O produto precisa de pelo menos uma variação.", campo: "variantes" };
  const nomes = vs.map((v) => v.nome.trim().toLowerCase());
  if (new Set(nomes).size !== nomes.length) return { ok: false, erro: "Duas variações com o mesmo nome.", campo: "variantes" };
  for (const v of vs) {
    if (Number.isNaN(centavos(v.preco))) return { ok: false, erro: `Preço inválido na variação "${v.nome}".`, campo: "variantes" };
    if (!Number.isInteger(Number(v.estoque)) || Number(v.estoque) < 0) return { ok: false, erro: `Estoque inválido na variação "${v.nome}".`, campo: "variantes" };
  }

  const sb = supabaseAdmin();
  const linha = {
    nome, slug, marca: f.marca.trim() || null, categoria_id: f.categoria_id || null, descricao: f.descricao.trim(),
    especificacoes: f.especificacoes.filter((e) => e.nome.trim() && e.valor.trim()).map((e) => ({ nome: e.nome.trim(), valor: e.valor.trim() })),
    fotos: f.fotos, preco_centavos: preco, preco_de_centavos: de,
    mais_vendido: f.mais_vendido, oferta: f.oferta, destaque: f.destaque, ativo: f.ativo,
    peso_gramas: Math.max(1, Math.round(f.peso_gramas || 1000)), altura_cm: Math.max(1, Math.round(f.altura_cm || 10)),
    largura_cm: Math.max(1, Math.round(f.largura_cm || 20)), comprimento_cm: Math.max(1, Math.round(f.comprimento_cm || 30)),
  };
  try {
    let id = f.id;
    if (id) {
      const { error } = await sb.from("produtos").update(linha).eq("id", id);
      if (error) throw error;
    } else {
      const { data, error } = await sb.from("produtos").insert(linha).select("id").single();
      if (error) throw error;
      id = data.id as string;
    }
    // variações: apaga as que saíram (nos pedidos antigos a FK vira null, o nome fica copiado), grava as outras
    const manter = vs.filter((v) => v.id).map((v) => v.id!);
    let apagar = sb.from("variantes").delete().eq("produto_id", id);
    if (manter.length) apagar = apagar.not("id", "in", `(${manter.join(",")})`);
    const { error: ea } = await apagar;
    if (ea) throw ea;
    for (const [i, v] of vs.entries()) {
      const dados = { produto_id: id, nome: v.nome.trim(), sku: v.sku.trim() || null, estoque: Number(v.estoque), preco_centavos: centavos(v.preco), ativo: v.ativo, ordem: i };
      const { error } = v.id ? await sb.from("variantes").update(dados).eq("id", v.id) : await sb.from("variantes").insert(dados);
      if (error) throw error;
    }
    atualizarLoja(slug);
    return { ok: true, id: id! };
  } catch (e) {
    const m = (e as { message?: string }).message ?? "";
    if (/produtos_slug_key/.test(m)) return { ok: false, erro: "Já existe outro produto com esse endereço. Mude o nome ou o endereço.", campo: "slug" };
    if (/variantes_sku_key/.test(m)) return { ok: false, erro: "Esse SKU já está em outro produto.", campo: "variantes" };
    return { ok: false, erro: mensagemErro(e) };
  }
}

export async function alternarAtivo(id: string, ativo: boolean) {
  await exigirAdmin();
  const { data, error } = await supabaseAdmin().from("produtos").update({ ativo }).eq("id", id).select("slug").single();
  if (error) return { ok: false as const, erro: mensagemErro(error) };
  atualizarLoja(data.slug);
  return { ok: true as const };
}

export async function duplicarProduto(id: string): Promise<Resp> {
  await exigirAdmin();
  const sb = supabaseAdmin();
  const { data: p } = await sb.from("produtos").select("*, variantes(*)").eq("id", id).single();
  if (!p) return { ok: false, erro: "Produto não encontrado." };
  const sufixo = Date.now().toString(36).slice(-4);
  const { id: _i, busca: _b, criado_em: _c, atualizado_em: _a, variantes, ...resto } = p;
  void _i; void _b; void _c; void _a;
  const { data: novo, error } = await sb.from("produtos")
    .insert({ ...resto, nome: `${p.nome} (cópia)`, slug: `${p.slug}-copia-${sufixo}`, ativo: false }).select("id").single();
  if (error) return { ok: false, erro: mensagemErro(error) };
  for (const v of variantes as { nome: string; atributos: unknown; preco_centavos: number | null; ativo: boolean; ordem: number }[]) {
    await sb.from("variantes").insert({ produto_id: novo.id, nome: v.nome, atributos: v.atributos, estoque: 0, preco_centavos: v.preco_centavos, ativo: v.ativo, ordem: v.ordem });
  }
  revalidatePath("/painel/produtos");
  return { ok: true, id: novo.id as string };
}

// só apaga produto que nunca vendeu; o que já vendeu, desativa
export async function excluirProduto(id: string) {
  await exigirAdmin();
  const sb = supabaseAdmin();
  const { count } = await sb.from("pedido_itens").select("id", { count: "exact", head: true }).eq("produto_id", id);
  if ((count ?? 0) > 0) {
    await sb.from("produtos").update({ ativo: false }).eq("id", id);
    atualizarLoja();
    return { ok: true as const, desativado: true };
  }
  const { error } = await sb.from("produtos").delete().eq("id", id);
  if (error) return { ok: false as const, erro: mensagemErro(error) };
  atualizarLoja();
  return { ok: true as const, desativado: false };
}
