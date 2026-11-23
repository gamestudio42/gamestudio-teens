// Browser smoke test: open the studio, create a Neon project, visit every tab,
// play for a moment and fail on any page error.
import { chromium } from 'playwright';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1366, height: 820 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.route(/fonts\.(googleapis|gstatic)/, (r) => r.abort());
await page.goto(pathToFileURL(resolve('index.html')).href);
await page.uncheck('#chk-tour');
await page.click('#btn-new');
await page.waitForSelector('#studio:not([hidden])');
for (const tab of ['#tab-arte', '#tab-regras', '#tab-fases', '#tab-testar']) {
  await page.click(tab);
  await page.waitForTimeout(300);
  if (tab === '#tab-arte') {
    const tool = await page.locator('#art-undo').boundingBox();
    if (!tool || tool.height > 42) fail('desktop art tool grew: ' + JSON.stringify(tool));
  }
  if (tab === '#tab-regras') {
    const box = await page.locator('#rules-gravity').boundingBox();
    if (!box || Math.abs(box.width - 18) > 1.5 || Math.abs(box.height - 18) > 1.5) fail('desktop checkbox changed: ' + JSON.stringify(box));
  }
  if (tab === '#tab-fases') {
    const hint = await page.textContent('#lvl-hint');
    if (!hint || !hint.includes('Botão direito apaga')) fail('desktop level hint: ' + hint);
    const tool = await page.locator('#lvl-erase').boundingBox();
    if (!tool || tool.height > 42) fail('desktop erase tool grew: ' + JSON.stringify(tool));
    const painted = await page.evaluate(() => {
      const level = GS.app.project.levels[GS.app.levelIndex];
      const canvas = document.getElementById('lvl-canvas');
      const rect = canvas.getBoundingClientRect();
      const cellW = rect.width / level.w, cellH = rect.height / level.h;
      const at = (i, type, button) => {
        const x = rect.left + ((i % level.w) + 0.5) * cellW;
        const y = rect.top + (Math.floor(i / level.w) + 0.5) * cellH;
        const base = { bubbles: true, cancelable: true, clientX: x, clientY: y, pointerId: 1, pointerType: type, button, buttons: button === 2 ? 2 : 1 };
        canvas.dispatchEvent(new PointerEvent('pointerdown', base));
        return { x, y, base };
      };
      const empty = level.cells.findIndex((id) => !id);
      const filled = level.cells.findIndex((id) => {
        const actor = id && GS.app.project.actors.find((a) => a.id === id);
        return actor && actor.kind !== 'jogador';
      });
      if (empty < 0 || filled < 0) return { ok: false, reason: 'missing cell' };
      at(empty, 'mouse', 0);
      const placedOnDown = level.cells[empty] != null;
      canvas.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, cancelable: true, clientX: 0, clientY: 0, pointerId: 1, pointerType: 'mouse', button: 0 }));
      const spot = at(filled, 'mouse', 2);
      const erased = level.cells[filled] == null;
      canvas.dispatchEvent(new PointerEvent('pointerup', { ...spot.base, buttons: 0 }));
      return { ok: placedOnDown && erased, placedOnDown, erased };
    });
    if (!painted.ok) fail('desktop mouse place/erase changed: ' + JSON.stringify(painted));
  }
}
await page.click('#play-debug');
await page.keyboard.down('ArrowRight'); await page.waitForTimeout(800); await page.keyboard.up('ArrowRight');

const fail = (msg) => errors.push(msg);
if (await page.evaluate(() => document.body.classList.contains('play-focus'))) fail('desktop play entered phone focus');

await page.click('#btn-share-studio');
await page.waitForSelector('#share:not([hidden])');
const shareText = await page.textContent('#share-text');
if (!shareText || !shareText.includes('só abre neste aparelho')) fail('file address should stay on this device: ' + shareText);
if (!(await page.locator('#share-qr').isHidden())) fail('local address drew a QR code');
const qr = await page.evaluate(() => {
  const text = 'https://gamestudio42.github.io/gamestudio-teens/';
  const grid = GS.qr.modules(text);
  const canvas = document.createElement('canvas');
  const ok = GS.qr.draw(canvas, text);
  const px = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
  let dark = 0;
  for (let i = 0; i < px.length; i += 4) if (px[i] < 40) dark++;
  return { n: grid && grid.length, ok, dark };
});
if (!qr.ok || !qr.n || qr.n < 21 || qr.dark < 100) fail('QR encoder did not draw the public address: ' + JSON.stringify(qr));
await page.click('#share-close');

