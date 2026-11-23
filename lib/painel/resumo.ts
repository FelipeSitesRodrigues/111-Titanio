import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { inicioDoDia } from "./formato";
import { somarDias, diasEntre } from "./periodo";

export type Resumo = {
  vendas_centavos: number; pedidos: number; ticket_centavos: number; itens: number; estornos_centavos: number;
  serie: { t: string; centavos: number; pedidos: number }[];
  mais_vendidos: { produto_id: string; nome: string; foto: string | null; quantidade: number; centavos: number }[];
  a_enviar: number; aguardando: number;
  estoque_baixo: { produto_id: string; nome: string; variante: string; estoque: number; foto: string | null }[];
};
export type Grao = "hour" | "day" | "week";

export const grao = (de: string, ate: string): Grao => {
  const d = diasEntre(de, ate) as number;
  return d === 1 ? "hour" : d <= 62 ? "day" : "week";
};

export async function resumo(de: string, ate: string, g: Grao): Promise<Resumo> {
  const { data, error } = await supabaseAdmin().rpc("painel_resumo" as never, {
    p_de: inicioDoDia(de), p_ate: inicioDoDia(somarDias(ate, 1)), p_grao: g,
  } as never);
  if (error) throw new Error(error.message);
  return data as unknown as Resumo;
}

// série completa (dias sem venda viram zero) pro gráfico
export function serieCheia(r: Resumo, de: string, ate: string, g: Grao) {
  const mapa = new Map(r.serie.map((s) => [g === "hour" ? s.t.slice(0, 13) : s.t.slice(0, 10), s]));
  const pontos: { chave: string; rotulo: string; centavos: number; pedidos: number }[] = [];
  if (g === "hour") {
    for (let h = 0; h < 24; h++) {
      const chave = `${de}T${String(h).padStart(2, "0")}`;
      const s = mapa.get(chave);
      pontos.push({ chave, rotulo: `${h}h`, centavos: s?.centavos ?? 0, pedidos: s?.pedidos ?? 0 });
    }
    return pontos;
  }
  let d: string = de;
  if (g === "week") { const dia = (new Date(`${de}T12:00:00Z`).getUTCDay() + 6) % 7; d = somarDias(de, -dia); }
  for (; d <= ate; d = somarDias(d, g === "week" ? 7 : 1)) {
    const s = mapa.get(d);
    const [, m, dd] = d.split("-");
    pontos.push({ chave: d, rotulo: `${dd}/${m}`, centavos: s?.centavos ?? 0, pedidos: s?.pedidos ?? 0 });
  }
  return pontos;
}
