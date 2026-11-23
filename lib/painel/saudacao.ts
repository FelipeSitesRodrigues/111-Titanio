// Saudação do painel pela hora de São Paulo: 5h–11h bom dia, 12h–17h boa tarde, resto boa noite.
// A voz (public/painel/voz) foi gerada com Kokoro pf_dora; tem versão com "Alex" e sem nome.

export type Turno = "bom-dia" | "boa-tarde" | "boa-noite";

export function turnoAgora(agora = new Date()): Turno {
  const h = Number(agora.toLocaleString("en-US", { timeZone: "America/Sao_Paulo", hour: "numeric", hour12: false })) % 24;
  return h >= 5 && h < 12 ? "bom-dia" : h >= 12 && h < 18 ? "boa-tarde" : "boa-noite";
}

export const TEXTO: Record<Turno, string> = { "bom-dia": "Bom dia", "boa-tarde": "Boa tarde", "boa-noite": "Boa noite" };

const COM_NOME = new Set(["alex"]);

// toca a saudação; devolve false se o navegador bloquear o som (aí só segue sem áudio)
export async function falarSaudacao(nome: string) {
  try {
    // marca antes de tocar: a tela do painel monta enquanto o áudio carrega e não pode tocar de novo
    sessionStorage.setItem("painel-saudou", "1");
    if (localStorage.getItem("painel-voz") === "off") return false;
  } catch {}
  const primeiro = nome.trim().split(/\s+/)[0]?.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "") ?? "";
  const audio = new Audio(`/painel/voz/${turnoAgora()}${COM_NOME.has(primeiro) ? `-${primeiro}` : ""}.mp3`);
  audio.volume = 0.9;
  (window as unknown as { __saudacao?: HTMLAudioElement }).__saudacao = audio; // não deixa o áudio sumir na troca de tela
  try {
    await audio.play();
    return true;
  } catch {
    return false;
  }
}
