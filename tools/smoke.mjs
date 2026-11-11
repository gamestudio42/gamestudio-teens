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
for (const tab of ['#tab-arte', '#tab-regras', '#tab-fases', '#tab-testar']) { await page.click(tab); await page.waitForTimeout(300); }
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
await page.click('#tab-testar');
await page.waitForFunction(() => document.body.classList.contains('touring') && !document.body.classList.contains('play-focus'));
await page.click('#tour-skip');
await page.waitForFunction(() => !document.body.classList.contains('touring') && document.body.classList.contains('play-focus'));

await browser.close();
if (errors.length) { console.error('✗ page errors:\n' + errors.join('\n')); process.exit(1); }
console.log('✓ smoke test passed');
