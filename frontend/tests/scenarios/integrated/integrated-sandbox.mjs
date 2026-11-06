// Exercise integrated interactions in the opaque offline viewer iframe.
import fs from 'node:fs';
import { chromium, firefox, webkit } from 'playwright';
import { assert, login, nav } from '../../support/helpers.mjs';
const html = fs.readFileSync('dist/index.html', 'utf8');
const drawer = root => root.locator('.detail-layer-active .drawer');
for (const [name, engine] of [
  ['Chromium', chromium],
  ['Firefox', firefox],
  ['WebKit', webkit],
]) {
  const browser = await engine.launch({
    headless: true,
    ...(name === 'Chromium' ? { args: ['--no-sandbox'] } : {}),
  });
  const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      reducedMotion: 'reduce',
    }),
    page = await context.newPage();
  const errors = [],
    network = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await context.route(/^https?:\/\//, route => {
    network.push(route.request().url());
    return route.abort();
  });
  try {
    await page.setContent(
      '<iframe title="isolated" sandbox="allow-scripts" style="width:100%;height:820px;border:0"></iframe>',
    );
    await page.locator('iframe').evaluate((el, src) => {
      el.srcdoc = src;
    }, html);
    const root = page.frameLocator('iframe');
    await login(root);
    await root.getByLabel('الفترة العامة للعينة').selectOption('1h');
    await nav(root, 'مستكشف الأحداث');
    await root.locator('.hunt-workspace>summary').click();
    await root.getByLabel('قيمة الشرط ٢').fill('svc-auth');
    assert.equal(await root.locator('.hunt-results button').count(), 1);
    await root.locator('.hunt-share>summary').click();
    await root.getByRole('button', { name: 'نسخ النص' }).click();
    assert.match(await root.locator('.hunt-share [role=status]').innerText(), /انسخه يدويًا|نُسخ/);
    await root.locator('.hunt-results button').first().click();
    await drawer(root).getByRole('button', { name: 'استكشاف عنوان IP 198.51.100.23' }).click();
    assert.match(await drawer(root).innerText(), /EVT-90481/);
    await drawer(root).getByRole('button', { name: 'إغلاق' }).click();
    await nav(root, 'الحوادث');
    await root.locator('.data-panel tbody tr').filter({ hasText: 'INC-2026-084' }).click();
    await drawer(root).getByRole('button', { name: 'مراجع الأدلة', exact: true }).click();
    await drawer(root).getByLabel('عنوان المرجع التجريبي').fill('مرجع مؤقت');
    await drawer(root).getByRole('button', { name: 'إضافة مرجع' }).click();
    assert.match(await drawer(root).innerText(), /مرجع مؤقت/);
    await drawer(root).getByRole('button', { name: 'قوالب الاستجابة', exact: true }).click();
    await drawer(root)
      .getByRole('checkbox', { name: /راجع التنبيه والأصل/ })
      .check();
    await drawer(root).getByRole('button', { name: 'الخط الزمني', exact: true }).click();
    assert.match(await drawer(root).innerText(), /EVT-90481/);
    await drawer(root).getByRole('button', { name: 'إغلاق' }).click();
    await nav(root, 'المستخدمون والأدوار');
    await root.getByRole('button', { name: 'الأدوار والصلاحيات' }).click();
    await root.locator('.role-compare>summary').click();
    await root.getByLabel('الدور الأول للمقارنة').selectOption({ label: 'مدير النظام' });
    assert.match(await root.locator('.role-compare-grid').innerText(), /مدير النظام/);
    await nav(root, 'التقارير');
    await root.locator('.report-designer>summary').click();
    await root.getByRole('button', { name: 'تصدير بيانات المعاينة CSV' }).click();
    let dialog = root.getByRole('dialog', { name: 'معاينة تصدير CSV' });
    assert.match(await dialog.innerText(), /قد يمنع عارض الملفات المعزول التنزيل/);
    await dialog.getByRole('button', { name: 'إغلاق' }).click();
    await root.getByRole('button', { name: 'المساعد التجريبي' }).click();
    dialog = root.getByRole('dialog', { name: 'المساعد التجريبي' });
    assert.match(await dialog.innerText(), /لا يوجد نموذج ذكاء اصطناعي/);
    await dialog.getByRole('button', { name: 'إغلاق' }).click();
    await nav(root, 'تحليل الشبكة');
    await root.locator('.network-extra:nth-child(1)>summary').click();
    assert.match(await root.locator('.comparison-cards').innerText(), /الفترة السابقة/);
    const dims = await root
      .locator('html')
      .evaluate(el => ({ scroll: el.scrollWidth, client: el.clientWidth }));
    assert.ok(dims.scroll <= dims.client + 1, `${name} sandbox overflow ${JSON.stringify(dims)}`);
    assert.deepEqual(errors, [], `${name} errors`);
    assert.deepEqual(network, [], `${name} external requests`);
    console.log(
      `PASS ${name} opaque offline iframe · integrated tools, clipboard fallback and CSV disclosure`,
    );
  } finally {
    await context.close();
    await browser.close();
  }
}
