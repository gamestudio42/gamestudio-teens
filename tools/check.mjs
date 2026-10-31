// Static checks for the studio: every script parses, every JSON file is valid,
// and every file the service worker caches exists. No dependencies.
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';

let failed = 0;
const fail = (msg) => { console.error('✗ ' + msg); failed++; };

for (const f of readdirSync('js').filter((f) => f.endsWith('.js'))) {
  try { execFileSync(process.execPath, ['--check', 'js/' + f], { stdio: 'pipe' }); }
  catch (e) { fail(`js/${f} does not parse:\n${e.stderr}`); }
}
for (const f of ['manifest.webmanifest', 'gs42.json']) {
  try { JSON.parse(readFileSync(f, 'utf8')); } catch (e) { fail(`${f} is not valid JSON: ${e.message}`); }
}
const sw = readFileSync('sw.js', 'utf8');
const list = sw.match(/const FILES = \[([\s\S]*?)\]/);
if (!list) fail('sw.js has no FILES list');
else for (const [, f] of list[1].matchAll(/'([^']+)'/g)) if (f !== './' && !existsSync(f)) fail(`sw.js caches ${f}, which does not exist`);
for (const [, f] of readFileSync('index.html', 'utf8').matchAll(/(?:src|href)="((?:js|css|icons)\/[^"]+)"/g)) if (!existsSync(f)) fail(`index.html links ${f}, which does not exist`);

if (failed) process.exit(1);
console.log('✓ static checks passed');
