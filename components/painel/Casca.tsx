"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Icone } from "./Icone";
import { Avisos } from "./Avisos";
import { supabaseNavegador } from "@/lib/supabase/navegador";
import { falarSaudacao } from "@/lib/painel/saudacao";

const ITENS = [
  { href: "/painel", nome: "Início", curto: "Início", icone: "inicio" },
  { href: "/painel/pedidos", nome: "Pedidos", curto: "Pedidos", icone: "pedidos" },
  { href: "/painel/produtos", nome: "Produtos", curto: "Produtos", icone: "produtos" },
  { href: "/painel/categorias", nome: "Categorias", curto: "Categ.", icone: "categorias" },
  { href: "/painel/cupons", nome: "Cupons", curto: "Cupons", icone: "cupons" },
  { href: "/painel/clientes", nome: "Clientes", curto: "Clientes", icone: "clientes" },
  { href: "/painel/ajustes", nome: "Ajustes", curto: "Ajustes", icone: "ajustes" },
];

function ativo(caminho: string, href: string) {
  return href === "/painel" ? caminho === "/painel" : caminho === href || caminho.startsWith(href + "/");
}

export function BotaoTema() {
  const [escuro, setEscuro] = useState(false);
  useEffect(() => setEscuro(document.documentElement.dataset.theme === "dark"), []);
  const trocar = () => {
    const novo = escuro ? "light" : "dark";
    document.documentElement.dataset.theme = novo;
    try { localStorage.setItem("tema", novo); } catch {}
    setEscuro(!escuro);
  };
  return (
    <button type="button" className="p-btn p-btn--vidro p-btn--icone" onClick={trocar} aria-label={escuro ? "Usar modo claro" : "Usar modo escuro"} title={escuro ? "Modo claro" : "Modo escuro"}>
      <Icone n={escuro ? "sol" : "lua"} />
    </button>
  );
}

export function Casca({ nome, email, aEnviar, children }: { nome: string; email: string; aEnviar: number; children: React.ReactNode }) {
  const caminho = usePathname();
  const router = useRouter();
  // login já salvo: saúda na 1ª vez que o painel abre nesta sessão (se o navegador deixar tocar som)
  useEffect(() => {
    try { if (sessionStorage.getItem("painel-saudou")) return; } catch { return; }
    falarSaudacao(nome);
  }, [nome]);
  const sair = async () => {
    try { sessionStorage.removeItem("painel-saudou"); } catch {}
    await supabaseNavegador().auth.signOut();
    router.replace("/painel/entrar");
  };
  const iniciais = nome.split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase();
  return (
    <Avisos>
      <div className="p-corpo">
        <div className="p-app">
          <aside className="p-menu vidro">
            <Link href="/painel" className="p-marca" aria-label="Painel da Titânio Importes">
              <img src="/painel/logo-mono.png" alt="" width={38} height={38} />
              <span><b>Titânio</b><small>Painel</small></span>
            </Link>
            <nav className="p-nav" aria-label="Painel">
              {ITENS.map((it) => (
                <Link key={it.href} href={it.href} aria-current={ativo(caminho, it.href) ? "page" : undefined}>
                  <Icone n={it.icone} />
                  {it.nome}
                  {it.href === "/painel/pedidos" && aEnviar > 0 && <span className="p-cont" title="Pedidos pagos esperando envio">{aEnviar}</span>}
                </Link>
              ))}
            </nav>
            <div className="p-menu__fim">
              <div style={{ display: "flex", gap: 8 }}>
                <BotaoTema />
                <a className="p-btn p-btn--vidro" style={{ flex: 1 }} href="/" target="_blank" rel="noopener">
                  <Icone n="loja" /> Ver loja
                </a>
              </div>
              <div className="p-eu">
                <span className="p-eu__ini">{iniciais}</span>
                <div><b>{nome}</b><small>{email}</small></div>
                <button type="button" className="p-btn p-btn--fantasma p-btn--p p-btn--icone" onClick={sair} aria-label="Sair" title="Sair">
                  <Icone n="sair" />
                </button>
              </div>
            </div>
          </aside>

          <main className="p-principal">
            <div className="p-topo-cel">
              <Link href="/painel" className="p-marca" style={{ padding: 0 }}>
                <img src="/painel/logo-mono.png" alt="" width={32} height={32} />
                <span><b>Titânio</b><small>Painel</small></span>
              </Link>
              <div style={{ display: "flex", gap: 8 }}>
                <BotaoTema />
                <button type="button" className="p-btn p-btn--vidro p-btn--icone" onClick={sair} aria-label="Sair"><Icone n="sair" /></button>
              </div>
            </div>
            {children}
          </main>
        </div>

        <nav className="p-barra-cel vidro" aria-label="Painel">
          {ITENS.map((it) => (
            <Link key={it.href} href={it.href} aria-current={ativo(caminho, it.href) ? "page" : undefined}>
              <Icone n={it.icone} />
              {it.curto}
            </Link>
          ))}
        </nav>
      </div>
    </Avisos>
  );
}
