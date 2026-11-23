import Link from "next/link";
import { notFound } from "next/navigation";
import { exigirAdmin } from "@/lib/painel/sessao";
import { dadosDoEditor } from "@/lib/painel/produto-form";
import { EditorProduto } from "@/components/painel/EditorProduto";
import { Icone } from "@/components/painel/Icone";

export const metadata = { title: "Editar produto" };

export default async function EditarProduto({ params }: { params: Promise<{ id: string }> }) {
  await exigirAdmin();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const d = await dadosDoEditor(id);
  if (!d.inicial) notFound();
  return (
    <>
      <Link href="/painel/produtos" className="p-voltar"><Icone n="voltar" /> Produtos</Link>
      <div className="p-cabeca"><div className="p-entra"><h1 style={{ fontSize: "clamp(20px, 2vw, 26px)", maxWidth: 900 }}>{d.inicial.nome}</h1><p>{d.inicial.ativo ? "Aparece na loja" : "Escondido da loja"}</p></div></div>
      <EditorProduto key={id} inicial={d.inicial} categorias={d.categorias} pagamento={d.pagamento} />
    </>
  );
}

// painel: depende do login, renderiza na hora (sem casca estática)
export const instant = false;
