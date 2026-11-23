import { exigirAdmin } from "@/lib/painel/sessao";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ListaCupons, type Cupom } from "@/components/painel/ListaCupons";

export const metadata = { title: "Cupons" };

export default async function Cupons() {
  await exigirAdmin();
  const sb = supabaseAdmin();
  const [{ data: cupons }, { data: vendas }] = await Promise.all([
    sb.from("cupons").select("*").order("ativo", { ascending: false }).order("criado_em", { ascending: false }),
    sb.from("pedidos").select("cupom_codigo, total_centavos").not("cupom_codigo", "is", null).in("status", ["pago", "separando", "enviado", "entregue"]),
  ]);
  const soma = new Map<string, number>();
  for (const v of vendas ?? []) soma.set(v.cupom_codigo, (soma.get(v.cupom_codigo) ?? 0) + v.total_centavos);
  const lista = (cupons ?? []).map((c) => ({ ...c, vendas_centavos: soma.get(c.codigo) ?? 0 })) as Cupom[];
  return <ListaCupons cupons={lista} />;
}

// painel: depende do login, renderiza na hora (sem casca estática)
export const instant = false;
