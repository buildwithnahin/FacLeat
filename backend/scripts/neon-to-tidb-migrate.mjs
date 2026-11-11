// Phase 3: one-time data migration — copies every row from the live Neon
// (Postgres) database into TiDB (MySQL), preserving all IDs/relations, and
// reshapes the 4 models whose scalar-array fields became join tables in the
// MySQL schema (ApprovalRule, Document, SalaryComponent, SalaryStructure).
//
// Usage:
//   node scripts/neon-to-tidb-migrate.mjs --dry-run   (counts only, no writes)
//   node scripts/neon-to-tidb-migrate.mjs             (real run)
//
// Safe to re-run: TRUNCATEs every target table (FK checks off) before
// inserting, so a re-run fully replaces prior migrated data rather than
// duplicating it.
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
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

// Tables that exist on the Postgres side but must NOT be copied: Prisma's
// own migration-history bookkeeping table. The MySQL side already has its
// own single row for the fresh baseline migration — copying Postgres's 49
// rows over would corrupt migration history on the new database.
const SKIP_TABLES = new Set(['_prisma_migrations']);

// The 4 models whose Postgres scalar-array column(s) became a MySQL join
// table. For each: which source column(s) to drop from the main INSERT,
// and how to turn the array value into rows for the new join table.
const ARRAY_FIELD_REDESIGNS = {
  ApprovalRule: {
    dropColumns: ['approverRoles'],
    buildJoinRows: (row) => {
      const roles = row.approverRoles ?? [];
      return {
        table: 'ApprovalRuleApprover',
        rows: roles.map((role, i) => ({
          id: randomUUID(),
          ruleId: row.id,
          role,
          sequence: i + 1,
        })),
      };
    },
  },
  Document: {
    dropColumns: ['tags'],
    buildJoinRows: (row) => {
      const tags = row.tags ?? [];
      return {
        table: 'DocumentTag',
        rows: tags.map((tag) => ({ id: randomUUID(), documentId: row.id, tag })),
      };
    },
  },
  SalaryComponent: {
    dropColumns: ['applicableEmploymentTypes', 'applicableDepartments', 'applicableDesignations'],
    buildJoinRows: (row) => {
      const rows = [
        ...(row.applicableEmploymentTypes ?? []).map((value) => ({ kind: 'EMPLOYMENT_TYPE', value })),
        ...(row.applicableDepartments ?? []).map((value) => ({ kind: 'DEPARTMENT', value })),
        ...(row.applicableDesignations ?? []).map((value) => ({ kind: 'DESIGNATION', value })),
      ].map((r) => ({ id: randomUUID(), componentId: row.id, ...r }));
      return { table: 'SalaryComponentApplicability', rows };
    },
  },
  SalaryStructure: {
    dropColumns: ['employmentTypes', 'departmentIds', 'designationIds', 'branchIds'],
    buildJoinRows: (row) => {
      const rows = [
        ...(row.employmentTypes ?? []).map((value) => ({ kind: 'EMPLOYMENT_TYPE', value })),
        ...(row.departmentIds ?? []).map((value) => ({ kind: 'DEPARTMENT', value })),
        ...(row.designationIds ?? []).map((value) => ({ kind: 'DESIGNATION', value })),
        ...(row.branchIds ?? []).map((value) => ({ kind: 'BRANCH', value })),
      ].map((r) => ({ id: randomUUID(), salaryStructureId: row.id, ...r }));
      return { table: 'SalaryStructureApplicability', rows };
    },
  },
};

function toMysqlValue(v) {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return v;
  if (Array.isArray(v) || (typeof v === 'object' && v !== null)) return JSON.stringify(v);
  return v;
}

