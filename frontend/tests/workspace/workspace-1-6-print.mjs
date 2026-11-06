import fs from 'node:fs';
import { assert, launch, newPage, login, nav, clean } from '../support/helpers.mjs';
const browser = await launch(),
  run = await newPage(browser, {}),
  { page } = run;
try {
  await login(page);
  await nav(page, 'الحوادث');
  await page.locator('table tbody tr').filter({ hasText: 'INC-2026-084' }).click();
  const drawer = page.locator('.detail-layer-active .drawer');
  await drawer.getByRole('button', { name: 'المهام والملاحظات' }).click();
  const book = drawer.getByRole('region', { name: 'قائمة مهام وملاحظات الحادثة' });
  await book.getByLabel('ملخص المحلل للحادثة').fill('ملخص تجريبي للطباعة');
  await book.getByLabel('ملاحظة جديدة للحادثة').fill('ملاحظة تجريبية للطباعة');
  await book.getByRole('button', { name: 'إضافة ملاحظة' }).click();
  await book.locator('.notebook-export > summary').click();
  await page.evaluate(() => {
    window.print = () => {};
  });
  await book.getByRole('button', { name: 'طباعة / حفظ PDF' }).click();
  await page.emulateMedia({ media: 'print' });
  assert.equal(await page.locator('.notebook-print-root').isVisible(), true);
  assert.equal(await page.locator('#root').isVisible(), false);
  assert.equal(
    await page.evaluate(() => getComputedStyle(document.documentElement).colorScheme),
    'light',
    'print must use a light paper color scheme',
  );
  assert.match(await page.locator('.notebook-print-root').innerText(), /ملاحظة تجريبية للطباعة/);
  assert.equal(await page.locator('.notebook-print-root img').count(), 0);
  if (process.env.NEXORA_CAPTURE_DIR) {
    fs.mkdirSync(process.env.NEXORA_CAPTURE_DIR, { recursive: true });
    await page.screenshot({
      path: `${process.env.NEXORA_CAPTURE_DIR}/notebook-print.png`,
      fullPage: true,
    });
  }
  const pdf = await page.pdf({ format: 'A4', printBackground: true });
  assert.equal(pdf.subarray(0, 5).toString(), '%PDF-');
  assert.ok(pdf.length > 10000);
  if (process.env.NEXORA_CAPTURE_DIR)
    fs.writeFileSync(`${process.env.NEXORA_CAPTURE_DIR}/notebook-print.pdf`, pdf);
  await page.emulateMedia({ media: 'screen' });
  await drawer.getByRole('button', { name: 'إغلاق', exact: true }).click();
  await nav(page, 'التقارير');
  await page
    .locator('.report-card')
    .filter({ hasText: 'تقرير التنبيهات والكشف' })
    .getByRole('button', { name: 'معاينة التقرير' })
    .click();
  await page.emulateMedia({ media: 'print' });
  assert.equal(
    await page.locator('.report-preview').isVisible(),
    true,
    'existing report remains printable',
  );
  assert.equal(await page.locator('.main-shell').isVisible(), false);
  const reportPdf = await page.pdf({ format: 'A4', printBackground: true });
  assert.equal(reportPdf.subarray(0, 5).toString(), '%PDF-');
  assert.ok(reportPdf.length > 10000);
  if (process.env.NEXORA_CAPTURE_DIR)
    fs.writeFileSync(`${process.env.NEXORA_CAPTURE_DIR}/existing-report-print.pdf`, reportPdf);
  await page.emulateMedia({ media: 'screen' });
  clean(run);
  console.log(
    'PASS Chromium PDF generation: selected notebook without images, light paper, and the existing report',
  );
} finally {
  await run.context.close();
  await browser.close();
}
