// cPanel go-live QA: field-level content diff between TiDB and the new
// cPanel MySQL database. Both are MySQL-shaped identically (no reshaping
// needed this time), so this is a much simpler comparator than the
// Postgres-vs-MySQL one used for the Neon migration.
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

const COMPOSITE_PK_TABLES = {
  UserRole: ['userId', 'roleId'],
  UserBranchAccess: ['userId', 'branchId'],
  RolePermission: ['roleId', 'permissionId'],
};

function sortKeysDeep(v) {
  if (Array.isArray(v)) return v.map(sortKeysDeep);
  if (v !== null && typeof v === 'object' && !(v instanceof Date) && !Buffer.isBuffer(v)) {
    return Object.fromEntries(Object.keys(v).sort().map((k) => [k, sortKeysDeep(v[k])]));
  }
  return v;
}
function normalize(v) {
  if (v === null || v === undefined) return 'NULL';
  if (v instanceof Date) return v.toISOString();
  if (typeof v === 'object') {
    if (Buffer.isBuffer(v)) return v.toString('utf8');
    return JSON.stringify(sortKeysDeep(v));
  }
  if (typeof v === 'number') return String(v);
  if (typeof v === 'boolean') return v ? '1' : '0';
  const s = String(v);
  if (/^-?\d+\.\d+$/.test(s)) return String(parseFloat(s));
  return s;
}

let totalMismatches = 0;
let tablesChecked = 0;

for (const [table, pkCols] of Object.entries(COMPOSITE_PK_TABLES)) {
  const [srcRows] = await srcConn.query(`SELECT * FROM \`${table}\`;`);
  const [dstRows] = await dstConn.query(`SELECT * FROM \`${table}\`;`);
  tablesChecked++;
  const keyOf = (r) => pkCols.map((c) => r[c]).join('::');
  const srcKeys = new Set(srcRows.map(keyOf));
  const dstKeys = new Set(dstRows.map(keyOf));
  const missing = [...srcKeys].filter((k) => !dstKeys.has(k));
  const extra = [...dstKeys].filter((k) => !srcKeys.has(k));
  if (missing.length || extra.length) {
    console.log(`❌ ${table}: ${missing.length} missing, ${extra.length} extra`);
    totalMismatches += missing.length + extra.length;
  }
}

const [tableRows] = await srcConn.query(
  `SELECT TABLE_NAME AS name FROM information_schema.tables WHERE table_schema = DATABASE() ORDER BY TABLE_NAME;`,
);
const tables = tableRows
  .map((r) => r.name)
  .filter((t) => t !== '_prisma_migrations' && !Object.keys(COMPOSITE_PK_TABLES).includes(t));

for (const table of tables) {
  let srcRows;
  try {
    const [rows] = await srcConn.query(`SELECT * FROM \`${table}\` ORDER BY id LIMIT 1000;`);
    srcRows = rows;
  } catch {
    continue; // no plain `id` column (e.g. AppSetting.key) — spot-checked separately if needed
  }
  if (srcRows.length === 0) continue;

  const [dstRows] = await dstConn.query(`SELECT * FROM \`${table}\` WHERE id IN (${srcRows.map(() => '?').join(',')})`, srcRows.map((r) => r.id));
  tablesChecked++;
  const dstById = new Map(dstRows.map((r) => [r.id, r]));

  for (const srcRow of srcRows) {
    const dstRow = dstById.get(srcRow.id);
    if (!dstRow) {
      console.log(`❌ ${table}#${srcRow.id}: MISSING on cPanel`);
      totalMismatches++;
      continue;
    }
    for (const [col, srcVal] of Object.entries(srcRow)) {
      const normSrc = normalize(srcVal);
      const normDst = normalize(dstRow[col]);
      if (normSrc !== normDst) {
        console.log(`❌ ${table}#${srcRow.id}.${col}: tidb="${normSrc}" != cpanel="${normDst}"`);
        totalMismatches++;
      }
    }
  }
}

console.log(`\n=== Summary ===`);
console.log(`Tables checked: ${tablesChecked}`);
console.log(`Total field mismatches: ${totalMismatches}`);
console.log(totalMismatches === 0 ? '✅ All checked rows match field-for-field.' : '❌ Mismatches found — see above.');

await srcConn.end();
await dstConn.end();
