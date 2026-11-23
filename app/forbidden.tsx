export default function Proibido() {
  return (
    <main style={{ minHeight: "100dvh", display: "grid", placeItems: "center", padding: 24, textAlign: "center" }}>
      <div>
        <h1 className="titulo" style={{ fontSize: 28 }}>Sem acesso</h1>
        <p style={{ color: "var(--texto-2)" }}>Seu login não tem permissão pra usar o painel. Fale com o responsável pela loja.</p>
        <a href="/painel/entrar" style={{ color: "var(--vermelho)", fontWeight: 600 }}>Entrar com outra conta</a>
      </div>
    </main>
  );
}
