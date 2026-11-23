import Link from "next/link";
import { exigirAdmin } from "@/lib/painel/sessao";
import { dadosDoEditor } from "@/lib/painel/produto-form";
import { EditorProduto } from "@/components/painel/EditorProduto";
import { Icone } from "@/components/painel/Icone";

export const metadata = { title: "Novo produto" };

export default async function NovoProduto() {
  await exigirAdmin();
  const d = await dadosDoEditor();
  return (
    <>
      <Link href="/painel/produtos" className="p-voltar"><Icone n="voltar" /> Produtos</Link>
      <div className="p-cabeca"><div className="p-entra"><h1>Novo produto</h1><p>Preencha o básico e salve. Dá pra completar depois.</p></div></div>
      <EditorProduto inicial={d.inicial!} categorias={d.categorias} pagamento={d.pagamento} />
    </>
  );
}

// painel: depende do login, renderiza na hora (sem casca estática)
export const instant = false;
