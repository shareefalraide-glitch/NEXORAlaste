import fs from 'node:fs';
import { chromium, firefox, webkit } from 'playwright';
import { assert, newPage, login, nav, clean } from '../support/helpers.mjs';
const drawer = root => root.locator('.detail-layer-active .drawer');
const bar = root => drawer(root).getByRole('region', { name: 'تحقيقات الجلسة المفتوحة' });
for (const [name, engine] of [
  ['Chromium', chromium],
  ['Firefox', firefox],
  ['WebKit', webkit],
]) {
  const browser = await engine.launch({
      headless: true,
      ...(name === 'Chromium' ? { args: ['--no-sandbox'] } : {}),
    }),
    context = await browser.newContext({ viewport: { width: 390, height: 844 } }),
    page = await context.newPage(),
    errors = [],
    requests = [];
  try {
    page.on('pageerror', event => errors.push(event.message));
    await context.route(/^https?:\/\//, route => {
      requests.push(route.request().url());
      return route.abort();
    });
    await page.setContent(
      '<iframe title="isolated" sandbox="allow-scripts" style="width:100%;height:820px;border:0"></iframe>',
    );
    await page.locator('iframe').evaluate(
      (element, html) => {
        element.srcdoc = html;
      },
      fs.readFileSync('dist/index.html', 'utf8'),
    );
    const root = page.frameLocator('iframe');
    await login(root);
    await nav(root, 'الحوادث');
    await root.locator('table tbody tr').filter({ hasText: 'INC-2026-084' }).click();
    await bar(root).locator('.investigation-tab-add summary').click();
    await bar(root).getByLabel('اختيار حادثة لفتح تحقيق آخر').selectOption('INC-2026-083');
    await bar(root).getByRole('button', { name: 'فتح التحقيق' }).click();
    await bar(root).getByRole('button', { name: 'عرض تحقيقين' }).click();
    const split = root.getByRole('dialog', { name: 'عرض تحقيقين' }),
      pane = split.getByRole('region', { name: 'لوحة تحقيق INC-2026-083' });
    await pane.getByRole('button', { name: 'المهام والملاحظات' }).click();
    const book = pane.getByRole('region', { name: 'قائمة مهام وملاحظات الحادثة' });
    await book.getByLabel('ملاحظة جديدة للحادثة').fill('ملاحظة معاينة معزولة');
    await book.getByRole('button', { name: 'إضافة ملاحظة' }).click();
    await book.locator('.notebook-export > summary').click();
    assert.match(
      await book.getByRole('article', { name: 'معاينة دفتر التحقيق' }).innerText(),
      /ملاحظة معاينة معزولة/,
    );
    await book.getByRole('button', { name: 'تنزيل دفتر HTML' }).click();
    assert.match(await book.locator('.notebook-export-notice').innerText(), /العارض|عارض الملفات/);
    await book.getByRole('button', { name: 'طباعة / حفظ PDF' }).click();
    assert.match(await book.locator('.notebook-export-notice').innerText(), /الطباعة/);
    await book.getByRole('button', { name: 'تحديد النص للنسخ' }).click();
    assert.match(
      await book.getByLabel('النص القابل للنسخ من الدفتر').inputValue(),
      /ملاحظة معاينة معزولة/,
    );
    await split
      .getByRole('group', { name: 'التبديل بين لوحتي التحقيق' })
      .getByRole('button', { name: /INC-2026-084/ })
      .click();
    assert.equal(
      await split.getByRole('region', { name: 'لوحة تحقيق INC-2026-084' }).isVisible(),
      true,
    );
    await split.getByRole('button', { name: 'إغلاق', exact: true }).click();
    await drawer(root).getByRole('button', { name: 'إغلاق', exact: true }).click();
    await nav(root, 'التنبيهات');
    await root.getByLabel('تحديد ALT-1284').check();
    await root.getByRole('button', { name: 'فرز مستقل للمحدد' }).click();
    const batch = root.getByRole('dialog', { name: 'مراجعة مستقلة للتنبيهات' });
    await batch.getByLabel('قرار التنبيه ALT-1284').selectOption('unknown');
    await batch.getByLabel('أولوية التنبيه ALT-1284').selectOption('p2');
    await batch.getByLabel('سبب التنبيه ALT-1284').fill('سبب في المعاينة');
    await batch.getByRole('button', { name: 'معاينة القرارات المستقلة' }).click();
    assert.match(
      await batch.getByRole('region', { name: 'معاينة القرارات المستقلة' }).innerText(),
      /سبب في المعاينة/,
    );
    await batch.getByRole('button', { name: 'تأكيد تسجيل القرارات' }).click();
    await nav(root, 'تحليل الشبكة');
    const heat = root.getByRole('region', { name: 'خريطة محاولات الشبكة الحرارية' });
    await heat.getByLabel('أصل الخريطة الحرارية').selectOption('AST-001');
    await heat.locator('.heatmap-mobile-cells button').last().click();
    assert.match(
      await heat.getByRole('region', { name: 'سياق الأصل والفاصل' }).innerText(),
      /EVT-90481/,
    );
    assert.deepEqual(errors, []);
    assert.deepEqual(requests, []);
    console.log(
      `PASS 1.6 ${name} · isolated iframe, no network, split, triage, network, preview and explicit download/print fallback`,
    );
  } finally {
    await context.close();
    await browser.close();
  }
}
// No analyst drafts, summaries or decisions may survive logout or refresh.
{
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] }),
    run = await newPage(browser, {}),
    { page } = run;
  try {
    await login(page);
    await nav(page, 'الحوادث');
    await page.locator('table tbody tr').filter({ hasText: 'INC-2026-084' }).click();
    await drawer(page).getByRole('button', { name: 'المهام والملاحظات' }).click();
    await drawer(page).getByLabel('ملخص المحلل للحادثة').fill('ملخص خاص بالجلسة فقط');
    await drawer(page).getByLabel('ملاحظة جديدة للحادثة').fill('مسودة خاصة بالجلسة فقط');
    const stored = await page.evaluate(() => Object.values(localStorage).join('|'));
    assert.ok(!stored.includes('ملخص خاص بالجلسة فقط'));
    assert.ok(!stored.includes('مسودة خاصة بالجلسة فقط'));
    await drawer(page).getByRole('button', { name: 'إغلاق', exact: true }).click();
    await page.getByRole('button', { name: 'قائمة الحساب' }).click();
    await page.getByRole('button', { name: 'تسجيل الخروج التجريبي' }).click();
    await login(page);
    await nav(page, 'الحوادث');
    assert.equal(await page.getByRole('region', { name: 'استعادة تحقيقات الجلسة' }).count(), 0);
    await page.locator('table tbody tr').filter({ hasText: 'INC-2026-084' }).click();
    await drawer(page).getByRole('button', { name: 'المهام والملاحظات' }).click();
    assert.equal(await drawer(page).getByLabel('ملخص المحلل للحادثة').inputValue(), '');
    assert.equal(await drawer(page).getByLabel('ملاحظة جديدة للحادثة').inputValue(), '');
    await drawer(page).getByLabel('ملخص المحلل للحادثة').fill('ملخص يمحوه التحديث');
    await page.reload();
    await login(page);
    await nav(page, 'الحوادث');
    await page.locator('table tbody tr').filter({ hasText: 'INC-2026-084' }).click();
    await drawer(page).getByRole('button', { name: 'المهام والملاحظات' }).click();
    assert.equal(await drawer(page).getByLabel('ملخص المحلل للحادثة').inputValue(), '');
    await drawer(page).getByRole('button', { name: 'إغلاق', exact: true }).click();
    await nav(page, 'الإعدادات');
    await page.getByRole('switch', { name: 'محاكاة انقطاع الاتصال' }).click();
    await nav(page, 'الحوادث');
    await page.locator('table tbody tr').filter({ hasText: 'INC-2026-084' }).click();
    await drawer(page).getByRole('button', { name: 'المهام والملاحظات' }).click();
    assert.equal(await drawer(page).getByLabel('ملخص المحلل للحادثة').isDisabled(), true);
    await drawer(page).getByRole('button', { name: 'إغلاق', exact: true }).click();
    await nav(page, 'التنبيهات');
    await page.getByLabel('تحديد ALT-1284').check();
    assert.equal(await page.getByRole('button', { name: 'فرز مستقل للمحدد' }).isDisabled(), true);
    clean(run);
    console.log(
      'PASS 1.6 logout/reload privacy, no sensitive localStorage, and read-only offline simulation',
    );
  } finally {
    await run.context.close();
    await browser.close();
  }
}
