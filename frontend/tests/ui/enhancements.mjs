// Focused regression tests for six UI-only enhancements. These do not certify WCAG compliance.
import { assert, launch, newPage, login, nav, noOverflow, clean } from '../support/helpers.mjs';

const browser = await launch();
const drawer = page => page.locator('.detail-layer-active .drawer');
async function run(name, options, fn) {
  const run = await newPage(browser, options);
  try {
    await login(run.page);
    await fn(run.page);
    clean(run);
    console.log(`PASS ${name}`);
  } finally {
    await run.context.close();
  }
}
try {
  await run(
    'custom shortcuts, known and duplicate conflicts, persistence and reset',
    {},
    async page => {
      await nav(page, 'الإعدادات');
      await page.getByRole('button', { name: /اختصارات لوحة المفاتيح/ }).click();
      await page.getByRole('button', { name: 'تغيير اختصار فتح البحث العام' }).click();
      const capture = page.getByLabel('إدخال اختصار فتح البحث العام');
      await capture.waitFor();
      await page.keyboard.press('Alt+j');
      await page.waitForFunction(
        () => document.querySelector('.top-search')?.getAttribute('aria-keyshortcuts') === 'Alt+J',
      );
      const search = page.getByRole('button', { name: 'البحث في المنصة' });
      assert.equal(await search.locator('kbd').innerText(), 'Alt + J');
      await page.getByRole('button', { name: 'تخصيص اختصار فتح التنبيهات' }).click();
      const alertsCapture = page.getByLabel('إدخال اختصار فتح التنبيهات');
      await page.keyboard.press('Alt+j');
      assert.match(await page.getByRole('alert').innerText(), /مستخدم بالفعل/);
      await alertsCapture.evaluate(el =>
        el.dispatchEvent(
          new KeyboardEvent('keydown', {
            key: 'l',
            code: 'KeyL',
            ctrlKey: true,
            bubbles: true,
            cancelable: true,
          }),
        ),
      );
      assert.match(await page.getByRole('alert').innerText(), /تعارض/);
      await page.keyboard.press('Alt+u');
      await page.waitForFunction(
        () => !document.querySelector('[aria-label="إدخال اختصار فتح التنبيهات"]'),
      );
      await page.keyboard.press('Alt+u');
      assert.equal(await page.locator('h1').innerText(), 'التنبيهات');
      assert.equal(
        await page
          .locator('#primary-navigation')
          .getByRole('button', { name: /التنبيهات/ })
          .getAttribute('aria-keyshortcuts'),
        'Alt+U',
      );
      await page.locator('table tbody tr').filter({ hasText: 'ALT-1284' }).click();
      await page.keyboard.press('Alt+j');
      await page.getByRole('dialog', { name: 'البحث في المنصة' }).waitFor();
      await page.keyboard.press('Escape');
      assert.equal(await page.getByRole('dialog', { name: 'البحث في المنصة' }).count(), 0);
      assert.equal(await drawer(page).isVisible(), true);
      await drawer(page).getByRole('button', { name: 'إغلاق' }).click();
      await page.keyboard.press('Alt+j');
      let dialog = page.getByRole('dialog', { name: 'البحث في المنصة' });
      await dialog.waitFor();
      await page.keyboard.press('Escape');
      await dialog.waitFor({ state: 'detached' });
      await page.reload();
      await login(page);
      assert.equal(
        await page
          .getByRole('button', { name: 'البحث في المنصة' })
          .getAttribute('aria-keyshortcuts'),
        'Alt+J',
      );
      await nav(page, 'الإعدادات');
      await page.getByRole('button', { name: /اختصارات لوحة المفاتيح/ }).click();
      await page.getByRole('button', { name: 'تعطيل اختصار فتح البحث العام' }).click();
      assert.equal(
        await page
          .getByRole('button', { name: 'البحث في المنصة' })
          .getAttribute('aria-keyshortcuts'),
        null,
      );
      await page.keyboard.press('Alt+j');
      assert.equal(await dialog.count(), 0);
      await page.getByRole('button', { name: 'استعادة الاختصارات الافتراضية' }).click();
      assert.equal(
        await page
          .getByRole('button', { name: 'البحث في المنصة' })
          .getAttribute('aria-keyshortcuts'),
        'Alt+K',
      );
    },
  );
  await run('categorized global search and compatible severity/time filters', {}, async page => {
    await page.getByRole('button', { name: 'البحث في المنصة' }).click();
    const modal = page.getByRole('dialog', { name: 'البحث في المنصة' }),
      field = modal.getByLabel('ابحث عن حادثة، تنبيه، أصل، مصدر بيانات أو عنوان IP أو MAC');
    for (const label of ['الحوادث', 'التنبيهات', 'الأحداث', 'الأصول', 'المصادر'])
      assert.equal(await modal.locator(`section[aria-label="نتائج ${label}"]`).count(), 1);
    await field.fill('10.20.4.24');
    for (const label of ['الحوادث', 'التنبيهات', 'الأحداث', 'الأصول'])
      assert.equal(await modal.locator(`section[aria-label="نتائج ${label}"]`).count(), 1);
    await modal.getByLabel('خطورة البحث').selectOption({ label: 'عالية' });
    assert.equal(await modal.locator('section[aria-label="نتائج الأحداث"]').count(), 0);
    assert.equal(await modal.locator('section[aria-label="نتائج الأصول"]').count(), 0);
    assert.match(await modal.locator('.search-results').innerText(), /ALT-1282/);
    assert.doesNotMatch(await modal.locator('.search-results').innerText(), /ALT-1279/);
    await modal.getByLabel('فترة البحث').selectOption('24h');
    assert.match(await modal.locator('.search-filter-note').innerText(), /ثابتة/);
    await modal.getByRole('button', { name: 'إعادة ضبط' }).click();
    await modal.getByLabel('فترة البحث').selectOption('24h');
    assert.equal(await modal.locator('section[aria-label="نتائج الأصول"]').count(), 0);
    assert.equal(await modal.locator('section[aria-label="نتائج المصادر"]').count(), 0);
    assert.equal(await modal.locator('section[aria-label="نتائج الأحداث"]').count(), 1);
    await modal.getByRole('button', { name: 'إعادة ضبط' }).click();
    await field.fill('SRC-001');
    await modal.getByRole('button', { name: 'المصادر', exact: true }).click();
    assert.equal(await modal.locator('.search-result-group').count(), 1);
    await modal.locator('.search-result-group button').filter({ hasText: 'SRC-001' }).click();
    assert.match(await drawer(page).locator('h2').first().innerText(), /SRC-001/);
    await drawer(page).getByRole('button', { name: 'إغلاق' }).click();
  });
  await run(
    'alert grouping, filtering, expanded state and selection across collapsed groups',
    { width: 320, theme: 'light' },
    async page => {
      await nav(page, 'التنبيهات');
      await page.getByLabel('تجميع التنبيهات').selectOption('asset');
      const group = page.locator('tbody[aria-label="الأصل WS-FIN-024"]');
      assert.equal(await group.locator('tr.clickable-row').count(), 3);
      const toggle = group.getByRole('button', { name: /الأصل: WS-FIN-024/ });
      assert.equal(await toggle.getAttribute('aria-expanded'), 'true');
      await group.getByRole('checkbox', { name: 'تحديد ALT-1282' }).check();
      await toggle.click();
      assert.equal(await toggle.getAttribute('aria-expanded'), 'false');
      assert.equal(await group.locator('tr.clickable-row').count(), 0);
      assert.match(await group.innerText(), /محدد/);
      await page.getByRole('button', { name: 'تحديد المعروض' }).click();
      assert.match(await page.locator('.bulk-toolbar').innerText(), /٧ محدد/);
      await page.getByRole('button', { name: 'مراجعة المحدد' }).click();
      const confirm = page.getByRole('dialog', { name: /مراجعة/ });
      assert.match(await confirm.innerText(), /ALT-1282/);
      await confirm.getByRole('button', { name: 'إلغاء' }).click();
      await page.getByLabel('تجميع التنبيهات').selectOption('source');
      assert.equal(
        await page.locator('tbody[aria-label="عنوان المصدر 10.20.4.24"] tr.clickable-row').count(),
        3,
      );
      await page.getByLabel('مستوى الخطورة').selectOption({ label: 'متوسطة' });
      assert.equal(
        await page.locator('tbody[aria-label="عنوان المصدر 10.20.4.24"] tr.clickable-row').count(),
        2,
      );
      // Selection is cleared by a React effect after the new filter is committed;
      // wait for the observable UI state instead of reading the transient render.
      await page.locator('.bulk-toolbar strong').filter({ hasText: '٠ محدد' }).waitFor();
      assert.match(await page.locator('.bulk-toolbar').innerText(), /٠ محدد/);
      await page.getByRole('button', { name: 'حفظ العرض مؤقتًا' }).click();
      await page.getByLabel('تجميع التنبيهات').selectOption('none');
      await page.getByRole('button', { name: 'استعادة العرض' }).click();
      assert.equal(await page.getByLabel('تجميع التنبيهات').inputValue(), 'source');
      await noOverflow(page, 'grouped alerts mobile');
    },
  );
  await run(
    'incident-specific checklist and notes, session privacy and read-only simulation',
    {},
    async page => {
      await nav(page, 'الحوادث');
      await page.locator('table tbody tr').filter({ hasText: 'INC-2026-084' }).click();
      let panel = drawer(page);
      await panel.getByRole('button', { name: 'المهام والملاحظات' }).click();
      assert.equal(await panel.locator('.case-checklist input').count(), 3);
      await panel
        .getByRole('checkbox', { name: 'مراجعة سياق التنبيه والأصل', exact: true })
        .check();
      await panel.getByLabel('مهمة جديدة للحادثة').fill('مراجعة إضافية غير حساسة');
      await panel.getByLabel('مهمة جديدة للحادثة').press('Enter');
      assert.equal(await panel.locator('.case-checklist li').count(), 4);
      await panel.getByLabel('ملاحظة جديدة للحادثة').fill('ملاحظة تجريبية فقط');
      await panel.getByRole('button', { name: 'إضافة ملاحظة' }).click();
      assert.match(await panel.locator('.case-notes').innerText(), /ملاحظة تجريبية فقط/);
      await panel.getByRole('button', { name: 'تعديل الملاحظة ١' }).click();
      await page.waitForFunction(
        () => document.activeElement?.getAttribute('aria-label') === 'تعديل الملاحظة ١',
      );
      await panel.getByLabel('تعديل الملاحظة ١').press('Escape');
      assert.match(await panel.locator('.case-notes').innerText(), /ملاحظة تجريبية فقط/);
      assert.equal(
        await panel.getByRole('button', { name: 'المهام والملاحظات' }).getAttribute('aria-pressed'),
        'true',
      );
      await panel.getByRole('button', { name: 'تعديل الملاحظة ١' }).click();
      await panel.getByLabel('تعديل الملاحظة ١').fill('ملاحظة معدلة');
      await panel.getByRole('button', { name: 'حفظ التعديل' }).click();
      await page.waitForFunction(
        () => document.activeElement?.getAttribute('aria-label') === 'تعديل الملاحظة ١',
      );
      const saved = await page.evaluate(() =>
        Object.keys(localStorage)
          .map(k => localStorage.getItem(k))
          .join(' '),
      );
      assert.doesNotMatch(saved, /ملاحظة معدلة|مراجعة إضافية/);
      await panel.getByRole('button', { name: 'إغلاق' }).click();
      await page.locator('table tbody tr').filter({ hasText: 'INC-2026-083' }).click();
      panel = drawer(page);
      await panel.getByRole('button', { name: 'المهام والملاحظات' }).click();
      assert.equal(await panel.locator('.case-notes li').count(), 0);
      assert.equal(await panel.locator('.case-checklist li').count(), 3);
      await panel.getByRole('button', { name: 'إغلاق' }).click();
      await page.locator('table tbody tr').filter({ hasText: 'INC-2026-084' }).click();
      panel = drawer(page);
      await panel.getByRole('button', { name: 'المهام والملاحظات' }).click();
      assert.match(await panel.innerText(), /ملاحظة معدلة/);
      assert.equal(
        await panel
          .getByRole('checkbox', { name: 'مراجعة سياق التنبيه والأصل', exact: true })
          .isChecked(),
        true,
      );
      await panel.getByRole('button', { name: 'إغلاق' }).click();
      await nav(page, 'الإعدادات');
      await page.getByRole('switch', { name: 'محاكاة انقطاع الاتصال' }).click();
      await nav(page, 'الحوادث');
      await page.locator('table tbody tr').filter({ hasText: 'INC-2026-084' }).click();
      panel = drawer(page);
      await panel.getByRole('button', { name: 'المهام والملاحظات' }).click();
      assert.match(await panel.innerText(), /ملاحظة معدلة/);
      assert.equal(await panel.getByLabel('مهمة جديدة للحادثة').isDisabled(), true);
      assert.equal(await panel.getByLabel('ملاحظة جديدة للحادثة').isDisabled(), true);
      assert.equal(
        await panel
          .getByRole('checkbox', { name: 'مراجعة سياق التنبيه والأصل', exact: true })
          .isDisabled(),
        true,
      );
      await page.reload();
      await login(page);
      await nav(page, 'الحوادث');
      await page.locator('table tbody tr').filter({ hasText: 'INC-2026-084' }).click();
      panel = drawer(page);
      await panel.getByRole('button', { name: 'المهام والملاحظات' }).click();
      assert.equal(await panel.locator('.case-notes li').count(), 0);
      assert.equal(await panel.locator('.case-checklist li').count(), 3);
      assert.equal(
        await panel
          .getByRole('checkbox', { name: 'مراجعة سياق التنبيه والأصل', exact: true })
          .isChecked(),
        false,
      );
      await panel.getByLabel('ملاحظة جديدة للحادثة').fill('تمحى عند الخروج');
      await panel.getByRole('button', { name: 'إضافة ملاحظة' }).click();
      await panel.getByRole('button', { name: 'إغلاق' }).click();
      await page.getByRole('button', { name: 'قائمة الحساب' }).click();
      await page.getByRole('button', { name: 'تسجيل الخروج التجريبي' }).click();
      await login(page);
      await nav(page, 'الحوادث');
      await page.locator('table tbody tr').filter({ hasText: 'INC-2026-084' }).click();
      panel = drawer(page);
      await panel.getByRole('button', { name: 'المهام والملاحظات' }).click();
      assert.equal(await panel.locator('.case-notes li').count(), 0);
    },
  );
  await run('density and independent dashboard card order per demo role', {}, async page => {
    await nav(page, 'الإعدادات');
    await page.getByRole('button', { name: /تخصيص الواجهة/ }).click();
    await page.getByLabel('مضغوطة').check();
    assert.equal(await page.locator('.app-shell').getAttribute('data-density'), 'compact');
    await page.getByRole('button', { name: 'خفض الأحداث المحلَّلة' }).click();
    await page.waitForFunction(
      () => document.activeElement?.getAttribute('aria-label') === 'خفض الأحداث المحلَّلة',
    );
    assert.match(
      await page.locator('.personalization-body [role="status"]').innerText(),
      /الموضع 2/,
    );
    await page.getByLabel('دور ترتيب لوحة المعلومات').selectOption({ label: 'قيادة المؤسسة' });
    for (let i = 0; i < 3; i++)
      await page.getByRole('button', { name: 'رفع الأصول في العينة' }).click();
    await nav(page, 'نظرة عامة');
    let first = page.locator('.stats-grid .stat-label').first();
    assert.equal(await first.innerText(), 'التنبيهات المرصودة');
    await page.getByLabel('معاينة لوحة الدور').selectOption({ label: 'قيادة المؤسسة' });
    assert.equal(await first.innerText(), 'الأصول في العينة');
    await page.reload();
    await login(page);
    assert.equal(await page.locator('.app-shell').getAttribute('data-density'), 'compact');
    assert.equal(await first.innerText(), 'التنبيهات المرصودة');
    await page.getByLabel('معاينة لوحة الدور').selectOption({ label: 'قيادة المؤسسة' });
    assert.equal(await first.innerText(), 'الأصول في العينة');
  });
} finally {
  await browser.close();
}
console.log(
  'PASS UI-only enhancement regressions; real operations and authentication are not implemented.',
);
