// cPanel go-live: same pattern as backend/scripts/cpanel-postinstall-build.mjs
// — this account's Terminal/SSH are blocked by a CloudLinux/LVE resource
// limit, so the production build is hooked into npm's postinstall
// lifecycle instead, guarded by CPANEL_DEPLOY=1 so it's a no-op everywhere
// else (Render/Vercel's build, local dev).
import { spawnSync } from 'node:child_process';

if (process.env.CPANEL_DEPLOY !== '1') {
  process.exit(0);
}

console.log('[cpanel-postinstall-build] CPANEL_DEPLOY=1 — running production build...');
const result = spawnSync('npx', ['next', 'build'], { stdio: 'inherit', shell: true });
process.exit(result.status ?? 1);
