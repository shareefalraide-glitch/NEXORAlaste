import { chromium, firefox, webkit } from 'playwright';
import { assert, newPage, login, nav, clean } from '../support/helpers.mjs';
for (const [name, engine] of [
  ['Chromium', chromium],
  ['Firefox', firefox],
  ['WebKit', webkit],
]) {
  const browser = await engine.launch({
      headless: true,
      ...(name === 'Chromium' ? { args: ['--no-sandbox'] } : {}),
    }),
    run = await newPage(browser, { width: 1440, height: 900 }),
    { page } = run;
  try {
    await login(page);
    await nav(page, 'الحوادث');
    await page.locator('table tbody tr').filter({ hasText: 'INC-2026-084' }).click();
    const drawer = () => page.locator('.detail-layer-active .drawer'),
      bar = () => drawer().getByRole('region', { name: 'تحقيقات الجلسة المفتوحة' });
    await bar().locator('.investigation-tab-add summary').click();
    await bar().getByLabel('اختيار حادثة لفتح تحقيق آخر').selectOption('INC-2026-083');
    await bar().getByRole('button', { name: 'فتح التحقيق' }).click();
    await bar().getByRole('button', { name: 'عرض تحقيقين' }).click();
    const split = page.getByRole('dialog', { name: 'عرض تحقيقين' }),
      first = split.getByRole('region', { name: 'لوحة تحقيق INC-2026-083' }),
      second = split.getByRole('region', { name: 'لوحة تحقيق INC-2026-084' });
    await first.getByRole('button', { name: 'مستكشف التحقيق', exact: true }).click();
    let graph = first.getByRole('region', { name: 'مستكشف التحقيق التفاعلي' });
    await graph.getByLabel('البحث في عقد التحقيق').fill('ALT-1284');
    await graph.getByRole('button', { name: /تحديد نتيجة تنبيه .*ALT-1284/ }).click();
    await graph.getByRole('button', { name: 'فتح السياق', exact: true }).click();
    let triageA = first.locator('.split-layer:not([hidden]) .triage-assistant');
    await triageA.locator('summary').click();
    await triageA.getByLabel('سبب قرار مراجعة التنبيه').fill('مسودة التنبيه في التحقيق الأول');
    await second.getByRole('button', { name: 'التنبيهات', exact: true }).click();
    await second.locator('.related-row').filter({ hasText: 'ALT-1284' }).click();
    let triageB = second.locator('.split-layer:not([hidden]) .triage-assistant');
    await triageB.locator('summary').click();
    assert.equal(await triageB.getByLabel('سبب قرار مراجعة التنبيه').inputValue(), '');
    await triageB.getByLabel('سبب قرار مراجعة التنبيه').fill('مسودة التنبيه في التحقيق الثاني');
    assert.equal(
      await triageA.getByLabel('سبب قرار مراجعة التنبيه').inputValue(),
      'مسودة التنبيه في التحقيق الأول',
    );
    await first.getByRole('button', { name: 'العودة للسجل السابق' }).click();
    graph = first.getByRole('region', { name: 'مستكشف التحقيق التفاعلي' });
    await graph.getByRole('button', { name: 'فتح السياق', exact: true }).click();
    triageA = first.locator('.split-layer:not([hidden]) .triage-assistant');
    await triageA.locator('summary').click();
    assert.equal(
      await triageA.getByLabel('سبب قرار مراجعة التنبيه').inputValue(),
      'مسودة التنبيه في التحقيق الأول',
    );
    assert.equal(
      await triageB.getByLabel('سبب قرار مراجعة التنبيه').inputValue(),
      'مسودة التنبيه في التحقيق الثاني',
    );
    await first.locator('.split-detail-heading:visible').focus();
    await split.getByRole('button', { name: 'إغلاق', exact: true }).click();
    assert.match(await drawer().getAttribute('aria-label'), /ALT-1284/);
    await drawer().locator('.triage-assistant summary').click();
    assert.equal(
      await drawer().getByLabel('سبب قرار مراجعة التنبيه').inputValue(),
      'مسودة التنبيه في التحقيق الأول',
    );
    await bar().getByRole('button', { name: 'استعادة تحقيق INC-2026-084' }).click();
    await drawer().locator('.triage-assistant summary').click();
    assert.equal(
      await drawer().getByLabel('سبب قرار مراجعة التنبيه').inputValue(),
      'مسودة التنبيه في التحقيق الثاني',
    );
    clean(run);
    console.log(
      `PASS ${name}: identical alert in two investigations has independent triage drafts and retained per-case trails`,
    );
  } finally {
    await run.context.close();
    await browser.close();
  }
}
