// cPanel go-live: one-time data migration — copies every row from TiDB
// (MySQL) into the new cPanel-hosted MySQL/MariaDB database. Both sides are
// already MySQL-shaped (the array-field -> join-table redesign happened in
// the earlier Neon->TiDB migration), so this is a straight 1:1 table copy —
// no reshaping needed, unlike the Postgres->MySQL migration.
//
// Usage:
//   node scripts/tidb-to-cpanel-migrate.mjs --dry-run   (counts only, no writes)
//   node scripts/tidb-to-cpanel-migrate.mjs             (real run)
//
// Safe to re-run: TRUNCATEs every target table (FK checks off) before
// inserting, so a re-run fully replaces prior migrated data rather than
// duplicating it.
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import mysql from 'mysql2/promise';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const DRY_RUN = process.argv.includes('--dry-run');

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

const SKIP_TABLES = new Set(['_prisma_migrations']);

function toMysqlValue(v) {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return v;
  if (Buffer.isBuffer(v)) return v;
  if (Array.isArray(v) || (typeof v === 'object' && v !== null)) return JSON.stringify(v);
  return v;
}

async function insertRows(conn, table, columns, rows) {
  if (rows.length === 0) return 0;
  const placeholders = `(${columns.map(() => '?').join(', ')})`;
  // Batch in chunks so a single statement doesn't blow past MySQL's
  // max_allowed_packet on tables with many rows.
  const CHUNK = 200;
  let inserted = 0;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    const sql = `INSERT INTO \`${table}\` (${columns.map((c) => `\`${c}\``).join(', ')}) VALUES ${chunk
      .map(() => placeholders)
      .join(', ')}`;
    const values = chunk.flatMap((row) => columns.map((c) => toMysqlValue(row[c])));
    await conn.query(sql, values);
    inserted += chunk.length;
  }
  return inserted;
}

async function main() {
  const tidbUrl = new URL(env.DATABASE_URL);
  const srcConn = await mysql.createConnection({
    host: tidbUrl.hostname,
    port: Number(tidbUrl.port || 4000),
    user: decodeURIComponent(tidbUrl.username),
    password: decodeURIComponent(tidbUrl.password),
    database: tidbUrl.pathname.replace(/^\//, ''),
    ssl: { minVersion: 'TLSv1.2' },
  });

  const dstUrl = new URL(env.CPANEL_DATABASE_URL);
  const dstConn = await mysql.createConnection({
    host: dstUrl.hostname,
    port: Number(dstUrl.port || 3306),
    user: decodeURIComponent(dstUrl.username),
    password: decodeURIComponent(dstUrl.password),
    database: dstUrl.pathname.replace(/^\//, ''),
  });

  console.log(DRY_RUN ? '=== DRY RUN (no writes) ===' : '=== LIVE RUN ===');

  const [tableRows] = await srcConn.query(
    `SELECT TABLE_NAME AS name FROM information_schema.tables WHERE table_schema = DATABASE() ORDER BY TABLE_NAME;`,
  );
  const tables = tableRows.map((r) => r.name).filter((t) => !SKIP_TABLES.has(t));

  if (!DRY_RUN) await dstConn.query('SET FOREIGN_KEY_CHECKS = 0');

  const summary = [];
  for (const table of tables) {
    const [rows] = await srcConn.query(`SELECT * FROM \`${table}\`;`);

    if (!DRY_RUN) {
      await dstConn.query(`TRUNCATE TABLE \`${table}\``).catch(async (e) => {
        console.warn(`  (truncate fallback to delete for ${table}: ${e.message})`);
        await dstConn.query(`DELETE FROM \`${table}\``);
      });
    }

    if (rows.length === 0) {
      summary.push({ table, count: 0 });
      continue;
    }

    const columns = Object.keys(rows[0]);
    if (!DRY_RUN) await insertRows(dstConn, table, columns, rows);
    summary.push({ table, count: rows.length });
  }

  if (!DRY_RUN) await dstConn.query('SET FOREIGN_KEY_CHECKS = 1');

  console.log('\n--- Table row counts ---');
  for (const { table, count } of summary) {
    if (count > 0) console.log(`${String(count).padStart(6)}  ${table}`);
  }
  console.log(`\nTotal rows: ${summary.reduce((s, r) => s + r.count, 0)}`);

  await srcConn.end();
  await dstConn.end();
}

main().catch((e) => {
  console.error('MIGRATION FAILED:', e);
  process.exit(1);
});
