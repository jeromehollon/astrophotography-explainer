// Screenshot a page, optionally after clicking the toggle. Usage: node shot2.mjs url out.png [clickSwitch]
import { chromium } from '@playwright/test';
const [url, out, click] = process.argv.slice(2);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
await page.goto(url, { waitUntil: 'networkidle' });
await page.evaluate(() => document.fonts.ready);
if (click) { await page.locator('[role=switch]').first().click(); }
await page.waitForTimeout(500);
await page.screenshot({ path: out, fullPage: true });
const h = await page.evaluate(() => document.documentElement.scrollHeight);
console.log('wrote', out, 'height', h);
await browser.close();
