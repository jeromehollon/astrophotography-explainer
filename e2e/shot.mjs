// Full-page screenshot of one app URL at the Figma page width.
// Usage: node e2e/shot.mjs http://localhost:5173/#/welcome out.png [width=1440]
import { chromium } from '@playwright/test';
const [url, out, width = '1440'] = process.argv.slice(2);
if (!url || !out) { console.error('usage: node e2e/shot.mjs <url> <out.png> [width]'); process.exit(2); }
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: Number(width), height: 900 }, deviceScaleFactor: 1 });
await page.goto(url, { waitUntil: 'networkidle' });
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(500);
await page.screenshot({ path: out, fullPage: true });
await browser.close();
console.log('wrote', out);
