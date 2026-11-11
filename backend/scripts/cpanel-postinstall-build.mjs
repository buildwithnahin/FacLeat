// cPanel go-live: this account's Terminal/SSH access is blocked by a
// CloudLinux/LVE resource limit (confirmed — both the browser Terminal and
// direct SSH authenticate fine but the interactive shell fork itself fails),
// so there's no way to run `npm run build` by hand after cPanel's Node.js
// App "Run NPM Install" button finishes. That button *does* work (it's
// driven by cPanel's own backend process, not an interactive user shell),
// so this hooks the production build into npm's postinstall lifecycle —
// but ONLY when CPANEL_DEPLOY=1 is set, so this is a no-op everywhere else
// (Render's build, local dev) and doesn't change behavior there.
import { spawnSync } from 'node:child_process';

if (process.env.CPANEL_DEPLOY !== '1') {
  process.exit(0);
}

console.log('[cpanel-postinstall-build] CPANEL_DEPLOY=1 — running production build...');
const result = spawnSync('npx', ['next', 'build'], { stdio: 'inherit', shell: true });
process.exit(result.status ?? 1);
