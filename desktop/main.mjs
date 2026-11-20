import { app, BrowserWindow, Menu, net, protocol, session } from 'electron';
import { existsSync, realpathSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

/**
 * Desktop window for the Game Studio Teen studio.
 * Serves the repository's own static files (index.html, css, js, icons) from a
 * private origin so the studio boots with no network and no CDN. The page is
 * unchanged from the GitHub Pages site; external requests are refused here.
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const smoke = process.argv.includes('--smoke');

/** Scheme the shell uses so the page is not loaded from file://. */
const SCHEME = 'teen';
/** Fixed host. A standard scheme needs one, and relative URLs stay on it. */
const HOST = 'app';
const ORIGIN = `${SCHEME}://${HOST}`;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

/** Top-level names the page is allowed to read. Anything else stays on disk. */
const ALLOWED = new Set(['index.html', 'manifest.webmanifest', 'sw.js', 'css', 'js', 'icons']);

protocol.registerSchemesAsPrivileged([
  {
    scheme: SCHEME,
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true,
    },
  },
]);

app.setName('gamestudio-teens');
// The page unlocks audio on a click. This keeps the context from staying suspended
// when the window has no browser autoplay gesture yet.
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

/** Directory that holds the studio files: the repo root in development, resources/www when packaged. */
function studioRoot() {
  if (app.isPackaged) return path.join(process.resourcesPath, 'www');
  return path.resolve(here, '..');
}

/**
 * Map a teen:// request onto a file inside the studio directory.
 * Returns null for any other host, a missing file, or a path that escapes the directory.
 */
function resolveStudioFile(requestUrl) {
  let url;
  try {
    url = new URL(requestUrl);
  } catch {
    return null;
  }
  if (url.protocol !== `${SCHEME}:` || url.hostname !== HOST) return null;

  let pathname;
  try {
    pathname = decodeURIComponent(url.pathname);
  } catch {
    return null;
  }
  if (pathname === '' || pathname === '/') pathname = '/index.html';
  const relative = pathname.replace(/^\/+/, '');
  if (!relative || relative.includes('\0') || relative.includes('\\') || relative.split('/').includes('..')) return null;
  const top = relative.split('/')[0];
  if (!ALLOWED.has(top)) return null;

  const root = realpathSync(studioRoot());
  const resolved = path.resolve(root, relative);
  if (!existsSync(resolved) || !statSync(resolved).isFile()) return null;
  const real = realpathSync(resolved);
  if (real !== root && !real.startsWith(root + path.sep)) return null;
  return real;
}

/** Requests the page is allowed to make. file: is limited to the studio directory so the protocol handler can read it. */
function allowRequest(requestUrl) {
  if (requestUrl.startsWith(`${SCHEME}:`) || requestUrl.startsWith('blob:') || requestUrl.startsWith('data:') || requestUrl.startsWith('devtools:')) {
    if (!requestUrl.startsWith(`${SCHEME}:`)) return true;
    try {
      const url = new URL(requestUrl);
      return url.hostname === HOST;
    } catch {
      return false;
    }
  }
  if (!requestUrl.startsWith('file:')) return false;
  let file;
  try {
    file = fileURLToPath(requestUrl);
  } catch {
    return false;
  }
  let root;
  try {
    root = realpathSync(studioRoot());
  } catch {
    return false;
  }
  const resolved = path.resolve(file);
  return resolved === root || resolved.startsWith(root + path.sep);
}

function createWindow() {
  const icon = path.join(studioRoot(), 'icons', 'icon-512.png');
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 640,
    title: 'Game Studio Teen',
    backgroundColor: '#12131c',
    show: !smoke,
    icon: existsSync(icon) ? icon : undefined,
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      backgroundThrottling: !smoke,
    },
  });
  win.removeMenu();
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (event, url) => {
    let next;
    try {
      next = new URL(url);
    } catch {
      event.preventDefault();
      return;
    }
    if (next.protocol !== `${SCHEME}:` || next.hostname !== HOST) event.preventDefault();
  });
  win.webContents.on('before-input-event', (event, input) => {
    if (input.type === 'keyDown' && input.key === 'F11') {
      win.setFullScreen(!win.isFullScreen());
      event.preventDefault();
    }
  });
  void win.loadURL(`${ORIGIN}/index.html`);
  if (smoke) void runSmoke(win);
}

/** `--smoke`: open the home screen hidden, check that the studio booted, print the result and exit. */
async function runSmoke(win) {
  const deadline = Date.now() + 60_000;
  let result = null;
  while (Date.now() < deadline) {
    result = await win.webContents
      .executeJavaScript(
        `({ ready: !!(window.GS && window.GS.app && document.getElementById('home') && !document.getElementById('home').hidden && getComputedStyle(document.body).backgroundColor === 'rgb(18, 19, 28)'), href: location.href, background: getComputedStyle(document.body).backgroundColor })`,
      )
      .catch(() => null);
    if (result?.ready) break;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  const ok = result?.ready === true;
  console.log(`SMOKE ${JSON.stringify(result)}`);
  app.exit(ok ? 0 : 1);
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  const root = studioRoot();
  if (!existsSync(path.join(root, 'index.html'))) {
    console.error(`Studio files were not found at ${root}.`);
    app.exit(1);
    return;
  }
  protocol.handle(SCHEME, (request) => {
    const file = resolveStudioFile(request.url);
    if (!file) return new Response('Not found', { status: 404 });
    return net.fetch(pathToFileURL(file).href).then((res) => {
      if (!res.ok) return new Response('Not found', { status: 404 });
      const headers = new Headers();
      headers.set('Content-Type', MIME[path.extname(file)] ?? 'application/octet-stream');
      // The published page links a font CDN and the shared counter. Neither is required to boot.
      headers.set(
        'Content-Security-Policy',
        "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; media-src 'self' blob:; worker-src 'self' blob:",
      );
      return new Response(res.body, { status: 200, headers });
    });
  });
  session.defaultSession.webRequest.onBeforeRequest({ urls: ['<all_urls>'] }, (details, callback) => {
    callback({ cancel: !allowRequest(details.url) });
  });
  createWindow();
});

app.on('window-all-closed', () => {
  app.quit();
});
