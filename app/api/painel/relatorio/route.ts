import { exigirAdmin } from "@/lib/painel/sessao";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { inicioDoDia } from "@/lib/painel/formato";
import { lerPeriodo, somarDias } from "@/lib/painel/periodo";

// Planilha do período (abre no Excel): pedidos pagos e estornados, pelo dia do pagamento.
export async function GET(req: Request) {
  await exigirAdmin();
  const q = Object.fromEntries(new URL(req.url).searchParams);
  const per = lerPeriodo(q);
  const { data, error } = await supabaseAdmin()
    .from("pedidos")
    .select("numero, status, metodo, parcelas, subtotal_centavos, desconto_cupom_centavos, desconto_pix_centavos, frete_centavos, total_centavos, cupom_codigo, endereco, pago_em, rastreio, clientes(nome, email, cpf, telefone), pedido_itens(produto_nome, variante_nome, quantidade)")
    .gte("pago_em", inicioDoDia(per.de)).lt("pago_em", inicioDoDia(somarDias(per.ate, 1)))
    .in("status", ["pago", "separando", "enviado", "entregue", "estornado"])
    .order("pago_em");
  if (error) return new Response(error.message, { status: 500 });

  const r = (c: number) => (c / 100).toFixed(2).replace(".", ",");
  const esc = (v: unknown) => { const s = String(v ?? ""); return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const cpf = (s?: string | null) => { const d = (s ?? "").replace(/\D/g, ""); return d.length === 11 ? d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4") : s ?? ""; };
  const linhas = [["Pedido", "Pago em", "Status", "Cliente", "E-mail", "CPF", "Telefone", "Pagamento", "Parcelas", "Itens", "Subtotal", "Cupom", "Desconto cupom", "Desconto Pix", "Frete", "Total", "Cidade", "UF", "Rastreio"]];
  let total = 0;
  for (const p of data ?? []) {
    const c = p.clientes as unknown as { nome: string; email: string; cpf: string | null; telefone: string | null };
    const e = p.endereco as { cidade?: string; uf?: string };
    const itens = (p.pedido_itens as { produto_nome: string; variante_nome: string; quantidade: number }[])
      .map((i) => `${i.quantidade}x ${i.produto_nome}${i.variante_nome !== "Único" ? ` (${i.variante_nome})` : ""}`).join(" | ");
    if (p.status !== "estornado") total += p.total_centavos;
    linhas.push([`#${p.numero}`, new Date(p.pago_em!).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }), p.status, c?.nome, c?.email, cpf(c?.cpf), c?.telefone ?? "",
      p.metodo === "pix" ? "Pix" : "Cartão", String(p.parcelas), itens, r(p.subtotal_centavos), p.cupom_codigo ?? "", r(p.desconto_cupom_centavos),
      r(p.desconto_pix_centavos), r(p.frete_centavos), r(p.total_centavos), e?.cidade ?? "", e?.uf ?? "", p.rastreio ?? ""].map(String));
  }
  linhas.push([], ["TOTAL (sem estornos)", "", "", "", "", "", "", "", "", "", "", "", "", "", "", r(total)]);
  const csv = "﻿" + linhas.map((l) => l.map(esc).join(";")).join("\r\n");
  return new Response(csv, {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="titanio-vendas-${per.de}-a-${per.ate}.csv"` },
  });
}
