export const brl = (centavos: number | null | undefined) =>
  ((centavos ?? 0) / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const fuso = { timeZone: "America/Sao_Paulo" } as const;
export const dataHora = (d?: string | null) =>
  d ? new Date(d).toLocaleString("pt-BR", { ...fuso, day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "";
export const data = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString("pt-BR", { ...fuso, day: "2-digit", month: "2-digit", year: "numeric" }) : "";

export type Status =
  | "aguardando_pagamento" | "pago" | "separando" | "enviado" | "entregue" | "cancelado" | "expirado" | "estornado";

export const STATUS: Record<Status, { nome: string; cor: "ok" | "alerta" | "erro" | "info" | "neutro" }> = {
  aguardando_pagamento: { nome: "Aguardando pagamento", cor: "alerta" },
  pago: { nome: "Pago, separar", cor: "ok" },
  separando: { nome: "Separando", cor: "info" },
  enviado: { nome: "Enviado", cor: "info" },
  entregue: { nome: "Entregue", cor: "neutro" },
  cancelado: { nome: "Cancelado", cor: "erro" },
  expirado: { nome: "Pix vencido", cor: "neutro" },
  estornado: { nome: "Estornado", cor: "erro" },
};
export const METODO: Record<string, string> = { pix: "Pix", cartao: "Cartão" };

// erros das funções SQL em português
const ERROS: Record<string, string> = {
  MUDANCA_INVALIDA: "Esse pedido não pode ir pra essa etapa agora.",
  RASTREIO_OBRIGATORIO: "Informe o código de rastreio pra marcar como enviado.",
  JA_ENVIADO: "O pedido já saiu. Use estornar em vez de cancelar.",
  NAO_PAGO: "Esse pedido não foi pago, então não há o que estornar.",
  PEDIDO_INEXISTENTE: "Pedido não encontrado.",
  ESGOTADO: "Sem estoque pra esse item.",
  CUPOM_INVALIDO: "Cupom inválido ou vencido.",
};
export function mensagemErro(e: unknown) {
  const m = (e as { message?: string })?.message ?? String(e);
  const chave = Object.keys(ERROS).find((k) => m.includes(k));
  if (chave) return ERROS[chave];
  if (/duplicate key/.test(m)) return "Já existe um cadastro com esse nome ou código.";
  return "Não deu certo. Tente de novo.";
}

// "2026-11-03" de São Paulo → instante (Brasil sem horário de verão desde 2019: -03:00 fixo)
export const inicioDoDia = (d: string) => `${d}T00:00:00-03:00`;
