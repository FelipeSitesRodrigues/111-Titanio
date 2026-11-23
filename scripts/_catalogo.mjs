// Cadastro de produto e categoria fora do painel (semente e "cadastro pelo chat").
// Mesmo formato que o painel grava: preço em centavos, fotos no Storage (bucket produtos) em WebP.
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';

export const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false },
});

export const slugify = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  .replace(/["']/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);

const centavos = (v) => (v == null || v === '' ? null : Math.round(Number(v) * 100));

// arquivo local (ou URL http) → WebP no Storage; devolve a URL pública
export async function subirFoto(origem, pasta, { largura = 1600 } = {}) {
  if (/^https:\/\/.+\.supabase\.co\//.test(origem)) return origem; // já está no Storage
  const bruto = /^https?:/.test(origem) ? Buffer.from(await (await fetch(origem)).arrayBuffer()) : readFileSync(origem);
  const webp = await sharp(bruto).rotate().resize({ width: largura, height: largura, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 82 }).toBuffer();
  const nome = `${pasta}/${createHash('sha1').update(webp).digest('hex').slice(0, 12)}.webp`;
  const { error } = await db.storage.from('produtos').upload(nome, webp, { contentType: 'image/webp', upsert: true });
  if (error) throw new Error(`foto ${path.basename(origem)}: ${error.message}`);
  return db.storage.from('produtos').getPublicUrl(nome).data.publicUrl;
}

export async function salvarCategoria({ slug, nome, imagem, ordem = 0, ativo = true }) {
  slug ??= slugify(nome);
  const url = imagem ? await subirFoto(imagem, `categorias/${slug}`, { largura: 600 }) : null;
  const { data, error } = await db.from('categorias')
    .upsert({ slug, nome, imagem: url, ordem, ativo }, { onConflict: 'slug' }).select('id, slug').single();
  if (error) throw new Error(`categoria ${slug}: ${error.message}`);
  return data;
}

// p: {slug?, nome, marca?, categoria (slug), descricao?, especificacoes?: [{nome, valor}],
//     preco (reais), preco_de?, selos?: ['mais_vendido','oferta','destaque'], fotos?: [arquivo|url],
//     variantes?: [{nome, atributos?, sku?, estoque, preco?}], estoque? (se não tiver variantes),
//     ativo?, peso_gramas?, altura_cm?, largura_cm?, comprimento_cm?}
export async function salvarProduto(p) {
  const slug = p.slug ?? slugify(p.nome);
  let categoria_id = null;
  if (p.categoria) {
    const { data } = await db.from('categorias').select('id').eq('slug', p.categoria).maybeSingle();
    if (!data) throw new Error(`categoria "${p.categoria}" não existe`);
    categoria_id = data.id;
  }
  const fotos = [];
  for (const f of p.fotos ?? []) fotos.push(await subirFoto(f, `produtos/${slug}`));
  const selos = new Set(p.selos ?? []);
  const linha = {
    slug, nome: p.nome.trim(), marca: p.marca ?? null, descricao: p.descricao ?? '',
    especificacoes: p.especificacoes ?? [], fotos, categoria_id,
    preco_centavos: centavos(p.preco), preco_de_centavos: centavos(p.preco_de),
    mais_vendido: selos.has('mais_vendido'), oferta: selos.has('oferta'), destaque: selos.has('destaque'),
    ativo: p.ativo ?? true, ordem: p.ordem ?? 0,
    ...(p.peso_gramas && { peso_gramas: p.peso_gramas }), ...(p.altura_cm && { altura_cm: p.altura_cm }),
    ...(p.largura_cm && { largura_cm: p.largura_cm }), ...(p.comprimento_cm && { comprimento_cm: p.comprimento_cm }),
  };
  const { data: prod, error } = await db.from('produtos').upsert(linha, { onConflict: 'slug' }).select('id').single();
  if (error) throw new Error(`produto ${slug}: ${error.message}`);

  const variantes = p.variantes?.length ? p.variantes : [{ nome: 'Único', estoque: p.estoque ?? 0 }];
  const nomes = variantes.map((v) => v.nome);
  await db.from('variantes').delete().eq('produto_id', prod.id).not('nome', 'in', `(${nomes.map((n) => `"${n}"`).join(',')})`);
  const { error: ev } = await db.from('variantes').upsert(variantes.map((v, i) => ({
    produto_id: prod.id, nome: v.nome, atributos: v.atributos ?? {}, sku: v.sku ?? null,
    estoque: v.estoque ?? 0, preco_centavos: centavos(v.preco), ativo: v.ativo ?? true, ordem: i,
  })), { onConflict: 'produto_id,nome' });
  if (ev) throw new Error(`variantes de ${slug}: ${ev.message}`);
  return { id: prod.id, slug };
}
