import { exigirAdmin } from "@/lib/painel/sessao";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { FormAjustes } from "@/components/painel/FormAjustes";
import type { Ajustes } from "@/app/painel/acoes/loja";

export const metadata = { title: "Ajustes" };

export default async function PaginaAjustes() {
  const eu = await exigirAdmin();
  const sb = supabaseAdmin();
  const [{ data: cfg }, { data: admins }] = await Promise.all([
    sb.from("config").select("chave, valor").in("chave", ["pagamento", "frete", "loja"]),
    sb.from("admins").select("user_id, email, nome, papel, ativo").order("criado_em"),
  ]);
  const a = Object.fromEntries((cfg ?? []).map((c) => [c.chave, c.valor])) as Ajustes;
  return (
    <>
      <div className="p-cabeca">
        <div className="p-entra">
          <h1>Ajustes</h1>
          <p>{eu.papel === "admin" ? "Pagamento, frete, dados da loja e acessos." : "Só o administrador muda os ajustes."}</p>
        </div>
      </div>
      <FormAjustes inicial={a} admins={admins ?? []} euId={eu.id} souAdmin={eu.papel === "admin"} />
    </>
  );
}

// painel: depende do login, renderiza na hora (sem casca estática)
export const instant = false;
