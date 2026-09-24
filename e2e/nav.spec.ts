// Wizard navigation: every registered route renders, Next/Previous walk the registry in order,
// and the browser Back button returns to the previous page (hash routes, SPEC §4.6).
// Run: E2E_BASE=http://localhost:5180 npx playwright test e2e/nav.spec.ts
import { test, expect, type Page } from '@playwright/test';

const bottomNext = (page: Page) => page.getByRole('navigation', { name: 'Pages' }).getByRole('button', { name: /→$/ });
const bottomPrev = (page: Page) => page.getByRole('navigation', { name: 'Pages' }).getByRole('button', { name: /^←/ });
const hash = (page: Page) => new URL(page.url()).hash;
// The whole LessonPage remounts on navigation, so a button detaches the instant it is clicked and
// Playwright's locator retries would then re-resolve and click the *next* page's button. Click
// inside the page instead, with no element handle to invalidate.
const press = (page: Page, dir: 'next' | 'prev') => page.evaluate((d) => {
  const buttons = [...document.querySelectorAll<HTMLButtonElement>('nav[aria-label="Pages"] button')];
  const b = buttons.find((x) => d === 'next' ? /→$/.test(x.textContent ?? '') : /^←/.test(x.textContent ?? ''));
  if (!b) throw new Error(`no ${d} button`);
  b.click();
}, dir);

// The hash changes synchronously inside the click handler, before React commits the new page, so
// wait until the TopBar marks the new route as current before reading or pressing anything else.
const settled = async (page: Page) => {
  await page.locator(`nav[aria-label="Chapters"] a[aria-current="page"][href="${hash(page)}"]`).first().waitFor();
};

async function walkForward(page: Page): Promise<string[]> {
  await page.goto('/');
  await expect(page).toHaveURL(/#\//);
  await page.getByRole('navigation', { name: 'Pages' }).waitFor();
  const visited = [hash(page)];
  for (let i = 0; i < 20; i++) {
    await page.getByRole('navigation', { name: 'Pages' }).waitFor();
    const next = bottomNext(page);
    if ((await next.count()) === 0) break;
    await press(page, 'next');
    await expect.poll(() => hash(page)).not.toBe(visited[visited.length - 1]);
    await settled(page);
    visited.push(hash(page));
  }
  return visited;
}

test('root redirects to the first section and the TopBar lists every chapter', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/#\/[a-z]/);
  const chapters = page.getByRole('navigation', { name: 'Chapters' }).getByRole('link');
  expect(await chapters.count()).toBeGreaterThan(1);
});

test('every route reachable from the TopBar renders a main region', async ({ page }) => {
  await page.goto('/');
  const links = page.getByRole('navigation', { name: 'Chapters' }).getByRole('link');
  const hrefs = new Set<string>();
  for (const l of await links.all()) {
    const h = await l.getAttribute('href');
    if (h?.startsWith('#/')) hrefs.add(h);
  }
  // Page tabs of every chapter: visit each chapter, collect its page links too.
  for (const h of [...hrefs]) {
    await page.goto('/' + h);
    for (const l of await links.all()) {
      const ph = await l.getAttribute('href');
      if (ph?.startsWith('#/')) hrefs.add(ph);
    }
  }
  for (const h of hrefs) {
    await page.goto('/' + h);
    await expect(page, h).toHaveURL(new RegExp(h.replace(/[/#]/g, '\\$&') + '$'));
    await expect(page.locator('main'), h).toBeVisible();
    expect((await page.locator('main').innerHTML()).length, `${h} renders content`).toBeGreaterThan(0);
  }
});

test('Next walks the wizard forward and Previous walks it back', async ({ page }) => {
  const forward = await walkForward(page);
  expect(forward.length).toBeGreaterThan(1);
  expect(new Set(forward).size).toBe(forward.length);
  // First page shows no Previous; last page shows no Next.
  await page.goto('/' + forward[0]);
  await expect(bottomPrev(page)).toHaveCount(0);
  await page.goto('/' + forward[forward.length - 1]);
  await expect(bottomNext(page)).toHaveCount(0);
  // Previous retraces the same list in reverse.
  for (let i = forward.length - 1; i > 0; i--) {
    await press(page, 'prev');
    await expect.poll(() => hash(page)).toBe(forward[i - 1]);
    await settled(page);
  }
});

test('navigating with Next lands at the top of the page', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('navigation', { name: 'Pages' }).waitFor();
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
  const before = hash(page);
  await press(page, 'next');
  await expect.poll(() => hash(page)).not.toBe(before);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
});

test('the first page labels Next as "Start: …"', async ({ page }) => {
  await page.goto('/');
  await expect(bottomNext(page)).toHaveText(/^Start: .+ →$/);
});

test('browser Back returns to the previous page', async ({ page }) => {
  const forward = await walkForward(page);
  test.skip(forward.length < 3, 'needs at least three registered sections');
  await page.goBack();
  await expect.poll(() => hash(page)).toBe(forward[forward.length - 2]);
  await page.goBack();
  await expect.poll(() => hash(page)).toBe(forward[forward.length - 3]);
  await page.goForward();
  await expect.poll(() => hash(page)).toBe(forward[forward.length - 2]);
});
