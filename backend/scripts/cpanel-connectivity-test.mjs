// cPanel go-live prep: verify a connection to the new cPanel-hosted MySQL
// database works from this machine before doing anything else with it.
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
const connectionString = env.CPANEL_DATABASE_URL;
if (!connectionString) {
  console.error('CPANEL_DATABASE_URL not found in backend/.env.local');
  process.exit(1);
}
const url = new URL(connectionString);
console.log(`Connecting to ${url.protocol}//${url.username}:****@${url.host}${url.pathname} ...`);

try {
  const conn = await mysql.createConnection({
    host: url.hostname,
    port: Number(url.port || 3306),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.replace(/^\//, ''),
    connectTimeout: 15000,
  });
  const [rows] = await conn.query('SELECT VERSION() AS version, DATABASE() AS db, NOW() AS server_time');
  console.log('✅ Connected successfully.');
  console.log(`   MySQL version: ${rows[0].version}`);
  console.log(`   Database     : ${rows[0].db}`);
  console.log(`   Server time  : ${rows[0].server_time}`);
  const [tables] = await conn.query('SHOW TABLES');
  console.log(`   Existing tables: ${tables.length}`);
  await conn.end();
} catch (err) {
  console.error('❌ Connection failed:', err.message);
  if (err.code) console.error('   Code:', err.code);
  process.exit(1);
}
