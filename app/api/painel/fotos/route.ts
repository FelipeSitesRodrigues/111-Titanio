import { exigirAdmin } from "@/lib/painel/sessao";
import { MAX_FOTO, subirFoto, TIPOS_FOTO } from "@/lib/fotos";

// recebe uma foto do painel (produto ou categoria) e devolve a URL pública em WebP
export async function POST(req: Request) {
  await exigirAdmin();
  const form = await req.formData();
  const arq = form.get("foto");
  const pasta = String(form.get("pasta") ?? "produtos/avulsas").replace(/[^a-z0-9/-]/g, "").slice(0, 120) || "produtos/avulsas";
  if (!(arq instanceof File)) return Response.json({ erro: "Nenhuma foto recebida." }, { status: 400 });
  if (/heic|heif/i.test(arq.type) || /\.hei[cf]$/i.test(arq.name)) {
    return Response.json({ erro: "Foto do iPhone (HEIC) não é aceita. No iPhone, compartilhe como JPG ou tire um print." }, { status: 415 });
  }
  if (!TIPOS_FOTO.includes(arq.type)) return Response.json({ erro: "Use foto em JPG, PNG ou WebP." }, { status: 415 });
  if (arq.size > MAX_FOTO) return Response.json({ erro: "Foto maior que 12 MB. Diminua e tente de novo." }, { status: 413 });
  try {
    const url = await subirFoto(Buffer.from(await arq.arrayBuffer()), pasta, pasta.startsWith("categorias") ? 600 : 1600);
    return Response.json({ url });
  } catch {
    return Response.json({ erro: "Não consegui ler essa foto. Tente outra." }, { status: 422 });
  }
}
