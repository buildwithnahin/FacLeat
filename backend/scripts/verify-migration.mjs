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
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq === -1) continue;
    let val = t.slice(eq + 1).trim();
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
    out[t.slice(0, eq).trim()] = val;
  }
  return out;
}
const env = { ...loadEnvFile('.env.local'), ...loadEnvFile('.env') };

const pgClient = new pg.Client({ connectionString: env.NEON_DATABASE_URL, ssl: { rejectUnauthorized: false } });
await pgClient.connect();
const myConn = await mysql.createConnection({ uri: env.DATABASE_URL, ssl: { minVersion: 'TLSv1.2' } });

const { rows: tableRows } = await pgClient.query(
  `SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename != '_prisma_migrations' ORDER BY tablename;`,
);

let mismatches = 0;
for (const { tablename } of tableRows) {
  const { rows: pgCount } = await pgClient.query(`SELECT COUNT(*)::int AS c FROM "${tablename}";`);
  const [myRows] = await myConn.query(`SELECT COUNT(*) AS c FROM \`${tablename}\``);
  const pc = pgCount[0].c;
  const mc = myRows[0].c;
  if (pc !== mc) {
    mismatches++;
    console.log(`MISMATCH  ${tablename}: postgres=${pc} tidb=${mc}`);
  }
}
console.log(mismatches === 0 ? '\n✅ All table row counts match exactly.' : `\n❌ ${mismatches} table(s) mismatched.`);

// Spot-check the redesigned join tables + a couple of relational integrity points.
const [approvers] = await myConn.query('SELECT COUNT(*) AS c FROM `ApprovalRuleApprover`');
const [tags] = await myConn.query('SELECT COUNT(*) AS c FROM `DocumentTag`');
console.log(`\nApprovalRuleApprover rows: ${approvers[0].c} (expect 20)`);
console.log(`DocumentTag rows: ${tags[0].c} (expect 44)`);

const [orphanApprovers] = await myConn.query(`
  SELECT COUNT(*) AS c FROM \`ApprovalRuleApprover\` a
  LEFT JOIN \`ApprovalRule\` r ON r.id = a.ruleId WHERE r.id IS NULL
`);
const [orphanTags] = await myConn.query(`
  SELECT COUNT(*) AS c FROM \`DocumentTag\` t
  LEFT JOIN \`Document\` d ON d.id = t.documentId WHERE d.id IS NULL
`);
console.log(`Orphaned ApprovalRuleApprover rows (should be 0): ${orphanApprovers[0].c}`);
console.log(`Orphaned DocumentTag rows (should be 0): ${orphanTags[0].c}`);

// Confirm one real (non-seed) row round-tripped correctly end to end: the
// Sep-04 ChartAccount edit and the real approval requests seen in AuditLog.
const [recentAudit] = await myConn.query(`
  SELECT module, action, entityType, createdAt FROM \`AuditLog\` ORDER BY createdAt DESC LIMIT 3
`);
console.log('\nMost recent AuditLog rows on TiDB (should match Neon\'s Sep 4-5 activity):');
console.log(recentAudit);

await pgClient.end();
await myConn.end();
