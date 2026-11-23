"use client";
import { useState } from "react";
import { supabaseNavegador } from "@/lib/supabase/navegador";

// chega aqui pelo link do e-mail "esqueci a senha" (a sessão vem no endereço)
export default function NovaSenha() {
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [indo, setIndo] = useState(false);
  const salvar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (senha.length < 8) { setErro("Use pelo menos 8 caracteres."); return; }
    setIndo(true);
    const sb = supabaseNavegador();
    const code = new URLSearchParams(window.location.search).get("code");
    if (code) await sb.auth.exchangeCodeForSession(code);
    const { error } = await sb.auth.updateUser({ password: senha });
    if (error) { setIndo(false); setErro("O link venceu. Peça outro na tela de entrar."); return; }
    window.location.replace("/painel");
  };
  return (
    <main className="p-entrar">
      <img className="p-entrar__fundo" src="/painel/fundo-entrar.webp" alt="" />
      <form className="p-entrar__caixa" onSubmit={salvar}>
        <h1>Senha nova</h1>
        <p>Escolha uma senha com pelo menos 8 caracteres.</p>
        <div className="p-form">
          <label className="p-campo">
            <span>Senha nova</span>
            <input className="p-input" type="password" autoComplete="new-password" value={senha} onChange={(e) => setSenha(e.target.value)} />
          </label>
          {erro && <div className="p-entrar__erro" role="alert">{erro}</div>}
          <button className="p-btn p-btn--vermelho" style={{ height: 48 }} disabled={indo}>{indo ? <span className="p-girando" /> : "Salvar e entrar"}</button>
        </div>
      </form>
    </main>
  );
}
