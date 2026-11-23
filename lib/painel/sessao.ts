import "server-only";
import { cache } from "react";
import { redirect, forbidden } from "next/navigation";
import { connection } from "next/server";
import { supabaseSessao } from "@/lib/supabase/servidor";
import { supabaseAdmin } from "@/lib/supabase/admin";

export type Admin = { id: string; email: string; nome: string; papel: "admin" | "operador" };

// Quem está logado no painel. Sem sessão → login; logado mas sem cadastro ativo em admins → 403.
// Chamar no começo de toda página e de toda ação do painel.
export const exigirAdmin = cache(async (): Promise<Admin> => {
  await connection(); // painel é sempre na hora (o login do Supabase usa a hora atual)
  const supabase = await supabaseSessao();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/painel/entrar");
  const { data: adm } = await supabaseAdmin()
    .from("admins")
    .select("user_id, email, nome, papel, ativo")
    .eq("user_id", data.user.id)
    .maybeSingle<{ user_id: string; email: string; nome: string; papel: Admin["papel"]; ativo: boolean }>();
  if (!adm || !adm.ativo) forbidden();
  return { id: adm.user_id, email: adm.email, nome: adm.nome, papel: adm.papel };
});
