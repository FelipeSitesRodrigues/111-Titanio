import { exigirAdmin } from "@/lib/painel/sessao";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { Casca } from "@/components/painel/Casca";

// painel: tudo depende de quem está logado, então renderiza na hora (sem casca estática)
export const instant = false;

export default async function LayoutApp({ children }: { children: React.ReactNode }) {
  const admin = await exigirAdmin();
  const { count } = await supabaseAdmin().from("pedidos").select("id", { count: "exact", head: true }).in("status", ["pago", "separando"]);
  return (
    <Casca nome={admin.nome} email={admin.email} aEnviar={count ?? 0}>
      {children}
    </Casca>
  );
}
