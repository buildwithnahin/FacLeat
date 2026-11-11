// One-off helper for Phase 1: wipe the annex_leather_erp database on TiDB
// clean (drop + recreate) after a partially-applied migration failure, so
// `prisma migrate dev` can start from a truly empty database again.
// Usage: node scripts/tidb-reset-db.mjs
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import mysql from 'mysql2/promise';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

function loadEnvFile(file) {
  const filePath = path.join(root, file);
  if (!existsSync(filePath)) return {};
  const out = {};
  for (const line of readFileSync(filePath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
    out[key] = val;
  }
  return out;
}

const env = { ...loadEnvFile('.env.local'), ...loadEnvFile('.env') };
const connectionString = env.DATABASE_URL || process.env.DATABASE_URL;
const url = new URL(connectionString);
const dbName = url.pathname.replace(/^\//, '');

const conn = await mysql.createConnection({
  host: url.hostname,
  port: Number(url.port || 4000),
  user: decodeURIComponent(url.username),
  password: decodeURIComponent(url.password),
  ssl: { minVersion: 'TLSv1.2' },
  connectTimeout: 15000,
  multipleStatements: true,
});

console.log(`Dropping and recreating database "${dbName}" ...`);
await conn.query(`DROP DATABASE IF EXISTS \`${dbName}\`;`);
await conn.query(`CREATE DATABASE \`${dbName}\`;`);
console.log('✅ Done — database is empty.');
await conn.end();
