"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Icone } from "./Icone";
import { useAviso } from "./Avisos";
import { excluirCategoria, ordenarCategorias, salvarCategoria } from "@/app/painel/acoes/loja";

type Cat = { id: string; nome: string; slug: string; imagem: string | null; ativo: boolean; produtos: number };
type Edicao = { id?: string; nome: string; imagem: string | null; ativo: boolean };

export function ListaCategorias({ inicial }: { inicial: Cat[] }) {
  const [lista, setLista] = useState(inicial);
  const [arrasto, setArrasto] = useState<number | null>(null);
  const [alvo, setAlvo] = useState<number | null>(null);
  const [ed, setEd] = useState<Edicao | null>(null);
  const [subindo, setSubindo] = useState(false);
  const [indo, comecar] = useTransition();
  const avisar = useAviso();
  const router = useRouter();

  const soltar = (para: number) => {
    if (arrasto === null || arrasto === para) return;
    const nova = [...lista];
    const [m] = nova.splice(arrasto, 1);
    nova.splice(para, 0, m);
    setLista(nova);
    comecar(async () => { const r = await ordenarCategorias(nova.map((c) => c.id)); avisar(r.ok ? "Ordem salva" : r.erro, !r.ok); });
  };
  const subir = async (arq: File) => {
    if (!ed) return;
    setSubindo(true);
    const fd = new FormData();
    fd.append("foto", arq);
    fd.append("pasta", `categorias/${(ed.nome || "nova").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-")}`);
    const r = await fetch("/api/painel/fotos", { method: "POST", body: fd });
    const j = await r.json().catch(() => ({}));
    setSubindo(false);
    if (!r.ok) { avisar(j.erro ?? "Imagem não subiu.", true); return; }
    setEd((x) => (x ? { ...x, imagem: j.url } : x));
  };
  const salvar = () => ed && comecar(async () => {
    const r = await salvarCategoria(ed);
    if (!r.ok) { avisar(r.erro, true); return; }
    avisar(ed.id ? "Categoria salva" : "Categoria criada");
    setEd(null);
    router.refresh();
  });

  return (
    <>
      <div className="p-cabeca">
        <div className="p-entra"><h1>Categorias</h1><p>Os círculos da home, na ordem daqui. Arraste pra reordenar.</p></div>
        <div className="p-cabeca__acoes p-entra" style={{ "--i": 1 } as React.CSSProperties}>
          <button className="p-btn p-btn--vermelho" onClick={() => setEd({ nome: "", imagem: null, ativo: true })}><Icone n="mais" /> Nova categoria</button>
        </div>
      </div>

      <ul className="p-cats">
        {lista.map((c, i) => (
          <li key={c.id} className={`p-cat${arrasto === i ? " arrastando" : ""}${alvo === i && arrasto !== i ? " alvo" : ""}`} style={{ "--i": i } as React.CSSProperties}
            draggable onDragStart={() => setArrasto(i)} onDragEnd={() => { setArrasto(null); setAlvo(null); }}
            onDragOver={(e) => { e.preventDefault(); setAlvo(i); }} onDrop={(e) => { e.preventDefault(); soltar(i); setArrasto(null); setAlvo(null); }}>
            <span className="p-cat__alca" title="Arraste"><Icone n="alca" /></span>
            {c.imagem ? <img className="p-cat__img" src={c.imagem} alt="" /> : <span className="p-cat__img" />}
            <div className="p-cat__txt"><b>{c.nome}</b><small>{c.produtos} {c.produtos === 1 ? "produto" : "produtos"}{c.ativo ? "" : " · escondida"}</small></div>
            <span className={`p-selo p-selo--${c.ativo ? "ok" : "neutro"}`}>{c.ativo ? "Na loja" : "Escondida"}</span>
            <button className="p-btn p-btn--fantasma p-btn--p p-btn--icone" aria-label={`Editar ${c.nome}`} onClick={() => setEd({ id: c.id, nome: c.nome, imagem: c.imagem, ativo: c.ativo })}><Icone n="editar" /></button>
          </li>
        ))}
      </ul>

      {ed && (
        <>
          <div className="p-veu" onClick={() => !indo && setEd(null)} />
          <form className="p-janela vidro" role="dialog" aria-modal="true" onSubmit={(e) => { e.preventDefault(); salvar(); }}>
            <h2>{ed.id ? "Editar categoria" : "Nova categoria"}</h2>
            <p>A imagem aparece dentro do círculo, com o produto saindo do anel. Use PNG sem fundo.</p>
            <div className="p-form">
              <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
                <label className="p-soltar" style={{ width: 96, flex: "none", borderRadius: "50%", padding: 6, overflow: "hidden" }}>
                  {subindo ? <span className="p-girando" /> : ed.imagem ? <img src={ed.imagem} alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} /> : <><Icone n="foto" /><span>Imagem</span></>}
                  <input type="file" accept="image/png,image/webp,image/jpeg" onChange={(e) => { const a = e.target.files?.[0]; if (a) subir(a); e.target.value = ""; }} />
                </label>
                <label className="p-campo" style={{ flex: 1 }}>
                  <span>Nome</span>
                  <input className="p-input" autoFocus value={ed.nome} onChange={(e) => setEd({ ...ed, nome: e.target.value })} placeholder="Ex.: Celulares" />
                </label>
              </div>
              <label className="p-chave"><input type="checkbox" checked={ed.ativo} onChange={(e) => setEd({ ...ed, ativo: e.target.checked })} /><i />Aparece na loja</label>
            </div>
            <div className="p-janela__acoes" style={{ justifyContent: "space-between" }}>
              {ed.id ? (
                <button type="button" className="p-btn p-btn--perigo" disabled={indo} onClick={() => {
                  if (!confirm("Excluir a categoria? Os produtos dela ficam sem categoria.")) return;
                  comecar(async () => { const r = await excluirCategoria(ed.id!); avisar(r.ok ? "Categoria excluída" : r.erro, !r.ok); if (r.ok) { setEd(null); router.refresh(); } });
                }}><Icone n="lixo" /> Excluir</button>
              ) : <span />}
              <div style={{ display: "flex", gap: 10 }}>
                <button type="button" className="p-btn p-btn--fantasma" onClick={() => setEd(null)}>Voltar</button>
                <button className="p-btn p-btn--vermelho" disabled={indo || subindo || !ed.nome.trim()}>{indo ? <span className="p-girando" /> : "Salvar"}</button>
              </div>
            </div>
          </form>
        </>
      )}
    </>
  );
}
