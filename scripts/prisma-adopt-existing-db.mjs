import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const migrationsDir = path.join(rootDir, 'prisma', 'migrations');

function run(command, args, { allowFailure = false } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: rootDir,
      stdio: 'inherit',
      shell: process.platform === 'win32',
      env: process.env,
    });

    child.on('exit', (code) => {
      if (code === 0 || allowFailure) {
        resolve(code ?? 0);
        return;
      }
      reject(new Error(`${command} ${args.join(' ')} failed with exit code ${code ?? 'unknown'}`));
    });
  });
}

async function listMigrationNames() {
  const entries = await readdir(migrationsDir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b));
}

async function main() {
  console.log('Step 1/3: Syncing the current Prisma schema into the existing database...');
  await run('npx', ['prisma', 'db', 'push']);

  console.log('\nStep 2/3: Marking repository migrations as applied for this existing database...');
  const migrationNames = await listMigrationNames();
  for (const migrationName of migrationNames) {
    const exitCode = await run('npx', ['prisma', 'migrate', 'resolve', '--applied', migrationName], {
      allowFailure: true,
    });
    if (exitCode !== 0) {
      console.log(`Skipping ${migrationName}; it may already be recorded in _prisma_migrations.`);
    }
  }

  console.log('\nStep 3/3: Regenerating the Prisma client...');
  await run('npx', ['prisma', 'generate']);

  console.log('\nExisting database adoption complete.');
  console.log('Next time, use `npm run db:migrate` for new schema changes.');
}

main().catch((error) => {
  console.error('\nFailed to adopt the existing database.');
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
