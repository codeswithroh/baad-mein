// Runs eval.html in a real, visible Chromium (WebGPU needs a GPU-backed window) and streams the log.
// Usage: node scripts/eval-run.mjs dev   (or heldout, dates, or several: dev,heldout)
import { chromium } from 'playwright';

const which = process.argv[2] ?? 'dev';
const base = process.env.BASE ?? 'http://localhost:5179';
// A kept profile, so the 2 GB model is downloaded once and read from the Cache API after that.
const browser = await chromium.launchPersistentContext('.eval-profile', { headless: false, args: ['--enable-unsafe-webgpu'] });
const page = browser.pages()[0] ?? (await browser.newPage());
page.on('console', (m) => console.log(m.text()));
page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
await page.goto(`${base}/eval.html?run=${which}`);
console.log('webgpu:', await page.evaluate(async () => !!(navigator.gpu && (await navigator.gpu.requestAdapter()))));
await page.waitForFunction(() => document.title === 'done' || document.title === 'error', null, { timeout: 0, polling: 2000 });
console.log('TITLE', await page.title());
await browser.close();
