import "server-only";
import Stripe from "stripe";

// Sem STRIPE_SECRET_KEY = modo mock (fase 1 e testes). Pedido de exemplo nunca chama a Stripe.
export const stripeAtivo = () => Boolean(process.env.STRIPE_SECRET_KEY);
let cliente: Stripe | null = null;
export function stripe() {
  if (!process.env.STRIPE_SECRET_KEY) throw new Error("STRIPE_SEM_CHAVE");
  cliente ??= new Stripe(process.env.STRIPE_SECRET_KEY);
  return cliente;
}

// estorno total do PaymentIntent; devolve o id do reembolso (ou "mock")
export async function estornar(pi: string | null, motivo?: string) {
  if (!pi || pi.startsWith("pi_exemplo") || !stripeAtivo()) return "mock";
  const r = await stripe().refunds.create({ payment_intent: pi, reason: "requested_by_customer", metadata: { motivo: motivo ?? "" } });
  return r.id;
}