await page.setViewportSize({ width: 390, height: 700 });
await page.waitForFunction(() => document.body.classList.contains('play-focus'));
await page.waitForSelector('#btn-play-back', { state: 'visible' });
await page.click('#btn-play-back');
await page.waitForFunction(() => !document.body.classList.contains('play-focus'));
if (await page.locator('#view-fases').isHidden()) fail('back from phone play did not return to Fases');

await page.click('#btn-tour');
if (await page.evaluate(() => document.body.classList.contains('tour-dock'))) fail('desktop tour docked over the editor');
await page.click('#tab-testar');
await page.waitForFunction(() => document.body.classList.contains('touring') && !document.body.classList.contains('play-focus'));
await page.click('#tour-skip');
await page.waitForFunction(() => !document.body.classList.contains('touring') && document.body.classList.contains('play-focus'));

const phone = await browser.newContext({ viewport: { width: 360, height: 740 }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 });
const touch = await phone.newPage();
touch.on('pageerror', (e) => errors.push(e.message));
await touch.route(/fonts\.(googleapis|gstatic)/, (r) => r.abort());
await touch.goto(pathToFileURL(resolve('index.html')).href);
if (!await touch.evaluate(() => matchMedia('(pointer: coarse)').matches)) fail('touch emulation is not pointer: coarse');
await touch.uncheck('#chk-tour');
await touch.click('#btn-new');
await touch.waitForSelector('#studio:not([hidden])');
await touch.click('#tab-fases');
await touch.waitForTimeout(200);
const gestures = await touch.evaluate(async () => {
  const level = GS.app.project.levels[GS.app.levelIndex];
  const canvas = document.getElementById('lvl-canvas');
  const rect = canvas.getBoundingClientRect();
  const cellW = rect.width / level.w, cellH = rect.height / level.h;
  const point = (i) => ({ x: rect.left + ((i % level.w) + 0.5) * cellW, y: rect.top + (Math.floor(i / level.w) + 0.5) * cellH });
  const fire = (name, i, id) => {
    const p = point(i);
    canvas.dispatchEvent(new PointerEvent(name, { bubbles: true, cancelable: true, clientX: p.x, clientY: p.y, pointerId: id, pointerType: 'touch', button: 0, buttons: name === 'pointerup' ? 0 : 1 }));
  };
  const filled = level.cells.findIndex((id) => {
    const actor = id && GS.app.project.actors.find((a) => a.id === id);
    return actor && actor.kind !== 'jogador';
  });
  const empty = level.cells.findIndex((id) => !id);
  if (filled < 0 || empty < 0) return { ok: false, reason: 'missing cell' };
  fire('pointerdown', filled, 3);
  await new Promise((r) => setTimeout(r, 80));
  const stillThere = level.cells[filled] != null;
  await new Promise((r) => setTimeout(r, 600));
  const erased = level.cells[filled] == null;
  fire('pointerup', filled, 3);
  const stayedErased = level.cells[filled] == null;
  fire('pointerdown', empty, 4);
  fire('pointerup', empty, 4);
  return { ok: stillThere && erased && stayedErased && level.cells[empty] != null, stillThere, erased, stayedErased, placed: level.cells[empty] != null };
});
if (!gestures.ok) fail('touch place/long-press erase failed: ' + JSON.stringify(gestures));

async function targetSizes(p, sels) {
  return p.evaluate((sels) => sels.map((sel) => {
    const el = document.querySelector(sel);
    if (!el) return { sel, missing: true };
    const r = el.getBoundingClientRect();
    return { sel, w: r.width, h: r.height, display: getComputedStyle(el).display };
  }), sels);
}
function expectTargets(rows, where) {
  for (const row of rows) {
    if (row.missing || row.display === 'none' || row.w < 43.5 || row.h < 43.5) {
      fail(`${where} ${row.sel} is ${row.missing ? 'missing' : row.display + ' ' + row.w.toFixed(1) + 'x' + row.h.toFixed(1)}`);
    }
  }
}

