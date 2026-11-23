"use server";
import { revalidatePath, revalidateTag } from "next/cache";
import { exigirAdmin } from "@/lib/painel/sessao";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { mensagemErro } from "@/lib/painel/formato";

type Resp = { ok: true } | { ok: false; erro: string };
const slugify = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
  .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
const centavos = (v: string | number) => {
  const t = String(v ?? "").trim().replace(/[R$\s]/g, "");
  if (!t) return 0;
  const n = Number(t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : NaN;
};
const loja = () => { revalidateTag("catalogo", "max"); };

// ------------------------------------------------------------ categorias
export async function salvarCategoria(c: { id?: string; nome: string; slug?: string; imagem: string | null; ativo: boolean }): Promise<Resp & { id?: string }> {
  await exigirAdmin();
  const nome = c.nome.trim();
  if (!nome) return { ok: false, erro: "Dê um nome à categoria." };
  const slug = slugify(c.slug || nome);
  const sb = supabaseAdmin();
  const linha = { nome, slug, imagem: c.imagem, ativo: c.ativo };
  const r = c.id
    ? await sb.from("categorias").update(linha).eq("id", c.id).select("id").single()
    : await sb.from("categorias").insert({ ...linha, ordem: 999 }).select("id").single();
  if (r.error) return { ok: false, erro: /slug/.test(r.error.message) ? "Já existe uma categoria com esse nome." : mensagemErro(r.error) };
  loja(); revalidatePath("/painel/categorias");
  return { ok: true, id: r.data.id };
}
export async function ordenarCategorias(ids: string[]): Promise<Resp> {
  await exigirAdmin();
  const sb = supabaseAdmin();
  for (const [i, id] of ids.entries()) await sb.from("categorias").update({ ordem: i }).eq("id", id);
  loja(); revalidatePath("/painel/categorias");
  return { ok: true };
}
export async function excluirCategoria(id: string): Promise<Resp> {
  await exigirAdmin();
  const { error } = await supabaseAdmin().from("categorias").delete().eq("id", id);
  if (error) return { ok: false, erro: mensagemErro(error) };
  loja(); revalidatePath("/painel/categorias");
  return { ok: true };
}

// ------------------------------------------------------------ cupons
export type CupomForm = { codigo: string; novo: boolean; descricao: string; tipo: "percentual" | "valor"; valor: string; minimo: string;
  valido_de: string; valido_ate: string; limite_usos: string; ativo: boolean };

export async function salvarCupom(c: CupomForm): Promise<Resp> {
  await exigirAdmin();
  const codigo = c.codigo.trim().toUpperCase().replace(/\s+/g, "");
  if (!/^[A-Z0-9_-]{3,30}$/.test(codigo)) return { ok: false, erro: "Código com 3 a 30 letras ou números, sem espaço nem acento." };
  const valor = c.tipo === "percentual" ? Math.round(Number(String(c.valor).replace(",", "."))) : centavos(c.valor);
  if (!valor || Number.isNaN(valor) || valor <= 0) return { ok: false, erro: "Valor do desconto inválido." };
  if (c.tipo === "percentual" && valor > 100) return { ok: false, erro: "Desconto acima de 100%." };
  const minimo = centavos(c.minimo);
  if (Number.isNaN(minimo)) return { ok: false, erro: "Pedido mínimo inválido." };
  const limite = c.limite_usos.trim() ? Math.floor(Number(c.limite_usos)) : null;
  if (limite !== null && !(limite > 0)) return { ok: false, erro: "Limite de usos inválido." };
  const de = c.valido_de ? `${c.valido_de}T00:00:00-03:00` : null;
  const ate = c.valido_ate ? `${c.valido_ate}T23:59:59-03:00` : null;
  if (de && ate && de > ate) return { ok: false, erro: "A validade termina antes de começar." };
  const linha = { codigo, descricao: c.descricao.trim() || null, tipo: c.tipo, valor, minimo_centavos: minimo, valido_de: de, valido_ate: ate, limite_usos: limite, ativo: c.ativo };
  const sb = supabaseAdmin();
  const { error } = c.novo ? await sb.from("cupons").insert(linha) : await sb.from("cupons").update(linha).eq("codigo", codigo);
  if (error) return { ok: false, erro: /duplicate/.test(error.message) ? "Já existe um cupom com esse código." : mensagemErro(error) };
  revalidatePath("/painel/cupons");
  return { ok: true };
}
export async function alternarCupom(codigo: string, ativo: boolean): Promise<Resp> {
  await exigirAdmin();
  const { error } = await supabaseAdmin().from("cupons").update({ ativo }).eq("codigo", codigo);
  if (error) return { ok: false, erro: mensagemErro(error) };
  revalidatePath("/painel/cupons");
  return { ok: true };
}
// cupom usado em pedido não sai (o pedido aponta pra ele): só desativa
export async function excluirCupom(codigo: string): Promise<Resp> {
  await exigirAdmin();
  const sb = supabaseAdmin();
  const { count } = await sb.from("pedidos").select("id", { count: "exact", head: true }).eq("cupom_codigo", codigo);
  if ((count ?? 0) > 0) return { ok: false, erro: "Esse cupom já foi usado. Desative em vez de excluir." };
  const { error } = await sb.from("cupons").delete().eq("codigo", codigo);
  if (error) return { ok: false, erro: mensagemErro(error) };
  revalidatePath("/painel/cupons");
  return { ok: true };
}

// ------------------------------------------------------------ ajustes
export type Ajustes = {
  pagamento: { pix_desconto_pct: number; parcelas_sem_juros: number; parcela_minima_centavos: number };
  frete: { gratis_acima_centavos: number | null; regioes: Record<string, { centavos: number; prazo_dias: number }> };
  loja: { nome: string; razao_social: string; cnpj: string; whatsapp: string; email: string };
};
export async function salvarAjustes(a: Ajustes): Promise<Resp> {
  const eu = await exigirAdmin();
  if (eu.papel !== "admin") return { ok: false, erro: "Só o administrador muda os ajustes." };
  const p = a.pagamento;
  if (!(p.pix_desconto_pct >= 0 && p.pix_desconto_pct <= 30)) return { ok: false, erro: "Desconto do Pix entre 0% e 30%." };
  if (!(Number.isInteger(p.parcelas_sem_juros) && p.parcelas_sem_juros >= 1 && p.parcelas_sem_juros <= 12)) return { ok: false, erro: "Parcelas entre 1 e 12." };
  for (const [r, v] of Object.entries(a.frete.regioes)) {
    if (!(v.centavos >= 0) || !(v.prazo_dias >= 1)) return { ok: false, erro: `Frete da região ${r} inválido.` };
  }
  const sb = supabaseAdmin();
  for (const [chave, valor] of Object.entries(a)) {
    const { error } = await sb.from("config").update({ valor }).eq("chave", chave);
    if (error) return { ok: false, erro: mensagemErro(error) };
  }
  loja(); revalidatePath("/painel/ajustes");
  return { ok: true };
}

export async function convidarAdmin(email: string, nome: string, senha: string, papel: "admin" | "operador"): Promise<Resp> {
  const eu = await exigirAdmin();
  if (eu.papel !== "admin") return { ok: false, erro: "Só o administrador adiciona pessoas." };
  const e = email.trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) return { ok: false, erro: "E-mail inválido." };
  if (!nome.trim()) return { ok: false, erro: "Informe o nome." };
  if (senha.length < 8) return { ok: false, erro: "Senha com pelo menos 8 caracteres." };
  const sb = supabaseAdmin();
  const { data, error } = await sb.auth.admin.createUser({ email: e, password: senha, email_confirm: true, user_metadata: { nome } });
  if (error) return { ok: false, erro: /already|registered/i.test(error.message) ? "Esse e-mail já tem conta." : "Não deu pra criar o acesso." };
  const { error: ea } = await sb.from("admins").insert({ user_id: data.user.id, email: e, nome: nome.trim(), papel });
  if (ea) return { ok: false, erro: mensagemErro(ea) };
  revalidatePath("/painel/ajustes");
  return { ok: true };
}
export async function alternarAdmin(userId: string, ativo: boolean): Promise<Resp> {
  const eu = await exigirAdmin();
  if (eu.papel !== "admin") return { ok: false, erro: "Só o administrador muda acessos." };
  if (userId === eu.id) return { ok: false, erro: "Você não pode tirar o seu próprio acesso." };
  const { error } = await supabaseAdmin().from("admins").update({ ativo }).eq("user_id", userId);
  if (error) return { ok: false, erro: mensagemErro(error) };
  revalidatePath("/painel/ajustes");
  return { ok: true };
}
