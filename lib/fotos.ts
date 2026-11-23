import "server-only";
import sharp from "sharp";
import { createHash } from "node:crypto";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const TIPOS_FOTO = ["image/jpeg", "image/png", "image/webp"];
export const MAX_FOTO = 12 * 1024 * 1024;

// qualquer foto → WebP (até 1600 px, gira pela orientação da câmera) no bucket produtos
export async function subirFoto(bruto: Buffer, pasta: string, largura = 1600) {
  const img = sharp(bruto, { failOn: "error" }).rotate();
  const meta = await img.metadata();
  if (!meta.width || !meta.height) throw new Error("FOTO_INVALIDA");
  const webp = await img.resize({ width: largura, height: largura, fit: "inside", withoutEnlargement: true }).webp({ quality: 82 }).toBuffer();
  const nome = `${pasta}/${createHash("sha1").update(webp).digest("hex").slice(0, 12)}.webp`;
  const sb = supabaseAdmin();
  const { error } = await sb.storage.from("produtos").upload(nome, webp, { contentType: "image/webp", upsert: true });
  if (error) throw new Error(error.message);
  return sb.storage.from("produtos").getPublicUrl(nome).data.publicUrl;
}
