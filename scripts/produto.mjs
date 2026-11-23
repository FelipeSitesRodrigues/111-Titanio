// Cadastro pelo chat: o Claude escreve um JSON (um produto ou uma lista) e roda
//   npm run produto -- caminho/produto.json
// Cria ou atualiza pelo slug (sem slug, sai do nome). Formato em _catalogo.mjs (salvarProduto).
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { salvarProduto } from './_catalogo.mjs';

const arquivo = process.argv[2];
if (!arquivo) { console.error('uso: npm run produto -- arquivo.json'); process.exit(1); }
const base = path.dirname(path.resolve(arquivo));
const lista = [JSON.parse(readFileSync(arquivo, 'utf8'))].flat();
for (const p of lista) {
  // fotos relativas ao JSON
  p.fotos = (p.fotos ?? []).map((f) => (/^https?:/.test(f) || path.isAbsolute(f) ? f : path.join(base, f)));
  try {
    const r = await salvarProduto(p);
    console.log('✓', r.slug);
  } catch (e) {
    console.error('✗', p.nome, '→', e.message);
    process.exitCode = 1;
  }
}
