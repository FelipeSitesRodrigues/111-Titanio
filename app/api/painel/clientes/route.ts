import { exigirAdmin } from "@/lib/painel/sessao";
import { rpc } from "@/lib/painel/rpc";

// planilha de clientes (Excel): quem mais comprou primeiro
export async function GET() {
  await exigirAdmin();
  const r = await rpc<{ linhas: { nome: string; email: string; cpf: string | null; telefone: string | null; quer_novidades: boolean; pedidos: number; gasto: number; ultimo: string | null; criado_em: string }[] }>(
    "painel_clientes", { p_busca: "", p_limite: 100000, p_pular: 0 });
  const esc = (v: unknown) => { const s = String(v ?? ""); return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const d = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "");
  const linhas = [["Nome", "E-mail", "CPF", "Telefone", "Aceita novidades", "Pedidos pagos", "Total gasto", "Último pedido", "Cliente desde"],
    ...r.linhas.map((c) => [c.nome, c.email, c.cpf ?? "", c.telefone ?? "", c.quer_novidades ? "sim" : "não", String(c.pedidos),
      (c.gasto / 100).toFixed(2).replace(".", ","), d(c.ultimo), d(c.criado_em)])];
  return new Response("﻿" + linhas.map((l) => l.map(esc).join(";")).join("\r\n"), {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="titanio-clientes.csv"' },
  });
}
