// Local persistence, read-only simulation, exports and keyboard checks for the
// integrated prototype. All records are fictional; no backend is exercised.
import fs from 'node:fs';
import { assert, launch, newPage, login, nav, clean, noOverflow } from '../../support/helpers.mjs';

const browser = await launch();
const drawer = page => page.locator('.detail-layer-active .drawer');
const openIncident = async page => {
  await nav(page, 'الحوادث');
  await page.locator('.data-panel tbody tr').filter({ hasText: 'INC-2026-084' }).click();
};
async function run(title, options, fn) {
  const r = await newPage(browser, options);
  try {
    await login(r.page);
    await fn(r.page);
    clean(r);
    console.log(`PASS ${title}`);
  } finally {
    await r.context.close();
  }
}
try {
  await run('global range, custom and prepared report exports', { width: 1440 }, async page => {
    await page.getByLabel('الفترة العامة للعينة').selectOption('1h');
    await nav(page, 'التقارير');
    await page.locator('.report-designer>summary').click();
    await page.getByRole('checkbox', { name: 'الأحداث المفصّلة' }).check();
    await page.getByRole('button', { name: 'تصدير بيانات المعاينة CSV' }).click();
    let dialog = page.getByRole('dialog', { name: 'معاينة تصدير CSV' });
    assert.match(await dialog.locator('.export-preview-head').innerText(), /٧ صف/);
    let [download] = await Promise.all([
      page.waitForEvent('download'),
      dialog.getByRole('button', { name: 'تنزيل CSV' }).click(),
    ]);
    let csv = fs.readFileSync(await download.path(), 'utf8');
    for (const id of [
      'INC-2026-084',
      'INC-2026-083',
      'ALT-1284',
      'ALT-1283',
      'EVT-90481',
      'EVT-90480',
    ])
      assert.ok(csv.includes(id), `expected ${id}`);
    for (const id of ['INC-2026-082', 'ALT-1282', 'EVT-90479'])
      assert.ok(!csv.includes(id), `out of range ${id}`);
    await page.getByRole('button', { name: 'تصدير ملخص الحوادث الأمنية' }).click();
    dialog = page.getByRole('dialog', { name: 'معاينة تصدير CSV' });
    assert.match(await dialog.locator('.export-preview-head').innerText(), /٢ صف/);
    await dialog.getByRole('button', { name: 'إغلاق' }).click();
    await page
      .locator('.report-card')
      .filter({ hasText: 'تقرير التنبيهات والكشف' })
      .getByRole('button', { name: 'معاينة التقرير' })
      .click();
    let report = page.getByRole('dialog', { name: 'معاينة التقرير' });
    assert.match(await report.locator('.report-preview').innerText(), /آخر ساعة/);
    await report.getByRole('button', { name: 'تصدير CSV' }).click();
    dialog = page.getByRole('dialog', { name: 'معاينة تصدير CSV' });
    assert.match(await dialog.locator('.export-preview-scroll').innerText(), /ALT-1284/);
    assert.doesNotMatch(await dialog.locator('.export-preview-scroll').innerText(), /INC-2026/);
    [download] = await Promise.all([
      page.waitForEvent('download'),
      dialog.getByRole('button', { name: 'تنزيل CSV' }).click(),
    ]);
    csv = fs.readFileSync(await download.path(), 'utf8');
    assert.match(csv, /ALT-1284/);
    assert.doesNotMatch(csv, /ALT-1282|INC-2026/);
    await report.getByRole('button', { name: 'إغلاق' }).first().click();
    await page
      .locator('.report-card')
      .filter({ hasText: 'تقرير سجل التدقيق' })
      .getByRole('button', { name: 'معاينة التقرير' })
      .click();
    report = page.getByRole('dialog', { name: 'معاينة التقرير' });
    assert.match(await report.innerText(), /سجل التدقيق · لقطة مستقلة/);
    await report.getByRole('button', { name: 'تصدير CSV' }).click();
    dialog = page.getByRole('dialog', { name: 'معاينة تصدير CSV' });
    assert.match(
      await dialog.locator('.export-preview-scroll').innerText(),
      /AUD-1048|اقتراح إجراء احتواء/,
    );
    await dialog.getByRole('button', { name: 'إغلاق' }).click();
    await report.getByRole('button', { name: 'إغلاق' }).first().click();
    await nav(page, 'التنبيهات');
    await page.getByRole('button', { name: 'تصدير العينة' }).click();
    dialog = page.getByRole('dialog', { name: 'معاينة تصدير CSV' });
    assert.match(await dialog.innerText(), /كل سجلات الفترة العامة/);
    assert.match(await dialog.locator('.export-preview-head').innerText(), /٢ صف/);
    await dialog.getByRole('button', { name: 'إغلاق' }).click();
  });
  await run(
    'offline prevents new evidence/playbook changes, reload clears session',
    { width: 320, theme: 'light' },
    async page => {
      await openIncident(page);
      let d = drawer(page);
      await d.getByRole('button', { name: 'مراجع الأدلة', exact: true }).click();
      await d.getByLabel('عنوان المرجع التجريبي').fill('مرجع غير حساس');
      await d.getByRole('button', { name: 'إضافة مرجع' }).click();
      await d.getByRole('button', { name: 'قوالب الاستجابة', exact: true }).click();
      await d.getByRole('checkbox', { name: /راجع التنبيه والأصل/ }).check();
      await d.getByRole('button', { name: 'إغلاق' }).click();
      await nav(page, 'الإعدادات');
      await page.getByRole('switch', { name: 'محاكاة انقطاع الاتصال' }).click();
      await openIncident(page);
      d = drawer(page);
      await d.getByRole('button', { name: 'مراجع الأدلة', exact: true }).click();
      assert.match(await d.innerText(), /مرجع غير حساس/);
      assert.equal(await d.getByLabel('عنوان المرجع التجريبي').isDisabled(), true);
      assert.equal(await d.getByRole('button', { name: 'إضافة مرجع' }).isDisabled(), true);
      assert.equal(
        await d.getByRole('button', { name: 'حذف المرجع مرجع غير حساس' }).isDisabled(),
        true,
      );
      await d.getByRole('button', { name: 'قوالب الاستجابة', exact: true }).click();
      let task = d.getByRole('checkbox', { name: /راجع التنبيه والأصل/ });
      assert.equal(await task.isChecked(), true);
      assert.equal(await task.isDisabled(), true);
      await d.getByRole('button', { name: 'إغلاق' }).click();
      await page.locator('.experience-module>summary').click();
      assert.equal(await page.getByLabel('ملاحظة تسليم غير حساسة').isDisabled(), true);
      await noOverflow(page, 'offline 320');
      await page.getByRole('button', { name: 'إنهاء المحاكاة' }).click();
      assert.equal(await page.getByLabel('ملاحظة تسليم غير حساسة').isDisabled(), false);
      await page.reload();
      await login(page);
      await openIncident(page);
      d = drawer(page);
      await d.getByRole('button', { name: 'مراجع الأدلة', exact: true }).click();
      assert.doesNotMatch(await d.innerText(), /مرجع غير حساس/);
      await d.getByRole('button', { name: 'قوالب الاستجابة', exact: true }).click();
      task = d.getByRole('checkbox', { name: /راجع التنبيه والأصل/ });
      assert.equal(await task.isChecked(), false);
    },
  );
  await run('per-role dashboard visibility persists independently', { width: 1440 }, async page => {
    await page.locator('.dashboard-customize>summary').click();
    await page.getByRole('checkbox', { name: 'الأحداث المحلَّلة' }).uncheck();
    assert.equal(await page.locator('.stats-grid .stat-card').count(), 3);
    await page.getByLabel('معاينة لوحة الدور').selectOption({ label: 'محلل أمني' });
    assert.equal(await page.locator('.stats-grid .stat-card').count(), 4);
    await page.getByRole('checkbox', { name: 'التنبيهات المرصودة' }).uncheck();
    assert.equal(await page.locator('.stats-grid .stat-card').count(), 3);
    await page.getByLabel('معاينة لوحة الدور').selectOption({ label: 'مدير النظام' });
    assert.equal(
      await page.getByRole('checkbox', { name: 'الأحداث المحلَّلة' }).isChecked(),
      false,
    );
    assert.equal(
      await page.getByRole('checkbox', { name: 'التنبيهات المرصودة' }).isChecked(),
      true,
    );
    await page.reload();
    await login(page);
    await page.locator('.dashboard-customize>summary').click();
    assert.equal(
      await page.getByRole('checkbox', { name: 'الأحداث المحلَّلة' }).isChecked(),
      false,
    );
    await page.getByLabel('معاينة لوحة الدور').selectOption({ label: 'محلل أمني' });
    assert.equal(
      await page.getByRole('checkbox', { name: 'التنبيهات المرصودة' }).isChecked(),
      false,
    );
    assert.equal(await page.getByRole('checkbox', { name: 'الأحداث المحلَّلة' }).isChecked(), true);
  });
  await run('keyboard activates details, modal and scope', { width: 320 }, async page => {
    const selector = page.getByLabel('الفترة العامة للعينة');
    await selector.focus();
    await page.keyboard.press('Home');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    assert.equal(await selector.inputValue(), '24h');
    await nav(page, 'مستكشف الأحداث');
    const summary = page.locator('.hunt-workspace>summary');
    await summary.focus();
    await page.keyboard.press('Enter');
    assert.equal(await page.locator('.hunt-workspace').getAttribute('open'), '');
    await page.getByLabel('قيمة الشرط ١').focus();
    assert.equal(
      await page.evaluate(() => document.activeElement.getAttribute('aria-label')),
      'قيمة الشرط ١',
    );
    await page.getByRole('button', { name: 'المساعد التجريبي' }).focus();
    await page.keyboard.press('Enter');
    await page.getByRole('dialog', { name: 'المساعد التجريبي' }).waitFor();
    await page.keyboard.press('Escape');
    assert.equal(await page.getByRole('dialog', { name: 'المساعد التجريبي' }).count(), 0);
    await page.waitForFunction(
      () => document.activeElement?.getAttribute('aria-label') === 'المساعد التجريبي',
    );
    await noOverflow(page, 'keyboard mobile');
  });
} finally {
  await browser.close();
}
console.log(
  'PASS integrated local behavior; preferences are presentation only and offline mode is a UI simulation.',
);
