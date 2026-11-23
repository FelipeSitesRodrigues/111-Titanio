import { exigirAdmin } from "@/lib/painel/sessao";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ListaCategorias } from "@/components/painel/ListaCategorias";

export const metadata = { title: "Categorias" };

export default async function Categorias() {
  await exigirAdmin();
  const { data } = await supabaseAdmin().from("categorias").select("id, nome, slug, imagem, ativo, produtos(count)").order("ordem").order("nome");
  const lista = (data ?? []).map((c) => ({ id: c.id, nome: c.nome, slug: c.slug, imagem: c.imagem, ativo: c.ativo,
    produtos: (c.produtos as { count: number }[])?.[0]?.count ?? 0 }));
  return <ListaCategorias key={lista.map((c) => c.id + c.nome + c.imagem + c.ativo).join()} inicial={lista} />;
}

// painel: depende do login, renderiza na hora (sem casca estática)
export const instant = false;
