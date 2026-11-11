// Phase 0 spike: verify a raw TLS handshake + basic query against the new
// TiDB Cloud Serverless cluster works from this machine, before any Prisma
// schema/migration changes are made. Not part of the app runtime — delete
// once the migration is confirmed working end-to-end.
//
// Usage: node scripts/tidb-connectivity-test.mjs
// Reads DATABASE_URL from backend/.env.local (falls back to .env).

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

const env = { ...loadEnvFile('.env'), ...loadEnvFile('.env.local') };
const connectionString = env.DATABASE_URL || process.env.DATABASE_URL;

if (!connectionString) {
  console.error('DATABASE_URL not found in backend/.env.local or backend/.env');
  process.exit(1);
}

const url = new URL(connectionString);
const maskedUrl = `${url.protocol}//${url.username}:${'*'.repeat(8)}@${url.host}${url.pathname}${url.search}`;
console.log(`Connecting to ${maskedUrl} ...`);

const start = Date.now();

try {
  const conn = await mysql.createConnection({
    host: url.hostname,
    port: Number(url.port || 4000),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.replace(/^\//, ''),
    ssl: { minVersion: 'TLSv1.2' },
    connectTimeout: 15000,
  });

  const [rows] = await conn.query('SELECT VERSION() AS version, DATABASE() AS db, NOW() AS server_time');
  const elapsed = Date.now() - start;

  console.log('✅ Connected and queried successfully.');
  console.log(`   TiDB version : ${rows[0].version}`);
  console.log(`   Database     : ${rows[0].db}`);
  console.log(`   Server time  : ${rows[0].server_time}`);
  console.log(`   Round-trip   : ${elapsed}ms`);

  // Sanity check: confirm the target database is empty (fresh cluster), so
  // we know a Prisma migration baseline can run cleanly against it later.
  const [tables] = await conn.query('SHOW TABLES');
  console.log(`   Existing tables in database: ${tables.length}`);

  await conn.end();
  process.exit(0);
} catch (err) {
  console.error('❌ Connection failed:', err.message);
  if (err.code) console.error('   Code:', err.code);
  process.exit(1);
}
