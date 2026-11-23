"use server";
import { revalidatePath } from "next/cache";
import { exigirAdmin } from "@/lib/painel/sessao";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { rpc } from "@/lib/painel/rpc";
import { estornar } from "@/lib/stripe";
import { mensagemErro } from "@/lib/painel/formato";

type Resp = { ok: true } | { ok: false; erro: string };

async function idDo(numero: number) {
  const { data } = await supabaseAdmin().from("pedidos").select("id, stripe_pi, status").eq("numero", numero).single();
  if (!data) throw new Error("PEDIDO_INEXISTENTE");
  return data as { id: string; stripe_pi: string | null; status: string };
}

export async function mudarStatus(numero: number, status: "separando" | "enviado" | "entregue", rastreio?: string): Promise<Resp> {
  await exigirAdmin();
  try {
    const p = await idDo(numero);
    await rpc("mudar_status", { p_pedido: p.id, p_status: status, p_rastreio: rastreio ?? null });
  } catch (e) { return { ok: false, erro: mensagemErro(e) }; }
  revalidatePath("/painel", "layout");
  return { ok: true };
}

export async function cancelarPedido(numero: number, motivo: string): Promise<Resp> {
  const admin = await exigirAdmin();
  try {
    const p = await idDo(numero);
    await rpc("cancelar_pedido", { p_pedido: p.id, p_status: "cancelado", p_motivo: `${motivo || "cancelado no painel"} (${admin.nome})` });
  } catch (e) { return { ok: false, erro: mensagemErro(e) }; }
  revalidatePath("/painel", "layout");
  return { ok: true };
}

// devolve o dinheiro na Stripe e só então marca estornado (se a Stripe falhar, nada muda)
export async function estornarPedido(numero: number, motivo: string): Promise<Resp> {
  const admin = await exigirAdmin();
  try {
    const p = await idDo(numero);
    if (!["pago", "separando", "enviado", "entregue"].includes(p.status)) throw new Error("NAO_PAGO");
    const ref = await estornar(p.stripe_pi, motivo);
    await rpc("cancelar_pedido", { p_pedido: p.id, p_status: "estornado", p_motivo: `${motivo || "estornado no painel"} (${admin.nome}, ${ref})` });
  } catch (e) { return { ok: false, erro: mensagemErro(e) }; }
  revalidatePath("/painel", "layout");
  return { ok: true };
}

export async function salvarObservacao(numero: number, texto: string): Promise<Resp> {
  await exigirAdmin();
  const { error } = await supabaseAdmin().from("pedidos").update({ observacao: texto.slice(0, 2000) || null }).eq("numero", numero);
  if (error) return { ok: false, erro: mensagemErro(error) };
  revalidatePath(`/painel/pedidos/${numero}`);
  return { ok: true };
}
