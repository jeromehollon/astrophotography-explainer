import { chromium } from '@playwright/test';
import fs from 'node:fs';
const OUT = process.argv[2];
const base = 'http://localhost:5194';
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, acceptDownloads: true });
const page = await ctx.newPage();
const log = [];
const say = (...a) => { const s = a.join(' '); console.log(s); log.push(s); fs.appendFileSync(`${OUT}/log.txt`, s + '\n'); };
fs.writeFileSync(`${OUT}/log.txt`, '');
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') say('  [console.' + m.type() + ']', m.text().slice(0, 200)); });
page.on('pageerror', (e) => say('  [pageerror]', String(e).slice(0, 200)));

const busyText = /Result pending|Stacking…/;
async function settled(timeout = 30000) {
  const t0 = Date.now();
  await page.waitForFunction(() => {
    const t = document.body.innerText;
    if (/Result pending|Stacking…/.test(t) || document.querySelector('.opacity-60')) return false;
    // live views: every role=img inside a tile / wide box must hold a canvas (an <img> there is the bundled fallback)
    const imgs = [...document.querySelectorAll('figure [role=img], .h-\\[864px\\] [role=img]')];
    return imgs.every((el) => el.querySelector('canvas'));
  }, null, { timeout, polling: 50 });
  return Date.now() - t0;
}
async function hashOf(selector) {
  // hash the pixels of each canvas/img inside role=img wrappers matching selector
  return page.evaluate((sel) => {
    const els = [...document.querySelectorAll(sel)];
    return els.map((el) => {
      const c = el.querySelector('canvas');
      if (!c) { const i = el.querySelector('img'); return i ? 'img:' + i.getAttribute('src').slice(-40) : 'none'; }
      const ctx = c.getContext('2d'); const d = ctx.getImageData(0, 0, c.width, c.height).data;
      let h = 0, s = 0; for (let i = 0; i < d.length; i += 4 * 97) { h = (h * 31 + d[i]) >>> 0; s += d[i]; }
      return 'canvas:' + c.width + 'x' + c.height + ':' + h.toString(16) + ':' + Math.round(s / (d.length / (4 * 97)));
    });
  }, selector);
}
async function shot(name, full = true) { await page.evaluate(() => document.fonts.ready); await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: full }); say('shot', name); }

