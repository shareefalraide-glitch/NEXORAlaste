import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

export { assert };
export const builtUrl = pathToFileURL(path.resolve('dist/index.html')).href;
export const launch = () => chromium.launch({ headless: true, args: ['--no-sandbox'] });
export async function newPage(
  browser,
  { width = 1440, height = 900, theme = 'dark', acceptDownloads = true, url = builtUrl } = {},
) {
  const context = await browser.newContext({
    viewport: { width, height },
    acceptDownloads,
    reducedMotion: 'reduce',
  });
  const page = await context.newPage();
  const errors = [],
    network = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => {
    if (m.type() === 'error') errors.push(m.text());
  });
  // A standalone build must never fetch remote assets or data.
  if (url === builtUrl)
    await context.route(/^https?:\/\//, route => {
      network.push(route.request().url());
      return route.abort();
    });
  await page.goto(url, { waitUntil: 'load' });
  if (theme === 'light' && (await page.locator('html').getAttribute('data-theme')) !== 'light')
    await page.getByRole('button', { name: 'تفعيل المظهر الفاتح' }).click();
  assert.equal(await page.locator('html').getAttribute('data-theme'), theme);
  return { context, page, errors, network };
}
export async function login(root) {
  await root.getByText('استخدام بيانات تجريبية', { exact: true }).click();
  await root.getByText('المتابعة إلى التحقق', { exact: true }).click();
  await root.getByText('ملء الرمز', { exact: true }).click();
  await root.getByText('التحقق والدخول', { exact: true }).click();
  await root.locator('#primary-navigation').waitFor({ state: 'attached' });
}
export async function nav(page, label) {
  const mobile = page.getByRole('button', { name: 'فتح القائمة' });
  if (await mobile.isVisible()) await mobile.click();
  await page.locator('#primary-navigation').getByText(label, { exact: true }).click();
}
export async function noOverflow(page, where) {
  const dims = await page.evaluate(() => ({
    client: document.documentElement.clientWidth,
    scroll: document.documentElement.scrollWidth,
  }));
  assert.ok(
    dims.scroll <= dims.client + 1,
    `${where}: page horizontal overflow ${JSON.stringify(dims)}`,
  );
}
export function clean({ errors, network }) {
  assert.deepEqual(errors, [], `Browser errors: ${errors.join('; ')}`);
  assert.deepEqual(network, [], `External requests: ${network.join('; ')}`);
}
