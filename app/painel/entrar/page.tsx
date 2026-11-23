"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { falarSaudacao } from "@/lib/painel/saudacao";
import { supabaseNavegador } from "@/lib/supabase/navegador";

export default function Entrar() {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [ok, setOk] = useState("");
  const [indo, setIndo] = useState(false);
  const router = useRouter();

  const entrar = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(""); setOk(""); setIndo(true);
    const { data, error } = await supabaseNavegador().auth.signInWithPassword({ email: email.trim().toLowerCase(), password: senha });
    if (error) {
      setIndo(false);
      setErro(/invalid/i.test(error.message) ? "E-mail ou senha não conferem." : "Não deu pra entrar agora. Tente de novo.");
      return;
    }
    // a voz toca ainda no clique de "Entrar" (o navegador só libera som depois de um clique) e a
    // troca de tela é pelo router, sem recarregar, pra o áudio não ser cortado
    falarSaudacao(String(data.user?.user_metadata?.nome ?? ""));
    const volta = new URLSearchParams(window.location.search).get("volta");
    router.replace(volta && volta.startsWith("/painel") ? volta : "/painel");
    router.refresh();
  };

  const esqueci = async () => {
    setErro(""); setOk("");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) { setErro("Escreva seu e-mail acima e toque de novo em \"Esqueci a senha\"."); return; }
    await supabaseNavegador().auth.resetPasswordForEmail(email.trim().toLowerCase(), { redirectTo: `${window.location.origin}/painel/senha` });
    setOk("Se esse e-mail tiver acesso, chega um link pra criar uma senha nova.");
  };

  return (
    <main className="p-entrar">
      <img className="p-entrar__fundo" src="/painel/fundo-entrar.webp" alt="" />
      <form className="p-entrar__caixa" onSubmit={entrar}>
        <div className="p-marca">
          <img src="/painel/logo-mono.png" alt="" width={44} height={44} />
          <span><b>Titânio</b><small>Importes</small></span>
        </div>
        <h1>Painel da loja</h1>
        <p>Pedidos, produtos e vendas num lugar só.</p>
        <div className="p-form">
          <label className="p-campo">
            <span>E-mail</span>
            <input className="p-input" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@email.com" />
          </label>
          <label className="p-campo">
            <span>Senha</span>
            <input className="p-input" type="password" autoComplete="current-password" required value={senha} onChange={(e) => setSenha(e.target.value)} />
          </label>
          {erro && <div className="p-entrar__erro" role="alert">{erro}</div>}
          {ok && <div className="p-entrar__erro" role="status" style={{ background: "rgba(21,128,61,.25)", borderColor: "rgba(74,222,128,.35)" }}>{ok}</div>}
          <button className="p-btn p-btn--vermelho" style={{ height: 48, marginTop: 4 }} disabled={indo}>
            {indo ? <span className="p-girando" /> : "Entrar"}
          </button>
          <button type="button" className="p-entrar__link" onClick={esqueci}>Esqueci a senha</button>
        </div>
      </form>
    </main>
  );
}
