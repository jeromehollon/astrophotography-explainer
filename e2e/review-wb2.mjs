import { chromium } from '@playwright/test';
const OUT = process.argv[2]; const base = 'http://localhost:5194';
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
const say = (...a) => console.log(a.join(' '));
async function settled(timeout = 60000) { await page.waitForFunction(() => { if (/Result pending|Stacking…/.test(document.body.innerText)) return false; return [...document.querySelectorAll('figure [role=img], .h-\\[864px\\] [role=img]')].every((el) => el.querySelector('canvas')); }, null, { timeout, polling: 50 }); }
await page.goto(base + '/#/workbench', { waitUntil: 'networkidle' }); await settled();
await page.locator('button', { hasText: 'Cloud Challenge' }).first().click(); await settled();
say('wb bottom nav', JSON.stringify(await page.$$eval('footer *, nav *', (a) => a.map((x) => x.textContent.trim()).filter((t, i, arr) => t && t.length < 40 && arr.indexOf(t) === i))));
say('wb bottom-nav buttons', JSON.stringify(await page.$$eval('button, a', (a) => a.map((x) => x.textContent.trim()).filter((t) => /^(←|.*→)$/.test(t) && !/Lesson/.test(t)))));
await page.getByText('← Review the exposures').last().click(); await page.waitForURL(/light-frames\/review/); say('wb back link goes to', page.url());
await settled(); await page.waitForTimeout(200);
say('review after cloud scenario: caption', await page.$eval('section p.text-text-on-stage-muted', (e) => e.textContent), 'chips', JSON.stringify(await page.$$eval('[role=radiogroup][aria-label="Stack algorithm"] button', (b) => b.map((x) => x.textContent + ':' + (x.getAttribute('aria-checked') ?? x.getAttribute('aria-pressed'))))), 'checked=', JSON.stringify(await page.$$eval('input[aria-label^="Include frame"]', (i) => i.filter((x) => x.checked).map((x) => x.getAttribute('aria-label').slice(14, 45)))));
await page.screenshot({ path: `${OUT}/review_d_after_cloud_scenario.png`, fullPage: true });
say('review bottom-nav', JSON.stringify(await page.$$eval('button, a', (a) => a.map((x) => x.textContent.trim()).filter((t) => /^(←|.*→)$/.test(t) && !/Lesson/.test(t)))));
// set kappa on workbench then check review chips
await page.goto(base + '/#/workbench'); await settled();
await page.locator('[role=radiogroup][aria-label="Combination method"] button', { hasText: 'Winsorized' }).click(); await settled();
await page.goto(base + '/#/light-frames/review'); await settled();
say('review chips with winsorized in store', JSON.stringify(await page.$$eval('[role=radiogroup][aria-label="Stack algorithm"] button', (b) => b.map((x) => x.textContent + ':' + (x.getAttribute('aria-checked') ?? x.getAttribute('aria-pressed'))))), 'caption', await page.$eval('section p.text-text-on-stage-muted', (e) => e.textContent));
await page.goto(base + '/#/workbench'); await settled();
say('wb method after visiting review', JSON.stringify(await page.$$eval('[role=radiogroup][aria-label="Combination method"] button', (b) => b.map((x) => x.textContent + ':' + (x.getAttribute('aria-checked') ?? x.getAttribute('aria-pressed'))))));
// keyboard tab order
await page.locator('button', { hasText: /^Default$/ }).click(); await settled();
await page.evaluate(() => window.scrollTo(0, 0));
const stops = [];
for (let i = 0; i < 40; i++) { await page.keyboard.press('Tab'); stops.push(await page.evaluate(() => { const a = document.activeElement; return (a?.tagName ?? '?') + ':' + (a?.getAttribute('aria-label') ?? a?.textContent ?? '').trim().slice(0, 28); })); }
say('wb tab stops', JSON.stringify(stops));
// arrow keys in the method radiogroup
await page.locator('[role=radiogroup][aria-label="Combination method"] button', { hasText: 'Median' }).focus(); await page.keyboard.press('ArrowDown'); await page.waitForTimeout(100);
say('after ArrowDown on Median chip: active =', await page.evaluate(() => document.activeElement?.textContent), 'selected =', await page.$eval('[role=radiogroup][aria-label="Combination method"] [aria-checked=true], [role=radiogroup][aria-label="Combination method"] [aria-pressed=true]', (e) => e.textContent).catch(() => '?'));
// hover enlarge on strip tile?
const tile = page.locator('.sticky figure').first(); const before = await tile.boundingBox(); await tile.hover(); await page.waitForTimeout(300); const after = await tile.boundingBox();
say('strip tile hover box before/after', JSON.stringify(before), JSON.stringify(after), 'overlay?', !!(await page.$('[class*=enlarg], dialog, [role=dialog]')));
// topbar sticky?
say('topbar', JSON.stringify(await page.$eval('header', (e) => [getComputedStyle(e).position, e.getBoundingClientRect().top, e.getBoundingClientRect().height]).catch(() => 'no header')));
say('first children', JSON.stringify(await page.$$eval('#root > div > *', (n) => n.map((x) => x.tagName + '.' + x.className.slice(0, 50) + ' pos=' + getComputedStyle(x).position + ' h=' + Math.round(x.getBoundingClientRect().height)))));
await page.evaluate(() => window.scrollTo(0, 2500)); await page.waitForTimeout(200);
say('after scroll: first children', JSON.stringify(await page.$$eval('#root > div > *', (n) => n.map((x) => x.tagName + ' top=' + Math.round(x.getBoundingClientRect().top)))));
// review page: is anything sticky?
await page.goto(base + '/#/light-frames/review'); await settled();
say('review page height', await page.evaluate(() => document.documentElement.scrollHeight), 'wb page height', await (async () => { await page.goto(base + '/#/workbench'); await settled(); return page.evaluate(() => document.documentElement.scrollHeight); })());
say('wb section tops', JSON.stringify(await page.$$eval('h1, h2, .sticky, footer', (n) => n.map((x) => x.textContent.trim().slice(0, 22) + '@' + Math.round(x.getBoundingClientRect().top + window.scrollY)))));
await page.goto(base + '/#/light-frames/review'); await settled();
say('review section tops', JSON.stringify(await page.$$eval('h1, h2, .h-\\[864px\\], .w-\\[616px\\], footer', (n) => n.map((x) => x.textContent.trim().slice(0, 22) + '@' + Math.round(x.getBoundingClientRect().top + window.scrollY) + ' h=' + Math.round(x.getBoundingClientRect().height)))));
await browser.close();