// ---------- Review page ----------
let t0 = Date.now();
await page.goto(base + '/#/light-frames/review', { waitUntil: 'networkidle' });
say('review: networkidle after', Date.now() - t0, 'ms');
let ms = await settled(60000); say('review: settled after +', ms, 'ms');
await page.waitForTimeout(300);
await shot('review_a_average_or_default');
say('review: chips', JSON.stringify(await page.$$eval('[role=radiogroup][aria-label="Stack algorithm"] button', (b) => b.map((x) => x.textContent + ':' + x.getAttribute('aria-checked') + ':' + x.getAttribute('aria-pressed')))));
say('review: caption', await page.$eval('section p.text-text-on-stage-muted', (e) => e.textContent));
say('review: headings', JSON.stringify(await page.$$eval('h1,h2', (h) => h.map((x) => x.textContent))));
say('review: lede', await page.$eval('header p', (e) => e.textContent));
say('review: examine p', await page.$$eval('section p', (p) => p.map((x) => x.textContent).filter((t) => /shaded rows|sigma clipping/.test(t)).join(' | ')));
say('review: list header', await page.$$eval('.h-11 span', (s) => s.map((x) => x.textContent + '@' + x.getBoundingClientRect().left).join(', ')));
const rows = await page.$$eval('[role=button][aria-label^="Look at frame"]', (r) => r.map((x) => ({ n: x.querySelector('.w-10')?.textContent, fwhm: x.querySelector('.flex-col span:nth-child(2)')?.textContent, note: x.querySelector('.text-source-external')?.textContent.trim(), checked: x.querySelector('input').checked, bg: getComputedStyle(x).backgroundColor, h: x.getBoundingClientRect().height, w: x.getBoundingClientRect().width, hist: x.querySelector('svg')?.getBoundingClientRect().left - x.getBoundingClientRect().left })));
say('review: rows', rows.length, JSON.stringify(rows));
say('review: viewer', JSON.stringify(await page.$$eval('.w-\\[616px\\] button, .w-\\[616px\\] span.whitespace-nowrap', (e) => e.map((x) => x.textContent))));
say('review: viewer caption', await page.$eval('.w-\\[616px\\] p', (e) => e.textContent));
say('review: tile titles', JSON.stringify(await page.$$eval('figure', (f) => f.map((x) => x.querySelector('figcaption, p, span')?.textContent + ' ' + Math.round(x.getBoundingClientRect().width) + 'x' + Math.round(x.getBoundingClientRect().height)))));
say('review: wide box', JSON.stringify(await page.$eval('.h-\\[864px\\]', (e) => { const r = e.getBoundingClientRect(); return [r.width, r.height]; })));
const wideBefore = (await hashOf('.h-\\[864px\\] [role=img]'))[0];
const roiBefore = await hashOf('figure [role=img]');
say('review: wide hash', wideBefore, 'viewer rois', JSON.stringify(roiBefore));
// median vs average
const chipMedian = page.locator('[role=radiogroup][aria-label="Stack algorithm"] button', { hasText: 'Median' });
const chipAverage = page.locator('[role=radiogroup][aria-label="Stack algorithm"] button', { hasText: 'Average' });
const isMedianOn = (await chipMedian.getAttribute('aria-checked')) === 'true' || (await chipMedian.getAttribute('aria-pressed')) === 'true';
say('review: median initially selected?', isMedianOn);
t0 = Date.now(); await (isMedianOn ? chipAverage : chipMedian).click(); await page.waitForTimeout(50); say('review: 50 ms after toggle the wide view shows', (await hashOf('.h-\\[864px\\] [role=img]'))[0], 'pending-indicator present?', !!(await page.$('.opacity-60'))); ms = await settled(); say('review: method toggle settled (live canvas) in', Date.now() - t0, 'ms');
await page.waitForTimeout(200);
const wideAfter = (await hashOf('.h-\\[864px\\] [role=img]'))[0];
say('review: wide changed after method toggle?', wideBefore !== wideAfter, wideAfter);
say('review: caption now', await page.$eval('section p.text-text-on-stage-muted', (e) => e.textContent));
await shot('review_b_other_method');
// warm toggle back
t0 = Date.now(); await (isMedianOn ? chipMedian : chipAverage).click(); await settled(); say('review: toggle back (warm) settled in', Date.now() - t0, 'ms');
// uncheck frame f03 (row 4)
const cb03 = page.locator('input[aria-label^="Include frame 0003"]');
t0 = Date.now(); await cb03.click(); ms = await settled(); say('review: uncheck 0003 settled in', Date.now() - t0, 'ms');
await page.waitForTimeout(200);
const wideAfterUncheck = (await hashOf('.h-\\[864px\\] [role=img]'))[0];
say('review: wide changed after uncheck?', wideAfter !== wideAfterUncheck && wideBefore !== wideAfterUncheck, wideAfterUncheck);
say('review: caption now', await page.$eval('section p.text-text-on-stage-muted', (e) => e.textContent));
say('review: row 0003 bg', await page.$eval('[aria-label="Look at frame 0003"]', (x) => getComputedStyle(x).backgroundColor));
// Next frame
t0 = Date.now(); await page.locator('button', { hasText: 'Next frame' }).click(); ms = await settled(); say('review: next frame settled in', Date.now() - t0, 'ms');
say('review: viewer now', await page.$eval('.w-\\[616px\\] span.whitespace-nowrap', (e) => e.textContent), '|', await page.$eval('.w-\\[616px\\] p', (e) => e.textContent));
const roiAfter = await hashOf('figure [role=img]');
say('review: viewer rois changed?', JSON.stringify(roiAfter) !== JSON.stringify(roiBefore));
// click a row (0011 tracking)
await page.locator('[aria-label="Look at frame 0011 (Tracking error example)"]').click(); await settled();
say('review: viewer after row click', await page.$eval('.w-\\[616px\\] span.whitespace-nowrap', (e) => e.textContent), '|', await page.$eval('.w-\\[616px\\] p', (e) => e.textContent));
await page.locator('button', { hasText: 'Previous frame' }).click(); await settled();
say('review: viewer after prev', await page.$eval('.w-\\[616px\\] span.whitespace-nowrap', (e) => e.textContent));
await shot('review_c_state_after_edits');
say('review: bottom nav', JSON.stringify(await page.$$eval('nav a, footer a, nav button', (a) => a.map((x) => x.textContent.trim()).filter(Boolean))));

