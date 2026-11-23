import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";

// chama função SQL e devolve o resultado; erro vira exceção com o código (ex.: MUDANCA_INVALIDA)
export async function rpc<T = unknown>(fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabaseAdmin().rpc(fn, args);
  if (error) throw new Error(error.message);
  return data as T;
}