async function insertRows(conn, table, columns, rows) {
  if (rows.length === 0) return 0;
  const placeholders = `(${columns.map(() => '?').join(', ')})`;
  const sql = `INSERT INTO \`${table}\` (${columns.map((c) => `\`${c}\``).join(', ')}) VALUES ${rows
    .map(() => placeholders)
    .join(', ')}`;
  const values = rows.flatMap((row) => columns.map((c) => toMysqlValue(row[c])));
  await conn.query(sql, values);
  return rows.length;
}

async function main() {
  const pgClient = new pg.Client({ connectionString: env.NEON_DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await pgClient.connect();
  const myConn = await mysql.createConnection({
    uri: env.DATABASE_URL,
    ssl: { minVersion: 'TLSv1.2' },
    multipleStatements: false,
  });

  console.log(DRY_RUN ? '=== DRY RUN (no writes) ===' : '=== LIVE RUN ===');

  const { rows: tableRows } = await pgClient.query(`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;
  `);
  const tables = tableRows.map((r) => r.tablename).filter((t) => !SKIP_TABLES.has(t));

  if (!DRY_RUN) {
    await myConn.query('SET FOREIGN_KEY_CHECKS = 0');
  }

  const summary = [];
  const joinTableTotals = {};

  for (const table of tables) {
    const { rows } = await pgClient.query(`SELECT * FROM "${table}";`);
    const redesign = ARRAY_FIELD_REDESIGNS[table];

    if (!DRY_RUN) {
      await myConn.query(`TRUNCATE TABLE \`${table}\``).catch(async (e) => {
        // TRUNCATE can fail on a table still referenced by an FK even with
        // FK checks off on some engines; fall back to DELETE.
        console.warn(`  (truncate fallback to delete for ${table}: ${e.message})`);
        await myConn.query(`DELETE FROM \`${table}\``);
      });
    }

    if (rows.length === 0) {
      summary.push({ table, count: 0 });
      continue;
    }

    let columns = Object.keys(rows[0]);
    let joinInserts = [];

    if (redesign) {
      columns = columns.filter((c) => !redesign.dropColumns.includes(c));
      for (const row of rows) {
        const { table: joinTable, rows: joinRows } = redesign.buildJoinRows(row);
        if (joinRows.length > 0) joinInserts.push({ joinTable, joinRows });
      }
    }

    if (!DRY_RUN) {
      await insertRows(myConn, table, columns, rows);
      for (const { joinTable, joinRows } of joinInserts) {
        const jCols = Object.keys(joinRows[0]);
        // Truncate each join table exactly once across the whole run.
        if (!joinTableTotals[joinTable]) {
          await myConn.query(`TRUNCATE TABLE \`${joinTable}\``).catch(async () => {
            await myConn.query(`DELETE FROM \`${joinTable}\``);
          });
        }
        const n = await insertRows(myConn, joinTable, jCols, joinRows);
        joinTableTotals[joinTable] = (joinTableTotals[joinTable] || 0) + n;
      }
    } else {
      for (const { joinTable, joinRows } of joinInserts) {
        joinTableTotals[joinTable] = (joinTableTotals[joinTable] || 0) + joinRows.length;
      }
    }

    summary.push({ table, count: rows.length });
  }

  if (!DRY_RUN) {
    await myConn.query('SET FOREIGN_KEY_CHECKS = 1');
  }

  console.log('\n--- Source table row counts (copied as-is) ---');
  for (const { table, count } of summary) {
    if (count > 0) console.log(`${String(count).padStart(6)}  ${table}`);
  }
  console.log('\n--- New join-table rows generated from redesigned array fields ---');
  for (const [t, n] of Object.entries(joinTableTotals)) {
    console.log(`${String(n).padStart(6)}  ${t}`);
  }
  console.log(`\nTotal source rows: ${summary.reduce((s, r) => s + r.count, 0)}`);
  console.log(`Total join rows generated: ${Object.values(joinTableTotals).reduce((s, n) => s + n, 0)}`);

  await pgClient.end();
  await myConn.end();
}

main().catch((e) => {
  console.error('MIGRATION FAILED:', e);
  process.exit(1);
});
