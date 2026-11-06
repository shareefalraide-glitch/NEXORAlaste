// A guided example must not overwrite a user's real case view, and work done
// after pausing it must be recoverable in the same in-memory session.
import { assert, launch, newPage, login, nav, clean } from '../support/helpers.mjs';
const browser = await launch(),
  run = await newPage(browser, {}),
  { page } = run;
const d = () => page.locator('.detail-layer-active .drawer');
try {
  await login(page);
  await nav(page, 'الحوادث');
  await page.locator('table tbody tr').filter({ hasText: 'INC-2026-084' }).click();
  await d().getByRole('button', { name: 'المهام والملاحظات' }).click();
  await d().getByLabel('ملاحظة جديدة للحادثة').fill('مسودة قبل استكشاف الدليل');
  await d().getByRole('button', { name: 'إغلاق', exact: true }).click();
  await nav(page, 'نظرة عامة');
  await page.getByRole('button', { name: 'ابدأ الجولة' }).click();
  let tour = page.locator('.tour-dialog');
  await tour.getByRole('button', { name: 'فهرس المحاور' }).click();
  await tour
    .getByRole('navigation', { name: 'فهرس محاور الجولة' })
    .getByRole('button', { name: /التحقيق والاستجابة/ })
    .click();
  for (
    let n = 0;
    n < 15 &&
    (await page.locator('.tour-layer').getAttribute('data-guide-step')) !== 'analyst-notebook';
    n++
  )
    await tour.getByRole('button', { name: 'التالي', exact: true }).click();
  assert.equal(
    await page.locator('.tour-layer').getAttribute('data-guide-step'),
    'analyst-notebook',
  );
  await tour.getByRole('button', { name: 'استكشف القسم' }).click();
  assert.equal(await page.locator('.tour-layer').count(), 0);
  await d().getByRole('button', { name: 'المهام والملاحظات' }).click();
  assert.equal(
    await d().getByLabel('ملاحظة جديدة للحادثة').inputValue(),
    'مسودة قبل استكشاف الدليل',
  );
  await d().getByLabel('ملاحظة جديدة للحادثة').fill('مسودة حُررت بعد إيقاف الدليل');
  await d().getByRole('button', { name: 'إغلاق', exact: true }).click();
  await nav(page, 'الحوادث');
  const shelf = page.getByRole('region', { name: 'استعادة تحقيقات الجلسة' });
  await shelf.getByRole('button', { name: 'استعادة تحقيق INC-2026-084' }).click();
  assert.equal(
    await d().getByRole('button', { name: 'المهام والملاحظات' }).getAttribute('aria-pressed'),
    'true',
    'guide example did not overwrite case section',
  );
  assert.equal(
    await d().getByLabel('ملاحظة جديدة للحادثة').inputValue(),
    'مسودة حُررت بعد إيقاف الدليل',
    'paused guide draft survives',
  );
  await d().getByRole('button', { name: 'إغلاق', exact: true }).click();
  await nav(page, 'خريطة العلاقات');
  await page.getByRole('button', { name: 'مستكشف التحقيق', exact: true }).click();
  let graph = page.getByRole('region', { name: 'مستكشف التحقيق التفاعلي' });
  await graph.getByLabel('البحث في عقد التحقيق').fill('EVT-90481');
  await nav(page, 'نظرة عامة');
  await page.locator('.sidebar-guide').click();
  await page
    .getByRole('dialog', { name: 'بدء الجولة التعليمية' })
    .getByRole('button', { name: 'متابعة الجولة' })
    .click();
  tour = page.locator('.tour-dialog');
  await tour.getByRole('button', { name: 'فهرس المحاور' }).click();
  await tour
    .getByRole('navigation', { name: 'فهرس محاور الجولة' })
    .getByRole('button', { name: /الأصول والارتباطات/ })
    .click();
  for (
    let n = 0;
    n < 15 &&
    (await page.locator('.tour-layer').getAttribute('data-guide-step')) !== 'relationships';
    n++
  )
    await tour.getByRole('button', { name: 'التالي', exact: true }).click();
  await page.waitForSelector(
    '.tour-layer[data-guide-step="relationships"][data-target-found="true"]',
  );
  await tour.getByRole('button', { name: 'استكشف القسم' }).click();
  graph = page.getByRole('region', { name: 'مستكشف التحقيق التفاعلي' });
  assert.equal(
    await graph.getByLabel('البحث في عقد التحقيق').inputValue(),
    'EVT-90481',
    'tour restores global graph view and search',
  );
  clean(run);
  console.log('PASS tutorial view isolation, recoverable paused drafts and saved graph context');
} finally {
  await run.context.close();
  await browser.close();
}
