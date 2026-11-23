// Fase 1: a loja pública ainda é o protótipo (prototipos/home). Ela entra aqui na fase 2.
export default function Inicio() {
  return (
    <main style={{ minHeight: "100dvh", display: "grid", placeItems: "center", padding: 24, textAlign: "center" }}>
      <div>
        <h1 className="titulo" style={{ fontSize: "clamp(28px, 5vw, 48px)" }}>
          Titânio <em>Importes</em>
        </h1>
        <p style={{ color: "var(--texto-2)" }}>A loja está sendo montada.</p>
        <a href="/painel" style={{ color: "var(--vermelho)", fontWeight: 600 }}>Entrar no painel</a>
      </div>
    </main>
  );
}