// ---------- Navigate to workbench via the bottom nav (store carry-over) ----------
const wbLink = page.getByText('Workbench →').last(); say('wb link tag', await wbLink.evaluate((e) => e.tagName + ' ' + (e.closest('a')?.getAttribute('href') ?? '')));
t0 = Date.now(); await wbLink.click(); await page.waitForURL(/#\/workbench/);
say('wb: url', page.url());
ms = await settled(60000); say('wb: settled after', Date.now() - t0, 'ms');
await page.waitForTimeout(300);
say('wb: report', JSON.stringify(await page.$$eval('.bg-surface-panel > div', (d) => d.map((x) => x.innerText.replace(/\n/g, ' | ')))));
say('wb: scenario shown', await page.$eval('section p.w-\\[1200px\\]', (e) => e.innerText.replace(/\n/g, ' // ')));
say('wb: method selected', JSON.stringify(await page.$$eval('[role=radiogroup][aria-label="Combination method"] button', (b) => b.map((x) => x.textContent + ':' + (x.getAttribute('aria-checked') ?? x.getAttribute('aria-pressed'))))));
say('wb: 0003 checked?', await page.$eval('input[aria-label^="Include frame 0003"]', (i) => i.checked));
say('wb: flat checks', JSON.stringify(await page.$$eval('input[aria-label^="Flat"], input[aria-label="No flat"]', (i) => i.map((x) => x.getAttribute('aria-label') + ':' + x.checked))));
say('wb: cal checks', JSON.stringify(await page.$$eval('input[aria-label="Bias"], input[aria-label="Dark"], input[aria-label="Dark flat"]', (i) => i.map((x) => x.getAttribute('aria-label') + ':' + x.checked))));
await shot('wb_carry_over_from_review');
// restore default via scenario
t0 = Date.now(); await page.locator('button', { hasText: /^Default$/ }).click(); ms = await settled(); say('wb: Default scenario (cold-ish) settled in', Date.now() - t0, 'ms');

// ---------- Workbench default ----------
await page.goto(base + '/#/workbench', { waitUntil: 'networkidle' });
t0 = Date.now(); await settled(60000); say('wb reload: settled after', Date.now() - t0, 'ms');
await page.waitForTimeout(300);
await shot('wb_a_default');
say('wb: headings', JSON.stringify(await page.$$eval('h1,h2', (h) => h.map((x) => x.textContent))));
say('wb: eyebrow/lede', await page.$eval('header', (e) => e.innerText.replace(/\n/g, ' // ')));
say('wb: links', JSON.stringify(await page.$$eval('a.underline', (a) => a.map((x) => x.textContent + '->' + x.getAttribute('href')))));
say('wb: scenario buttons', JSON.stringify(await page.$$eval('section:nth-of-type(1) button', (b) => b.map((x) => { const r = x.getBoundingClientRect(); return x.textContent + ' ' + Math.round(r.width) + 'x' + Math.round(r.height) + ' bg=' + getComputedStyle(x).backgroundColor; }))));
say('wb: scenario shown', await page.$eval('section p.w-\\[1200px\\]', (e) => e.innerText.replace(/\n/g, ' // ')));
say('wb: cal table', JSON.stringify(await page.$$eval('section:nth-of-type(2) .flex.w-\\[1200px\\].items-start', (r) => r.map((x) => x.innerText.replace(/\n/g, ' | ')))));
say('wb: cal header', await page.$eval('section:nth-of-type(2) .border-b-2', (e) => e.innerText.replace(/\n/g, ' | ')));
say('wb: cal images', JSON.stringify(await page.$$eval('section:nth-of-type(2) img, section:nth-of-type(3) img', (i) => i.map((x) => x.alt + ' ' + Math.round(x.getBoundingClientRect().width) + 'x' + Math.round(x.getBoundingClientRect().height) + ' ' + x.naturalWidth + 'x' + x.naturalHeight))));
say('wb: flat header', await page.$eval('section:nth-of-type(3) .border-b-2', (e) => e.innerText.replace(/\n/g, ' | ')));
say('wb: flat rows', JSON.stringify(await page.$$eval('section:nth-of-type(3) .flex.w-\\[1200px\\].items-start', (r) => r.map((x) => x.innerText.replace(/\n/g, ' | ')))));
say('wb: lights p', await page.$eval('section:nth-of-type(4) p', (e) => e.textContent));
say('wb: method header+rows', JSON.stringify(await page.$$eval('section:nth-of-type(5) .w-\\[1200px\\] > div', (r) => r.map((x) => x.innerText.replace(/\n/g, ' | ')))));
say('wb: report p', await page.$eval('section:nth-of-type(6) > p', (e) => e.textContent));
say('wb: report', JSON.stringify(await page.$$eval('.bg-surface-panel > div', (d) => d.map((x) => x.innerText.replace(/\n/g, ' | ')))));
say('wb: strip tiles', JSON.stringify(await page.$$eval('.sticky figure', (f) => f.map((x) => { const r = x.getBoundingClientRect(); return x.innerText.replace(/\n/g, '/') + ' ' + Math.round(r.left) + ',' + Math.round(r.top) + ' ' + Math.round(r.width) + 'x' + Math.round(r.height); }))));
say('wb: strip box', JSON.stringify(await page.$eval('.sticky', (e) => { const r = e.getBoundingClientRect(); return [r.left, r.top, r.width, r.height, getComputedStyle(e).backgroundColor, getComputedStyle(e).position]; })));
say('wb: topbar box', JSON.stringify(await page.$eval('header, [class*=TopBar], body > div > *:first-child', (e) => { const r = e.getBoundingClientRect(); return [e.tagName, e.className.slice(0, 60), r.top, r.height]; })));
// sticky check
await page.evaluate(() => window.scrollTo(0, 2500)); await page.waitForTimeout(300);
say('wb: strip after scroll 2500', JSON.stringify(await page.$eval('.sticky', (e) => { const r = e.getBoundingClientRect(); return [r.top, r.height]; })));
await shot('wb_sticky_scrolled_2500', false);
await page.evaluate(() => window.scrollTo(0, 0)); await page.waitForTimeout(200);

// scenario timings
const stripHash = () => hashOf('.sticky figure [role=img]');
let h0 = await stripHash(); say('wb: strip hashes default', JSON.stringify(h0));
for (const name of ['Naive', 'Satellite Trail Challenge', 'Cloud Challenge', 'Tracking Error Challenge', 'Default']) {
  const btn = page.locator('section button', { hasText: name }).first();
  await btn.hover(); await page.waitForTimeout(100);
  say('wb: hover', name, '->', (await page.$eval('section p.w-\\[1200px\\]', (e) => e.innerText.split('\n')[0])));
  t0 = Date.now(); await btn.click(); ms = await settled(60000); const dt = Date.now() - t0;
  await page.waitForTimeout(100);
  const h1 = await stripHash();
  say('wb: scenario', name, 'settled in', dt, 'ms; strip changed?', JSON.stringify(h1) !== JSON.stringify(h0), 'frames=', await page.$$eval('input[aria-label^="Include frame"]', (i) => i.filter((x) => x.checked).length), 'method=', await page.$eval('[role=radiogroup][aria-label="Combination method"] [aria-checked=true], [role=radiogroup][aria-label="Combination method"] [aria-pressed=true]', (e) => e.textContent).catch(() => '?'), 'desc=', (await page.$eval('section p.w-\\[1200px\\]', (e) => e.innerText.split('\n')[0])));
  h0 = h1;
  await page.mouse.move(5, 5); await page.waitForTimeout(100);
  say('wb: after mouse leave desc =', (await page.$eval('section p.w-\\[1200px\\]', (e) => e.innerText.split('\n')[0])));
  if (name === 'Satellite Trail Challenge') await shot('wb_scenario_satellite');
}
// warm repeat timings
for (const name of ['Naive', 'Default']) { const btn = page.locator('section button', { hasText: name }).first(); t0 = Date.now(); await btn.click(); await settled(); say('wb: scenario', name, '(warm) settled in', Date.now() - t0, 'ms'); }
// uncheck a frame -> tiles change
h0 = await stripHash();
t0 = Date.now(); await page.locator('input[aria-label^="Include frame 0003"]').click(); await settled(60000); say('wb: uncheck 0003 settled in', Date.now() - t0, 'ms');
await page.waitForTimeout(100); let h1 = await stripHash(); say('wb: strip changed after uncheck?', JSON.stringify(h1) !== JSON.stringify(h0), 'desc=', (await page.$eval('section p.w-\\[1200px\\]', (e) => e.innerText.split('\n')[0])), 'report=', await page.$eval('.bg-surface-panel', (e) => e.innerText.replace(/\n/g, ' | ').slice(0, 200)));
t0 = Date.now(); await page.locator('input[aria-label^="Include frame 0003"]').click(); await settled(60000); say('wb: recheck 0003 (warm) settled in', Date.now() - t0, 'ms');
// flat change -> mote tile
h0 = await stripHash();
t0 = Date.now(); await page.locator('input[aria-label="Flat 85 %"]').click(); await settled(60000); say('wb: flat 85 settled in', Date.now() - t0, 'ms');
await page.waitForTimeout(100); h1 = await stripHash();
say('wb: strip after flat 85', JSON.stringify(h1), 'mote changed?', h1[3] !== h0[3], 'trail changed?', h1[0] !== h0[0]);
say('wb: flat checks', JSON.stringify(await page.$$eval('input[aria-label^="Flat"], input[aria-label="No flat"]', (i) => i.map((x) => x.getAttribute('aria-label') + ':' + x.checked))));
await shot('wb_flat85');
t0 = Date.now(); await page.locator('input[aria-label="No flat"]').click(); await settled(60000); say('wb: no flat settled in', Date.now() - t0, 'ms');
h0 = h1; h1 = await stripHash(); say('wb: mote changed (no flat)?', h1[3] !== h0[3]);
say('wb: unchecking the checked No flat does what?', await (async () => { await page.locator('input[aria-label="No flat"]').click(); await page.waitForTimeout(100); return JSON.stringify(await page.$$eval('input[aria-label^="Flat"], input[aria-label="No flat"]', (i) => i.map((x) => x.getAttribute('aria-label') + ':' + x.checked))); })());
await page.locator('input[aria-label="Flat 50 %"]').click(); await settled(60000);
// bias/dark interplay text
await page.locator('input[aria-label="Dark"]').click(); await page.waitForTimeout(100);
say('wb: cal rows with dark off', JSON.stringify(await page.$$eval('section:nth-of-type(2) .flex.w-\\[1200px\\].items-start', (r) => r.map((x) => x.innerText.replace(/\n/g, ' | ')))));
await settled(60000);
await page.locator('input[aria-label="Dark"]').click(); await settled(60000);
await page.locator('input[aria-label="Dark flat"]').click(); await page.waitForTimeout(100);
say('wb: bias note with darkflat off', await page.$eval('section:nth-of-type(2) .flex.w-\\[1200px\\].items-start', (x) => x.innerText.replace(/\n/g, ' | ')));
await settled(60000); await page.locator('input[aria-label="Dark flat"]').click(); await settled(60000);
// method change
t0 = Date.now(); await page.locator('[role=radiogroup][aria-label="Combination method"] button', { hasText: 'Kappa-sigma' }).click(); await settled(60000); say('wb: kappa-sigma settled in', Date.now() - t0, 'ms');
say('wb: report after kappa', await page.$eval('.bg-surface-panel', (e) => e.innerText.replace(/\n/g, ' | ').slice(0, 300)));
await page.locator('button', { hasText: /^Default$/ }).click(); await settled(60000);

// ---------- Download PNG ----------
say('wb: download button', JSON.stringify(await page.$eval('button:has-text("Download PNG")', (b) => [b.disabled, getComputedStyle(b).backgroundColor])));
const dl = page.locator('button', { hasText: 'Download PNG' });
await dl.scrollIntoViewIfNeeded();
t0 = Date.now(); await dl.click();
await page.waitForSelector('[role=progressbar]', { timeout: 10000 });
await page.waitForTimeout(1500);
say('wb: progress after 1.5 s', await page.$eval('[role=progressbar]', (e) => e.innerText.replace(/\n/g, ' | ') + ' now=' + e.getAttribute('aria-valuenow')), 'button disabled?', await dl.evaluate((b) => b.disabled));
say('wb: strip during job', JSON.stringify(await page.$$eval('.sticky figure', (f) => f.map((x) => x.innerText.replace(/\n/g, '/')))));
await shot('wb_b_stacking_report', false);
await page.evaluate(() => window.scrollTo(0, 0)); await page.waitForTimeout(100);
await shot('wb_b_stacking_strip', false);
say('wb: focused element before cancel', await page.evaluate(() => document.activeElement?.textContent));
await page.locator('[role=progressbar] button', { hasText: 'Cancel' }).click();
await page.waitForTimeout(500);
say('wb: after cancel: progressbar present?', !!(await page.$('[role=progressbar]')), 'button disabled?', await dl.evaluate((b) => b.disabled), 'strip', JSON.stringify(await page.$$eval('.sticky figure', (f) => f.map((x) => x.innerText.replace(/\n/g, '/')))));
// full download
t0 = Date.now();
const [download] = await Promise.all([page.waitForEvent('download', { timeout: 600000 }), dl.click()]);
const dt = Date.now() - t0;
const path = `${OUT}/${download.suggestedFilename()}`; await download.saveAs(path);
say('wb: download finished in', dt, 'ms ->', download.suggestedFilename(), fs.statSync(path).size, 'bytes');
await page.waitForTimeout(300);
say('wb: after download: progressbar present?', !!(await page.$('[role=progressbar]')), 'button disabled?', await dl.evaluate((b) => b.disabled));

// ---------- store carry-back to review ----------
await page.locator('button', { hasText: 'Cloud Challenge' }).first().click(); await settled(60000);
await page.getByText('← Light frames').last().click(); await page.waitForURL(/light-frames/); say('wb: back link goes to', page.url());
await page.goto(base + '/#/light-frames/review'); await settled(60000); await page.waitForTimeout(200);
say('review after cloud scenario: caption', await page.$eval('section p.text-text-on-stage-muted', (e) => e.textContent), 'chips', JSON.stringify(await page.$$eval('[role=radiogroup][aria-label="Stack algorithm"] button', (b) => b.map((x) => x.textContent + ':' + (x.getAttribute('aria-checked') ?? x.getAttribute('aria-pressed'))))), 'checked=', await page.$$eval('input[aria-label^="Include frame"]', (i) => i.filter((x) => x.checked).map((x) => x.getAttribute('aria-label').slice(14, 40))));
await shot('review_d_after_cloud_scenario');
// keyboard: tab order check for chips
await page.goto(base + '/#/workbench'); await settled(60000);
say('wb: tab stops (first 30)', JSON.stringify(await page.evaluate(async () => { const out = []; for (let i = 0; i < 30; i++) { const a = document.activeElement; out.push((a?.tagName ?? '?') + ':' + (a?.getAttribute('aria-label') ?? a?.textContent ?? '').trim().slice(0, 25)); const ev = new KeyboardEvent('keydown', { key: 'Tab' }); } return out.slice(0, 1); })));
fs.writeFileSync(`${OUT}/log.txt`, log.join('\n'));
await browser.close();
