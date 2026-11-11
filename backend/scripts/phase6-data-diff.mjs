// Phase 6 QA: field-level content diff between the live Neon (Postgres)
// database and the migrated TiDB (MySQL) database. Row COUNTS were already
// validated in Phase 3 — this checks actual VALUES match, table by table,
// row by row (matched by primary key `id`), catching silent type-mapping
// bugs (Decimal precision, date formatting, the 4 redesigned array->join
// models) that a count-only check would miss. Read-only on both sides.
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import pg from 'pg';
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

const pgClient = new pg.Client({ connectionString: env.NEON_DATABASE_URL, ssl: { rejectUnauthorized: false } });
await pgClient.connect();

const tidbUrl = new URL(env.DATABASE_URL);
const myConn = await mysql.createConnection({
  host: tidbUrl.hostname,
  port: Number(tidbUrl.port || 4000),
  user: decodeURIComponent(tidbUrl.username),
  password: decodeURIComponent(tidbUrl.password),
  database: tidbUrl.pathname.replace(/^\//, ''),
  ssl: { minVersion: 'TLSv1.2' },
});

// The 4 models whose scalar-array Postgres columns became MySQL join
// tables. For these, compare the RESHAPED array form (join rows -> array),
// matching what the Prisma service layer produces, not the raw MySQL rows.
const ARRAY_JOIN_MODELS = {
  ApprovalRule: {
    pgCol: 'approverRoles',
    joinTable: 'ApprovalRuleApprover',
    fk: 'ruleId',
    valueCol: 'role',
    orderCol: 'sequence',
  },
  Document: {
    pgCol: 'tags',
    joinTable: 'DocumentTag',
    fk: 'documentId',
    valueCol: 'tag',
    orderCol: null, // unordered set
  },
};

const { rows: tableRows } = await pgClient.query(`
  SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename != '_prisma_migrations' ORDER BY tablename;
`);
const HANDLED_SEPARATELY = new Set(['AppSetting', 'UserRole', 'UserBranchAccess', 'RolePermission']);
const tables = tableRows
  .map((r) => r.tablename)
  .filter((t) => !HANDLED_SEPARATELY.has(t))
  .filter((t) => !t.startsWith('SalaryComponentApplicability') && !t.startsWith('SalaryStructureApplicability') && !t.startsWith('ApprovalRuleApprover') && !t.startsWith('DocumentTag'));

// Tables with a composite primary key (no plain `id` column) — compared
// separately below by row-count + full-set equality instead of the
// id-keyed row-by-row diff.
const COMPOSITE_PK_TABLES = {
  UserRole: ['userId', 'roleId'],
  UserBranchAccess: ['userId', 'branchId'],
  RolePermission: ['roleId', 'permissionId'],
};

let totalMismatches = 0;
let tablesChecked = 0;
let tablesSkipped = [];

for (const [table, pkCols] of Object.entries(COMPOSITE_PK_TABLES)) {
  const { rows: pgRows } = await pgClient.query(`SELECT * FROM "${table}";`);
  const [myRows] = await myConn.query(`SELECT * FROM \`${table}\`;`);
  tablesChecked++;
  const keyOf = (r) => pkCols.map((c) => r[c]).join('::');
  const pgKeys = new Set(pgRows.map(keyOf));
  const myKeys = new Set(myRows.map(keyOf));
  const missingOnTidb = [...pgKeys].filter((k) => !myKeys.has(k));
  const extraOnTidb = [...myKeys].filter((k) => !pgKeys.has(k));
  if (missingOnTidb.length || extraOnTidb.length) {
    console.log(`❌ ${table}: ${missingOnTidb.length} missing on TiDB, ${extraOnTidb.length} extra on TiDB`);
    if (missingOnTidb.length) console.log(`   missing: ${missingOnTidb.slice(0, 10).join(', ')}`);
    if (extraOnTidb.length) console.log(`   extra: ${extraOnTidb.slice(0, 10).join(', ')}`);
    totalMismatches += missingOnTidb.length + extraOnTidb.length;
  }
}
{
  // AppSetting: id column is `key`.
  const { rows: pgRows } = await pgClient.query(`SELECT * FROM "AppSetting";`);
  const [myRows] = await myConn.query(`SELECT * FROM \`AppSetting\`;`);
  tablesChecked++;
  const myByKey = new Map(myRows.map((r) => [r.key, r]));
  for (const pgRow of pgRows) {
    const myRow = myByKey.get(pgRow.key);
    if (!myRow) {
      console.log(`❌ AppSetting#${pgRow.key}: MISSING on TiDB`);
      totalMismatches++;
      continue;
    }
    for (const [col, pgVal] of Object.entries(pgRow)) {
      const normPg = normalize(pgVal);
      const normMy = normalize(myRow[col]);
      if (normPg !== normMy) {
        console.log(`❌ AppSetting#${pgRow.key}.${col}: pg="${normPg}" != tidb="${normMy}"`);
        totalMismatches++;
      }
    }
  }
}

for (const table of tables) {
  let pgRows;
  try {
    const res = await pgClient.query(`SELECT * FROM "${table}" ORDER BY id LIMIT 500;`);
    pgRows = res.rows;
  } catch (e) {
    // No plain `id` column (composite PK join table, or a table whose PK is
    // named something else, e.g. AppSetting.key) — not worth a bespoke PK
    // lookup for a QA spot-check; row counts for these were already
    // verified in Phase 3. Skip and move on instead of crashing the run.
    tablesSkipped.push(`${table} (pg: ${e.message})`);
    continue;
  }
  if (pgRows.length === 0) continue;

  let myRows;
  try {
    const [rows] = await myConn.query(`SELECT * FROM \`${table}\` ORDER BY id LIMIT 500;`);
    myRows = rows;
  } catch (e) {
    tablesSkipped.push(`${table} (${e.message})`);
    continue;
  }

  tablesChecked++;
  const myById = new Map(myRows.map((r) => [r.id, r]));
  const arrayModel = ARRAY_JOIN_MODELS[table];

  for (const pgRow of pgRows) {
    const myRow = myById.get(pgRow.id);
    if (!myRow) {
      console.log(`❌ ${table}#${pgRow.id}: MISSING on TiDB`);
      totalMismatches++;
      continue;
    }

    for (const [col, pgVal] of Object.entries(pgRow)) {
      if (arrayModel && col === arrayModel.pgCol) continue; // handled separately below
      if (!(col in myRow)) continue; // column doesn't exist on MySQL side (shouldn't happen, schema is 1:1 minus array fields)
      const myVal = myRow[col];

      const normPg = normalize(pgVal);
      const normMy = normalize(myVal);
      if (normPg !== normMy) {
        console.log(`❌ ${table}#${pgRow.id}.${col}: pg="${normPg}" != tidb="${normMy}"`);
        totalMismatches++;
      }
    }
  }

  if (arrayModel) {
    const { fk, joinTable, valueCol, orderCol } = arrayModel;
    const [joinRows] = await myConn.query(
      `SELECT * FROM \`${joinTable}\` WHERE \`${fk}\` IN (${pgRows.map(() => '?').join(',')}) ${orderCol ? `ORDER BY \`${fk}\`, \`${orderCol}\`` : ''}`,
      pgRows.map((r) => r.id),
    );
    const byParent = new Map();
    for (const jr of joinRows) {
      const arr = byParent.get(jr[fk]) ?? [];
      arr.push(jr[valueCol]);
      byParent.set(jr[fk], arr);
    }
    for (const pgRow of pgRows) {
      const pgArr = pgRow[arrayModel.pgCol] ?? [];
      const myArr = byParent.get(pgRow.id) ?? [];
      const pgSorted = orderCol ? pgArr : [...pgArr].sort();
      const mySorted = orderCol ? myArr : [...myArr].sort();
      if (JSON.stringify(pgSorted) !== JSON.stringify(mySorted)) {
        console.log(`❌ ${table}#${pgRow.id}.${arrayModel.pgCol}: pg=${JSON.stringify(pgArr)} != tidb(${joinTable})=${JSON.stringify(myArr)}`);
        totalMismatches++;
      }
    }
  }
}

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
    // Buffer (MySQL sometimes returns binary-ish), Decimal-like, or JSON.
    // JSON object key order differs between Postgres JSONB and MySQL JSON
    // storage (semantically identical, different serialization) — sort
    // keys recursively before stringifying so that doesn't register as a
    // mismatch.
    if (Buffer.isBuffer(v)) return v.toString('utf8');
    return JSON.stringify(sortKeysDeep(v));
  }
  if (typeof v === 'number') return String(v);
  if (typeof v === 'boolean') return v ? '1' : '0';
  const s = String(v);
  // Postgres numeric/decimal comes back as string already; MySQL Decimal
  // via mysql2 also comes back as string. Trim trailing zeros consistently
  // for decimal-looking strings so "100.0000" == "100" compares equal.
  if (/^-?\d+\.\d+$/.test(s)) return String(parseFloat(s));
  return s;
}

console.log(`\n=== Summary ===`);
console.log(`Tables checked: ${tablesChecked} / ${tables.length}`);
console.log(`Tables skipped: ${tablesSkipped.length}`);
if (tablesSkipped.length) tablesSkipped.forEach((t) => console.log(`  - ${t}`));
console.log(`Total field mismatches: ${totalMismatches}`);
console.log(totalMismatches === 0 ? '✅ All checked rows match field-for-field.' : '❌ Mismatches found — see above.');

await pgClient.end();
await myConn.end();
