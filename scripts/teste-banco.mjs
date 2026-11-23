// Roda os testes SQL de supabase/testes no Supabase. Cada teste desfaz o que gravou.
// Uso: npm run teste:banco
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { rodarSql } from './sql.mjs';

const PASTA = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'supabase', 'testes');
let falhas = 0, total = 0;
for (const nome of readdirSync(PASTA).filter((f) => f.endsWith('.sql')).sort()) {
  console.log(`\n${nome}`);
  let linhas;
  try {
    linhas = await rodarSql(readFileSync(path.join(PASTA, nome), 'utf8'));
  } catch (e) {
    console.error('  ✗ o arquivo nem rodou:', e.message);
    falhas++; total++; continue;
  }
  for (const l of linhas) {
    total++;
    if (l.ok) console.log('  ✓', l.teste);
    else { falhas++; console.log('  ✗', l.teste, '→', l.msg); }
  }
}
console.log(`\n${total - falhas}/${total} passaram`);
process.exitCode = falhas ? 1 : 0;
