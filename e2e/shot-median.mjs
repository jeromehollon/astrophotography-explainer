// Full-page screenshot of the Algorithms page with the Median chip selected (Figma frame B, 114:242).
// Usage: node e2e/shot-median.mjs http://localhost:5186/#/algorithms out.png
import { chromium } from '@playwright/test';
const [url, out] = process.argv.slice(2);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
await page.goto(url, { waitUntil: 'networkidle' });
await page.evaluate(() => document.fonts.ready);
await page.getByRole('radio', { name: 'Median' }).click();
await page.waitForTimeout(300);
await page.screenshot({ path: out, fullPage: true });
await browser.close();
