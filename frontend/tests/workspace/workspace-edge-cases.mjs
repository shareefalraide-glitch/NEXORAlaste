// Capacity and interrupted draft regressions against public UI controls.
import { assert, launch, newPage, login, nav, clean } from '../support/helpers.mjs';
const d = page => page.locator('.detail-layer-active .drawer'),
  book = page => d(page).getByRole('region', { name: 'قائمة مهام وملاحظات الحادثة' }),
  bar = page => d(page).getByRole('region', { name: 'تحقيقات الجلسة المفتوحة' });
const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRqkAAAAASUVORK5CYII=',
  'base64',
);
const browser = await launch(),
  run = await newPage(browser, {}),
  { page } = run;
try {
  await login(page);
  await nav(page, 'الحوادث');
  await page.locator('table tbody tr').filter({ hasText: 'INC-2026-084' }).click();
  await d(page).getByRole('button', { name: 'المهام والملاحظات' }).click();
  // Delay the first FileReader so we can leave before decoding finishes.
  await page.evaluate(() => {
    const original = FileReader.prototype.readAsDataURL;
    let first = true;
    FileReader.prototype.readAsDataURL = function (file) {
      if (first) {
        first = false;
        setTimeout(() => original.call(this, file), 10000);
      } else original.call(this, file);
    };
  });
  await book(page).getByLabel('ملاحظة جديدة للحادثة').fill('ملاحظة مع صورة ومسودة تعديل');
  await book(page).getByLabel('ربط الملاحظة بسجل').selectOption('incident|INC-2026-084');
  await book(page).getByRole('button', { name: 'إضافة رابط آخر' }).click();
  await book(page).getByLabel('ربط الملاحظة بسجل').selectOption('event|EVT-90481');
  await book(page)
    .getByLabel('اختيار صورة توضيحية للملاحظة')
    .setInputFiles({ name: 'pending.png', mimeType: 'image/png', buffer: png });
  await book(page).getByText('جارٍ تجهيز المعاينة محليًا…').waitFor();
  await bar(page).locator('summary').click();
  await bar(page).getByLabel('اختيار حادثة لفتح تحقيق آخر').selectOption('INC-2026-083');
  await bar(page).getByRole('button', { name: 'فتح التحقيق' }).click();
  await bar(page).getByRole('button', { name: 'استعادة تحقيق INC-2026-084' }).click();
  await book(page).getByAltText('معاينة الصورة المختارة مؤقتًا').waitFor();
  await book(page).getByRole('button', { name: 'إضافة ملاحظة' }).click();
  assert.equal(
    await book(page).locator('.analyst-note-image img').count(),
    1,
    'interrupted FileReader resumes from in-memory draft',
  );
  await book(page).getByRole('button', { name: 'تعديل الملاحظة ١' }).click();
  await book(page).getByRole('textbox', { name: 'تعديل الملاحظة ١' }).fill('تحرير غير محفوظ');
  await bar(page).getByRole('button', { name: 'استعادة تحقيق INC-2026-083' }).click();
  await bar(page).getByRole('button', { name: 'استعادة تحقيق INC-2026-084' }).click();
  assert.equal(
    await book(page).getByRole('textbox', { name: 'تعديل الملاحظة ١' }).inputValue(),
    'تحرير غير محفوظ',
  );
  await book(page).getByRole('button', { name: 'حفظ التعديل' }).click();
  await book(page).getByLabel('البحث في ملاحظات الحادثة').fill('تحرير غير محفوظ');
  await book(page).getByRole('button', { name: 'تعديل الملاحظة ١' }).click();
  await book(page).getByRole('textbox', { name: 'تعديل الملاحظة ١' }).fill('نص لا يطابق البحث');
  await book(page).getByRole('button', { name: 'حفظ التعديل' }).click();
  await page.waitForFunction(
    () => document.activeElement?.getAttribute('aria-label') === 'البحث في ملاحظات الحادثة',
  );
  await book(page).getByLabel('البحث في ملاحظات الحادثة').fill('');
  await d(page).getByRole('button', { name: 'الخط الزمني', exact: true }).click();
  await d(page).getByRole('button', { name: 'قصة التحقيق' }).click();
  // The observation is not in the hypothesis lane; add a hypothesis with two links below.
  await d(page).getByRole('button', { name: 'المهام والملاحظات' }).click();
  await book(page).getByLabel('نوع الملاحظة').selectOption('hypothesis');
  await book(page).getByLabel('ربط الملاحظة بسجل').selectOption('incident|INC-2026-084');
  await book(page).getByRole('button', { name: 'إضافة رابط آخر' }).click();
  await book(page).getByLabel('ربط الملاحظة بسجل').selectOption('event|EVT-90481');
  await book(page).getByLabel('ملاحظة جديدة للحادثة').fill('فرضية لها مرجعان');
  await book(page).getByRole('button', { name: 'إضافة ملاحظة' }).click();
  await d(page).getByRole('button', { name: 'الخط الزمني', exact: true }).click();
  await d(page).getByRole('button', { name: 'قصة التحقيق' }).click();
  const story = d(page).getByRole('region', { name: 'قصة التحقيق التجريبية' });
  assert.equal(
    await story
      .locator('.story-card.hypothesis')
      .getByRole('button', { name: /فتح السجل المرتبط/ })
      .count(),
    2,
    'story keeps all explicitly selected references',
  );
  await d(page).getByRole('button', { name: 'المهام والملاحظات' }).click();
  // Early character and image warnings, then enforced image capacity.
  await book(page).getByLabel('ملاحظة جديدة للحادثة').fill('x'.repeat(540));
  assert.match(await book(page).innerText(), /تبقّى ٦٠ حرفًا/);
  for (let n = 2; n <= 3; n++) {
    await book(page).getByLabel('ملاحظة جديدة للحادثة').fill(`صورة تجريبية ${n}`);
    await book(page)
      .getByLabel('اختيار صورة توضيحية للملاحظة')
      .setInputFiles({ name: `${n}.png`, mimeType: 'image/png', buffer: png });
    await book(page).getByAltText('معاينة الصورة المختارة مؤقتًا').waitFor();
    await book(page).getByRole('button', { name: 'إضافة ملاحظة' }).click();
    if (n === 2) assert.match(await book(page).innerText(), /تبقّى مكان لصورة واحدة/);
  }
  assert.equal(await book(page).getByLabel('اختيار صورة توضيحية للملاحظة').isDisabled(), true);
  assert.match(await book(page).innerText(), /بلغت حد الصور/);
  // Four notes now; fill to 45 and 50 through the same controls a user sees.
  for (let n = 5; n <= 50; n++) {
    await book(page).getByLabel('ملاحظة جديدة للحادثة').fill(`ملاحظة حد ${n}`);
    await book(page).getByRole('button', { name: 'إضافة ملاحظة' }).click();
    if (n === 45) assert.match(await book(page).innerText(), /اقتربت من الحد؛ تبقّى ٥ ملاحظات/);
  }
  assert.equal(await book(page).locator('.case-notes li').count(), 50);
  assert.match(await book(page).innerText(), /بلغت حد ٥٠ ملاحظة/);
  await book(page).getByLabel('ملاحظة جديدة للحادثة').fill('مسودة بعد امتلاء الدفتر');
  assert.equal(await book(page).getByRole('button', { name: 'إضافة ملاحظة' }).isDisabled(), true);
  // 3 default tasks; test warnings at 90 and enforcement at 100.
  for (let n = 4; n <= 100; n++) {
    await book(page).getByLabel('مهمة جديدة للحادثة').fill(`مهمة ${n}`);
    await book(page).getByRole('button', { name: 'إضافة مهمة' }).click();
    if (n === 90) assert.match(await book(page).innerText(), /اقتربت من الحد: تبقّى ١٠ مهام/);
  }
  assert.equal(await book(page).locator('.case-checklist li').count(), 100);
  assert.equal(await book(page).getByLabel('مهمة جديدة للحادثة').isDisabled(), true);
  assert.match(await book(page).innerText(), /بلغت الحد الأقصى للمهام/);
  await d(page).getByRole('button', { name: 'إغلاق' }).click();
  await nav(page, 'خريطة العلاقات');
  await page.getByRole('button', { name: 'مستكشف التحقيق', exact: true }).click();
  let graph = page.getByRole('region', { name: 'مستكشف التحقيق التفاعلي' });
  await graph.getByLabel('البحث في عقد التحقيق').fill('EVT-90481');
  await graph.getByRole('button', { name: /تحديد نتيجة حدث .*EVT-90481/ }).click();
  await graph.getByRole('button', { name: 'تثبيت العقدة', exact: true }).click();
  await page.getByRole('button', { name: 'العلاقات المباشرة', exact: true }).click();
  await page.getByRole('button', { name: 'مستكشف التحقيق', exact: true }).click();
  graph = page.getByRole('region', { name: 'مستكشف التحقيق التفاعلي' });
  assert.equal(await graph.getByLabel('البحث في عقد التحقيق').inputValue(), 'EVT-90481');
  assert.equal(
    await graph.getByRole('button', { name: 'إلغاء تثبيت العقدة', exact: true }).isVisible(),
    true,
    'global graph context survives mode switch',
  );
  clean(run);
  console.log(
    'PASS interrupted image, edit draft, multiple story references, 50-note/100-task/3-image limits and global graph memory',
  );
} finally {
  await run.context.close();
  await browser.close();
}
