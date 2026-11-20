// Assemble the unpacked Linux build, then copy the studio's static files next to it.
// electron-builder packs the shell. The studio stays the files GitHub Pages already serves.
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const desktop = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const root = path.resolve(desktop, '..');
const unpacked = path.join(desktop, 'release', 'linux-unpacked');
const binary = path.join(unpacked, 'gamestudio-teens');

execFileSync(path.join(desktop, 'node_modules', '.bin', 'electron-builder'), ['--linux', 'dir', '--publish', 'never'], {
  cwd: desktop,
  stdio: 'inherit',
});

if (!existsSync(binary)) {
  console.error(`Expected the desktop binary at ${binary}.`);
  process.exit(1);
}

const www = path.join(unpacked, 'resources', 'www');
rmSync(www, { recursive: true, force: true });
mkdirSync(www, { recursive: true });
for (const file of ['index.html', 'manifest.webmanifest', 'sw.js']) {
  cpSync(path.join(root, file), path.join(www, file));
}
for (const dir of ['css', 'js', 'icons']) {
  cpSync(path.join(root, dir), path.join(www, dir), { recursive: true });
}
if (!existsSync(path.join(www, 'index.html'))) {
  console.error('The studio files were not copied into the desktop build.');
  process.exit(1);
}
