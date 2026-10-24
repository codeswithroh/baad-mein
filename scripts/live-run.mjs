// The real path: upload a WhatsApp export in a WebGPU browser and let Gemma read it live.
import { chromium } from 'playwright';
const base = process.env.BASE ?? 'http://localhost:5179';
const ctx = await chromium.launchPersistentContext('.eval-profile', { headless: false, args: ['--enable-unsafe-webgpu'], viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const page = ctx.pages()[0] ?? (await ctx.newPage());
page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
await page.goto(base);
await page.evaluate(() => indexedDB.deleteDatabase('keyval-store'));
await page.locator('#file').setInputFiles(process.argv[2] ?? 'public/sample-chat.txt');
const t0 = Date.now();
await page.locator('#reading').waitFor({ state: 'visible' });
if (process.env.SHOT) { await page.waitForFunction(() => /Read [1-9]\d* of/.test(document.querySelector('#readCount')?.textContent ?? ''), null, { timeout: 120000 }); await page.waitForTimeout(1500); await page.screenshot({ path: process.env.SHOT }); }
await page.locator('#card.active').waitFor({ timeout: 600_000 });
console.log('card in', ((Date.now() - t0) / 1000).toFixed(0), 's:', await page.locator('#cardTitle').textContent(), '|', await page.locator('#cardSource').textContent());
await ctx.close();
