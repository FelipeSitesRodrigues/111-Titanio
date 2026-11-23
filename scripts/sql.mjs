// Roda SQL no Supabase da Titânio pela API de gerenciamento (o token fica em .env.supabase.local, fora do git).
// Uso: node scripts/sql.mjs arquivo.sql   |   node scripts/sql.mjs -e "select 1"
// Também exporta rodarSql(texto) pros outros scripts.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const REF = 'wyhgbwyfbxpezvweeiou';

function token() {
  if (process.env.SUPABASE_ACCESS_TOKEN) return process.env.SUPABASE_ACCESS_TOKEN;
  const env = readFileSync(path.join(AQUI, '..', '.env.supabase.local'), 'utf8');
  const m = env.match(/^SUPABASE_ACCESS_TOKEN=(.+)$/m);
  if (!m) throw new Error('SUPABASE_ACCESS_TOKEN não encontrado em .env.supabase.local');
  return m[1].trim();
}

export async function rodarSql(query) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  const texto = await r.text();
  if (!r.ok) {
    let msg = texto;
    try { msg = JSON.parse(texto).message ?? texto; } catch {}
    throw new Error(msg);
  }
  return JSON.parse(texto);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const i = process.argv.indexOf('-e');
  const query = i > -1 ? process.argv[i + 1] : readFileSync(process.argv[2], 'utf8');
  try {
    const linhas = await rodarSql(query);
    console.table(linhas);
  } catch (e) {
    console.error('ERRO:', e.message);
    process.exitCode = 1;
  }
}
