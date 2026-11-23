"use client";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Icone } from "./Icone";
import { useAviso } from "./Avisos";
import { duplicarProduto, excluirProduto, salvarProduto, type ProdutoForm } from "@/app/painel/acoes/produtos";

const slugify = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
  .replace(/["']/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
const reais = (v: string) => {
  const t = v.trim().replace(/[R$\s]/g, "");
  const n = Number(t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t);
  return Number.isFinite(n) && n > 0 ? n : 0;
};
const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

type Categoria = { id: string; nome: string };

export function EditorProduto({ inicial, categorias, pagamento }: {
  inicial: ProdutoForm; categorias: Categoria[]; pagamento: { pix_desconto_pct: number; parcelas_sem_juros: number };
}) {
  const [f, setF] = useState<ProdutoForm>(inicial);
  const [slugMexido, setSlugMexido] = useState(Boolean(inicial.id));
  const [erro, setErro] = useState<{ texto: string; campo?: string } | null>(null);
  const [subindo, setSubindo] = useState(0);
  const [sobre, setSobre] = useState(false);
  const [arrasto, setArrasto] = useState<number | null>(null);
  const [alvo, setAlvo] = useState<number | null>(null);
  const [rascunho, setRascunho] = useState<ProdutoForm | null>(null);
  const [indo, comecar] = useTransition();
  const avisar = useAviso();
  const router = useRouter();
  const chaveRascunho = `rascunho-produto-${inicial.id ?? "novo"}`;
  const original = useRef(JSON.stringify(inicial));
  const mudou = JSON.stringify(f) !== original.current;

  const muda = <K extends keyof ProdutoForm>(k: K, v: ProdutoForm[K]) => setF((x) => ({ ...x, [k]: v }));

  // rascunho no navegador: se a sessão cair no meio, nada se perde
  useEffect(() => {
    try {
      const r = localStorage.getItem(chaveRascunho);
      if (r && r !== original.current) setRascunho(JSON.parse(r));
    } catch {}
  }, [chaveRascunho]);
  useEffect(() => {
    if (!mudou) return;
    const t = setTimeout(() => { try { localStorage.setItem(chaveRascunho, JSON.stringify(f)); } catch {} }, 500);
    const sair = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", sair);
    return () => { clearTimeout(t); window.removeEventListener("beforeunload", sair); };
  }, [f, mudou, chaveRascunho]);

  const enviarFotos = async (arquivos: FileList | File[]) => {
    const lista = Array.from(arquivos);
    setSubindo((n) => n + lista.length);
    await Promise.all(lista.map(async (arq) => {
      const fd = new FormData();
      fd.append("foto", arq);
      fd.append("pasta", `produtos/${slugify(f.slug || f.nome) || "novo"}`);
      try {
        const r = await fetch("/api/painel/fotos", { method: "POST", body: fd });
        const j = await r.json().catch(() => ({ erro: "Sessão encerrada. Entre de novo." }));
        if (!r.ok) avisar(j.erro ?? "Foto não subiu.", true);
        else setF((x) => ({ ...x, fotos: [...x.fotos, j.url] }));
      } catch { avisar("Sem conexão. A foto não subiu.", true); }
      setSubindo((n) => n - 1);
    }));
  };

  const moverFoto = (de: number, para: number) => setF((x) => {
    const fotos = [...x.fotos];
    const [m] = fotos.splice(de, 1);
    fotos.splice(para, 0, m);
    return { ...x, fotos };
  });

  const salvar = () => comecar(async () => {
    setErro(null);
    const r = await salvarProduto(f);
    if (!r.ok) { setErro({ texto: r.erro, campo: r.campo }); avisar(r.erro, true); return; }
    try { localStorage.removeItem(chaveRascunho); } catch {}
    avisar("Produto salvo");
    if (!f.id) {
      // o Next guarda a tela anterior escondida: o "Novo produto" precisa voltar em branco
      original.current = JSON.stringify(inicial);
      setF(inicial);
      setSlugMexido(false);
      router.replace(`/painel/produtos/${r.id}`);
    } else {
      original.current = JSON.stringify(f);
      router.refresh();
    }
  });

  const preco = reais(f.preco);
  const de = reais(f.preco_de);
  const desconto = de > preco && preco > 0 ? Math.round((1 - preco / de) * 100) : 0;
  const estoqueTotal = useMemo(() => f.variantes.reduce((s, v) => s + (Number(v.estoque) || 0), 0), [f.variantes]);
  const invalido = (c: string) => (erro?.campo === c ? { "aria-invalid": true as const } : {});

  return (
    <>
      {rascunho && (
        <div className="p-card p-entra" style={{ marginBottom: 16, display: "flex", alignItems: "center", gap: 12, justifyContent: "space-between", flexWrap: "wrap", borderColor: "var(--alerta)" }}>
          <span><b>Tem alterações que não foram salvas.</b> <span style={{ color: "var(--texto-2)" }}>Quer recuperar?</span></span>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="p-btn p-btn--fantasma p-btn--p" onClick={() => { try { localStorage.removeItem(chaveRascunho); } catch {} setRascunho(null); }}>Descartar</button>
            <button className="p-btn p-btn--vidro p-btn--p" onClick={() => { setF(rascunho); setRascunho(null); }}>Recuperar</button>
          </div>
        </div>
      )}

      <div className="p-grade p-duas" style={{ alignItems: "start" }}>
        <div className="p-grade">
          <section className="p-card p-entra" style={{ "--i": 1 } as React.CSSProperties}>
            <div className="p-card__cab"><h2>Fotos</h2><small style={{ color: "var(--texto-2)" }}>A primeira é a capa. Arraste pra mudar a ordem.</small></div>
            <div className="p-fotos">
              {f.fotos.map((url, i) => (
                <div key={url} className={`p-foto${arrasto === i ? " arrastando" : ""}${alvo === i && arrasto !== i ? " alvo" : ""}`} draggable
                  onDragStart={() => setArrasto(i)} onDragEnd={() => { setArrasto(null); setAlvo(null); }}
                  onDragOver={(e) => { if (arrasto !== null) { e.preventDefault(); setAlvo(i); } }}
                  onDrop={(e) => { e.preventDefault(); if (arrasto !== null && arrasto !== i) moverFoto(arrasto, i); setArrasto(null); setAlvo(null); }}>
                  <img src={url} alt={`Foto ${i + 1}`} />
                  {i === 0 && <span className="p-foto__capa">Capa</span>}
                  <button type="button" className="p-foto__tirar" aria-label={`Tirar foto ${i + 1}`} onClick={() => muda("fotos", f.fotos.filter((x) => x !== url))}><Icone n="x" /></button>
                </div>
              ))}
              {Array.from({ length: subindo }, (_, i) => <div key={`s${i}`} className="p-foto" style={{ display: "grid", placeItems: "center" }}><span className="p-girando" /></div>)}
              <label className={`p-soltar${sobre ? " sobre" : ""}`}
                onDragOver={(e) => { if (arrasto === null) { e.preventDefault(); setSobre(true); } }} onDragLeave={() => setSobre(false)}
                onDrop={(e) => { e.preventDefault(); setSobre(false); if (e.dataTransfer.files.length) enviarFotos(e.dataTransfer.files); }}>
                <Icone n="foto" />
                <span>Arraste fotos ou toque pra escolher</span>
                <input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(e) => { if (e.target.files?.length) enviarFotos(e.target.files); e.target.value = ""; }} />
              </label>
            </div>
          </section>

          <section className="p-card p-entra" style={{ "--i": 2 } as React.CSSProperties}>
            <div className="p-card__cab"><h2>Informações</h2></div>
            <div className="p-form p-form--2">
              <label className="p-campo p-cheio">
                <span>Nome do produto</span>
                <input className="p-input" {...invalido("nome")} value={f.nome} placeholder='Ex.: Smart TV Portátil 21,5" Touch'
                  onChange={(e) => { const v = e.target.value; setF((x) => ({ ...x, nome: v, slug: slugMexido ? x.slug : slugify(v) })); }} />
              </label>
              <label className="p-campo p-cheio">
                <span>Endereço na loja</span>
                <div className="p-prefixo"><b style={{ fontSize: 12 }}>/p/</b>
                  <input className="p-input" {...invalido("slug")} value={f.slug} onChange={(e) => { setSlugMexido(true); muda("slug", slugify(e.target.value)); }} style={{ paddingLeft: 44 }} />
                </div>
              </label>
              <label className="p-campo">
                <span>Marca</span>
                <input className="p-input" value={f.marca} onChange={(e) => muda("marca", e.target.value)} placeholder="Opcional" />
              </label>
              <label className="p-campo">
                <span>Categoria</span>
                <select className="p-input" value={f.categoria_id} onChange={(e) => muda("categoria_id", e.target.value)}>
                  <option value="">Sem categoria</option>
                  {categorias.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
              </label>
              <label className="p-campo p-cheio">
                <span>Descrição</span>
                <textarea className="p-input" value={f.descricao} onChange={(e) => muda("descricao", e.target.value)} placeholder="O que é, pra quem serve, o que vem na caixa." style={{ minHeight: 140 }} />
              </label>
            </div>
          </section>

          <section className="p-card p-entra" style={{ "--i": 3 } as React.CSSProperties}>
            <div className="p-card__cab">
              <h2>Variações e estoque</h2>
              <small style={{ color: "var(--texto-2)" }}>{estoqueTotal} {estoqueTotal === 1 ? "unidade" : "unidades"} no total</small>
            </div>
            <p style={{ margin: "-6px 0 16px", color: "var(--texto-2)", fontSize: 13 }}>
              Cor, voltagem, armazenamento... Produto sem escolha fica com uma variação só (&quot;Único&quot;). Preço próprio é opcional.
            </p>
            <div className="p-variantes" {...invalido("variantes")}>
              {f.variantes.map((v, i) => {
                const mudaV = (k: keyof typeof v, val: string | number | boolean) =>
                  setF((x) => ({ ...x, variantes: x.variantes.map((y, j) => (j === i ? { ...y, [k]: val } : y)) }));
                return (
                  <div className="p-variante" key={v.id ?? `n${i}`}>
                    <label className="p-campo"><span>Variação</span><input className="p-input" value={v.nome} onChange={(e) => mudaV("nome", e.target.value)} placeholder="Ex.: Preto / 128 GB" /></label>
                    <label className="p-campo"><span>SKU</span><input className="p-input" value={v.sku} onChange={(e) => mudaV("sku", e.target.value)} placeholder="Opcional" /></label>
                    <label className="p-campo"><span>Estoque</span><input className="p-input" type="number" min={0} inputMode="numeric" value={v.estoque} onChange={(e) => mudaV("estoque", Math.max(0, Math.floor(Number(e.target.value) || 0)))} /></label>
                    <label className="p-campo"><span>Preço próprio</span><div className="p-prefixo"><b>R$</b><input className="p-input" inputMode="decimal" value={v.preco} onChange={(e) => mudaV("preco", e.target.value)} placeholder={f.preco || "igual"} /></div></label>
                    <button type="button" className="p-btn p-btn--fantasma p-btn--icone" disabled={f.variantes.length === 1} aria-label={`Tirar ${v.nome || "variação"}`}
                      onClick={() => muda("variantes", f.variantes.filter((_, j) => j !== i))}><Icone n="lixo" /></button>
                  </div>
                );
              })}
            </div>
            <button type="button" className="p-btn p-btn--vidro p-btn--p" style={{ marginTop: 14 }}
              onClick={() => muda("variantes", [...f.variantes.map((v) => (v.nome === "Único" && f.variantes.length === 1 ? { ...v, nome: "" } : v)), { nome: "", sku: "", estoque: 0, preco: "", ativo: true }])}>
              <Icone n="mais" /> Adicionar variação
            </button>
          </section>

          <section className="p-card p-entra" style={{ "--i": 4 } as React.CSSProperties}>
            <div className="p-card__cab"><h2>Ficha técnica</h2><small style={{ color: "var(--texto-2)" }}>Aparece na página do produto</small></div>
            <div className="p-variantes">
              {f.especificacoes.map((e, i) => (
                <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 1.4fr 38px", gap: 10, alignItems: "center" }}>
                  <input className="p-input" value={e.nome} placeholder="Ex.: Tela" aria-label="Característica"
                    onChange={(ev) => muda("especificacoes", f.especificacoes.map((x, j) => (j === i ? { ...x, nome: ev.target.value } : x)))} />
                  <input className="p-input" value={e.valor} placeholder='Ex.: 21,5" Full HD' aria-label="Valor"
                    onChange={(ev) => muda("especificacoes", f.especificacoes.map((x, j) => (j === i ? { ...x, valor: ev.target.value } : x)))} />
                  <button type="button" className="p-btn p-btn--fantasma p-btn--icone" aria-label="Tirar linha" onClick={() => muda("especificacoes", f.especificacoes.filter((_, j) => j !== i))}><Icone n="lixo" /></button>
                </div>
              ))}
            </div>
            <button type="button" className="p-btn p-btn--vidro p-btn--p" style={{ marginTop: 14 }} onClick={() => muda("especificacoes", [...f.especificacoes, { nome: "", valor: "" }])}>
              <Icone n="mais" /> Adicionar linha
            </button>
          </section>
        </div>

        <div className="p-grade">
          <section className="p-card p-entra" style={{ "--i": 2 } as React.CSSProperties}>
            <div className="p-card__cab"><h2>Preço</h2>{desconto > 0 && <span className="p-selo p-selo--erro">-{desconto}%</span>}</div>
            <div className="p-form">
              <label className="p-campo"><span>Preço de venda</span><div className="p-prefixo"><b>R$</b><input className="p-input" {...invalido("preco")} inputMode="decimal" value={f.preco} onChange={(e) => muda("preco", e.target.value)} placeholder="0,00" /></div></label>
              <label className="p-campo"><span>Preço &quot;de&quot; (riscado)</span><div className="p-prefixo"><b>R$</b><input className="p-input" {...invalido("preco_de")} inputMode="decimal" value={f.preco_de} onChange={(e) => muda("preco_de", e.target.value)} placeholder="Opcional" /></div>
                <small>Só quando o desconto for de verdade.</small></label>
            </div>
            {preco > 0 && (
              <div className="p-contas">
                <div><span>No Pix ({pagamento.pix_desconto_pct}% off)</span><b style={{ color: "var(--pix)" }}>{brl(preco * (1 - pagamento.pix_desconto_pct / 100))}</b></div>
                <div><span>No cartão</span><span>{pagamento.parcelas_sem_juros}x de {brl(preco / pagamento.parcelas_sem_juros)}</span></div>
              </div>
            )}
          </section>

          <section className="p-card p-entra" style={{ "--i": 3 } as React.CSSProperties}>
            <div className="p-card__cab"><h2>Na loja</h2></div>
            <div className="p-form">
              <label className="p-chave"><input type="checkbox" checked={f.ativo} onChange={(e) => muda("ativo", e.target.checked)} /><i />Aparece na loja</label>
              <label className="p-chave"><input type="checkbox" checked={f.mais_vendido} onChange={(e) => muda("mais_vendido", e.target.checked)} /><i />Na vitrine &quot;Mais vendidos&quot;</label>
              <label className="p-chave"><input type="checkbox" checked={f.oferta} onChange={(e) => muda("oferta", e.target.checked)} /><i />Na vitrine &quot;Ofertas da semana&quot;</label>
              <label className="p-chave"><input type="checkbox" checked={f.destaque} onChange={(e) => muda("destaque", e.target.checked)} /><i />Destaque na home</label>
            </div>
          </section>

          <section className="p-card p-entra" style={{ "--i": 4 } as React.CSSProperties}>
            <div className="p-card__cab"><h2>Pacote pro frete</h2></div>
            <div className="p-form p-form--2">
              <label className="p-campo"><span>Peso (g)</span><input className="p-input" type="number" min={1} value={f.peso_gramas} onChange={(e) => muda("peso_gramas", Number(e.target.value))} /></label>
              <label className="p-campo"><span>Altura (cm)</span><input className="p-input" type="number" min={1} value={f.altura_cm} onChange={(e) => muda("altura_cm", Number(e.target.value))} /></label>
              <label className="p-campo"><span>Largura (cm)</span><input className="p-input" type="number" min={1} value={f.largura_cm} onChange={(e) => muda("largura_cm", Number(e.target.value))} /></label>
              <label className="p-campo"><span>Comprimento (cm)</span><input className="p-input" type="number" min={1} value={f.comprimento_cm} onChange={(e) => muda("comprimento_cm", Number(e.target.value))} /></label>
            </div>
          </section>

          {f.id && (
            <section className="p-card p-entra" style={{ "--i": 5, display: "flex", gap: 8, flexWrap: "wrap" } as React.CSSProperties}>
              <button type="button" className="p-btn p-btn--vidro p-btn--p" disabled={indo}
                onClick={() => comecar(async () => { const r = await duplicarProduto(f.id!); if (r.ok) { avisar("Cópia criada (escondida da loja)"); router.push(`/painel/produtos/${r.id}`); } else avisar(r.erro, true); })}>
                <Icone n="copiar" /> Duplicar
              </button>
              <button type="button" className="p-btn p-btn--perigo p-btn--p" disabled={indo}
                onClick={() => {
                  if (!confirm("Excluir este produto? Se ele já vendeu, ele só sai da loja (os pedidos continuam).")) return;
                  comecar(async () => {
                    const r = await excluirProduto(f.id!);
                    if (!r.ok) { avisar(r.erro, true); return; }
                    try { localStorage.removeItem(chaveRascunho); } catch {}
                    original.current = JSON.stringify(f);
                    avisar(r.desativado ? "Já tinha vendido: só saiu da loja" : "Produto excluído");
                    router.push("/painel/produtos");
                  });
                }}>
                <Icone n="lixo" /> Excluir
              </button>
            </section>
          )}
        </div>
      </div>

      {(mudou || !f.id || erro) && <div className="p-salvar-barra vidro">
        <span>{erro ? <b style={{ color: "var(--erro)" }}>{erro.texto}</b> : mudou ? "Alterações não salvas" : f.id ? "Tudo salvo" : "Produto novo"}</span>
        <div style={{ display: "flex", gap: 8 }}>
          {mudou && f.id && <button type="button" className="p-btn p-btn--fantasma" onClick={() => { setF(JSON.parse(original.current)); setErro(null); }}>Desfazer</button>}
          <button type="button" className="p-btn p-btn--vermelho" disabled={indo || subindo > 0 || (!mudou && Boolean(f.id))} onClick={salvar}>
            {indo ? <span className="p-girando" /> : <><Icone n="check" /> {f.id ? "Salvar" : "Criar produto"}</>}
          </button>
        </div>
      </div>}
    </>
  );
}
