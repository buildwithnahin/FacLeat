// Render/Vercel/TiDB go-live: one-time data copy from the cPanel-hosted
// MySQL/MariaDB database (current production) into a fresh TiDB Cloud
// cluster. Mirror image of tidb-to-cpanel-migrate.mjs — both sides are
// already MySQL-shaped, so it's a straight 1:1 table copy.
//
// Prerequisite: the target schema must already exist, i.e. run
//   DATABASE_URL=<tidb url> npx prisma migrate deploy
// first. This script only copies rows; it never creates tables.
//
// Run it ON the cPanel server (from ~/public_html/annex_leather_backend/backend)
// so the source can be `localhost` — Remote MySQL access to the cPanel DB is
// intentionally closed. The server can reach TiDB over the internet.
//
// Usage:
//   SRC_DATABASE_URL="mysql://user:pass@localhost:3306/sbmoffic_leather_erp" \
//   DST_DATABASE_URL="mysql://<prefix>.root:pass@gateway01.<region>.prod.aws.tidbcloud.com:4000/<db>" \
//   node scripts/cpanel-to-tidb-migrate.mjs --dry-run     (counts only, no writes)
//   ... same env ... node scripts/cpanel-to-tidb-migrate.mjs   (real run)
//
// Safe to re-run: TRUNCATEs every target table (FK checks off) before
// inserting, so a re-run fully replaces prior data rather than duplicating.
// Ends with a per-table source-vs-target row-count check; exits non-zero on
// any mismatch.
import mysql from 'mysql2/promise';

const DRY_RUN = process.argv.includes('--dry-run');
const SKIP_TABLES = new Set(['_prisma_migrations']);

function connectionFor(urlString, label) {
  if (!urlString) {
    console.error(`Missing ${label}`);
    process.exit(1);
  }
  const url = new URL(urlString);
  const isTidb = url.hostname.endsWith('tidbcloud.com');
  return mysql.createConnection({
    host: url.hostname,
    port: Number(url.port || (isTidb ? 4000 : 3306)),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.replace(/^\//, ''),
    // TiDB's public endpoint requires TLS; the cPanel localhost socket doesn't.
    ...(isTidb ? { ssl: { minVersion: 'TLSv1.2' } } : {}),
  });
}

function toMysqlValue(v) {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return v;
  if (Buffer.isBuffer(v)) return v;
  if (Array.isArray(v) || (typeof v === 'object' && v !== null)) return JSON.stringify(v);
  return v;
}

async function insertRows(conn, table, columns, rows) {
  if (rows.length === 0) return;
  const placeholders = `(${columns.map(() => '?').join(', ')})`;
  const CHUNK = 200;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    const sql = `INSERT INTO \`${table}\` (${columns.map((c) => `\`${c}\``).join(', ')}) VALUES ${chunk
      .map(() => placeholders)
      .join(', ')}`;
    await conn.query(
      sql,
      chunk.flatMap((row) => columns.map((c) => toMysqlValue(row[c]))),
    );
  }
}

async function main() {
  const src = await connectionFor(process.env.SRC_DATABASE_URL, 'SRC_DATABASE_URL');
  const dst = await connectionFor(process.env.DST_DATABASE_URL, 'DST_DATABASE_URL');

  console.log(DRY_RUN ? '=== DRY RUN (no writes) ===' : '=== LIVE RUN ===');

  const [tableRows] = await src.query(
    `SELECT TABLE_NAME AS name FROM information_schema.tables
     WHERE table_schema = DATABASE() AND table_type = 'BASE TABLE' ORDER BY TABLE_NAME;`,
  );
  const tables = tableRows.map((r) => r.name).filter((t) => !SKIP_TABLES.has(t));

  if (!DRY_RUN) await dst.query('SET FOREIGN_KEY_CHECKS = 0');

  const summary = [];
  for (const table of tables) {
    const [rows] = await src.query(`SELECT * FROM \`${table}\`;`);

    if (!DRY_RUN) {
      await dst.query(`TRUNCATE TABLE \`${table}\``).catch(async (e) => {
        console.warn(`  (truncate fallback to delete for ${table}: ${e.message})`);
        await dst.query(`DELETE FROM \`${table}\``);
      });
      if (rows.length > 0) await insertRows(dst, table, Object.keys(rows[0]), rows);
    }
    summary.push({ table, count: rows.length });
  }

  if (!DRY_RUN) await dst.query('SET FOREIGN_KEY_CHECKS = 1');

  console.log('\n--- Source row counts ---');
  for (const { table, count } of summary) if (count > 0) console.log(`${String(count).padStart(6)}  ${table}`);
  console.log(`\nTotal rows: ${summary.reduce((s, r) => s + r.count, 0)}`);

  if (!DRY_RUN) {
    let mismatches = 0;
    for (const { table, count } of summary) {
      const [[{ n }]] = await dst.query(`SELECT COUNT(*) AS n FROM \`${table}\``);
      if (Number(n) !== count) {
        mismatches++;
        console.error(`MISMATCH ${table}: source ${count} vs target ${n}`);
      }
    }
    console.log(mismatches === 0 ? '\nVerified: every table row count matches.' : `\n${mismatches} table(s) mismatched!`);
    if (mismatches) process.exitCode = 1;
  }

  await src.end();
  await dst.end();
}

main().catch((e) => {
  console.error('MIGRATION FAILED:', e);
  process.exit(1);
});