const viewports = [[360, 740], [412, 915], [915, 412], [820, 1180], [1180, 820]];
for (const [w, h] of viewports) {
  await touch.setViewportSize({ width: w, height: h });
  await touch.click('#tab-arte');
  await touch.waitForTimeout(80);
  expectTargets(await targetSizes(touch, [
    '#btn-home', '#btn-share-studio', '#btn-tour', '#btn-save-file', '#btn-export',
    '#tab-arte', '#tab-regras', '#tab-fases', '#tab-testar',
    '#art-tools [data-tool="lapis"]', '#art-undo', '#art-clear', '#frame-add', '#art-name',
    '#palette .swatch', '#color-edit', '#art-fps', '.size-switch [data-size="16"]', '#art-actors .actor-item',
  ]), `${w}x${h} arte`);
  await touch.click('#tab-regras');
  await touch.waitForTimeout(80);
  expectTargets(await targetSizes(touch, [
    '#rules-gravity', '#btn-vars', '#btn-code', '#rules-preset', '#rule-add',
    '#rules-list .rule-tools .btn', '#rules-actors .actor-item',
  ]), `${w}x${h} regras`);
  await touch.click('#tab-fases');
  await touch.waitForTimeout(80);
  await touch.locator('#lvl-opts').evaluate((d) => { d.open = true; });
  expectTargets(await targetSizes(touch, [
    '#lvl-add', '#lvl-erase', '#lvl-undo', '#lvl-zoom-in', '#lvl-palette .pal-actor',
    '#lvl-name', '#lvl-w', '#lvl-bg', '#lvl-opts summary', '#lvl-list .lvl-item',
  ]), `${w}x${h} fases`);
  const hint = await touch.textContent('#lvl-hint');
  if (!hint || !hint.includes('Segure o dedo') || !hint.includes('Apagar') || hint.includes('Botão direito')) fail(`${w}x${h} touch hint: ${hint}`);
  const eraseLabel = await touch.evaluate(() => getComputedStyle(document.querySelector('#lvl-erase span')).display);
  if (eraseLabel === 'none') fail(`${w}x${h} erase label hidden`);
  await touch.click('#tab-testar');
  await touch.waitForTimeout(80);
  const playSels = ['#play-restart', '#play-music', '#play-debug', '#pad .pb.up', '#pad .abtns .pb'];
  if (await touch.evaluate(() => document.body.classList.contains('play-focus'))) playSels.push('#btn-play-back');
  expectTargets(await targetSizes(touch, playSels), `${w}x${h} testar`);
  if (await touch.evaluate(() => document.body.classList.contains('play-focus'))) await touch.click('#btn-play-back');
  else await touch.click('#tab-fases');
  if (await touch.evaluate(() => GS.Tour.active())) await touch.click('#tour-skip');
  await touch.click('#btn-tour');
  await touch.waitForFunction(() => document.body.classList.contains('tour-dock'));
  await touch.waitForTimeout(60);
  const geom = await touch.evaluate(() => {
    const panel = document.getElementById('tour-panel').getBoundingClientRect();
    const studio = document.getElementById('studio').getBoundingClientRect();
    document.getElementById('lvl-erase').scrollIntoView({ block: 'nearest', inline: 'nearest' });
    const erase = document.getElementById('lvl-erase').getBoundingClientRect();
    const tab = document.getElementById('tab-fases').getBoundingClientRect();
    const hit = (a, b) => a.left < b.right - 1 && a.right > b.left + 1 && a.top < b.bottom - 1 && a.bottom > b.top + 1;
    return { gap: studio.top - panel.bottom, panelH: panel.height, erase: hit(erase, panel), tab: hit(tab, panel) };
  });
  if (geom.panelH < 40 || geom.gap < -1 || geom.erase || geom.tab) fail(`${w}x${h} tour blocks the editor: ` + JSON.stringify(geom));
  await touch.locator('#lvl-erase').click({ trial: true });
  await touch.locator('#tab-arte').click({ trial: true });
  await touch.click('#tour-skip');
  await touch.waitForFunction(() => !document.body.classList.contains('touring'));
}

await phone.close();
await browser.close();
if (errors.length) { console.error('✗ page errors:\n' + errors.join('\n')); process.exit(1); }
console.log('✓ smoke test passed');
