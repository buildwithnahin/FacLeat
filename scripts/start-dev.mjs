import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';

const cwd = process.cwd();
const nextDir = path.join(cwd, '.next-dev');

try {
  fs.rmSync(nextDir, { recursive: true, force: true });
  console.log('Cleared stale .next-dev cache before starting Next dev.');
} catch (error) {
  console.warn('Could not clear .next-dev cache before dev start.', error);
}

const child = spawn('next', ['dev'], {
  cwd,
  stdio: 'inherit',
  shell: true,
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});
