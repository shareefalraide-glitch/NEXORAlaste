import fs from 'node:fs';
import http from 'node:http';
import {
  assert,
  launch,
  newPage,
  login,
  nav,
  noOverflow,
  clean,
  builtUrl,
} from '../support/helpers.mjs';

const browser = await launch();
async function run(name, options, fn) {
  const instance = await newPage(browser, options);
  try {
    await login(instance.page);
    await fn(instance.page);
    clean(instance);
    console.log(`PASS ${name}`);
  } finally {
    await instance.context.close();
  }
}
const activeDrawer = page => page.locator('.detail-layer-active .drawer');
try {
  await run('search shortcut, focus, Arabic layout and editable-field guards', {}, async page => {
    const search = page.getByRole('button', { name: 'البحث في المنصة' }),
      opener = page.getByRole('button', { name: 'NEXORA الصفحة الرئيسية' });
    assert.equal(await search.getAttribute('aria-keyshortcuts'), 'Alt+K');
    assert.equal(await search.locator('kbd').innerText(), 'Alt + K');
    await opener.focus();
    await page.evaluate(() => {
      window.__shortcutPrevented = null;
      const record = e => {
        if (e.code === 'KeyK') {
          window.__shortcutPrevented = e.defaultPrevented;
          window.removeEventListener('keydown', record);
        }
      };
      window.addEventListener('keydown', record);
    });
    await page.keyboard.press('Alt+k');
    let dialog = page.getByRole('dialog', { name: 'البحث في المنصة' });
    await dialog.waitFor();
    const field = dialog.getByLabel('ابحث عن حادثة، تنبيه، أصل، مصدر بيانات أو عنوان IP أو MAC');
    await page.waitForFunction(
      () =>
        document.activeElement?.getAttribute('aria-label') ===
        'ابحث عن حادثة، تنبيه، أصل، مصدر بيانات أو عنوان IP أو MAC',
    );
    assert.equal(await page.evaluate(() => window.__shortcutPrevented), true);
    await page.keyboard.type('INC-2026-084');
    assert.match(await dialog.locator('.search-results').innerText(), /INC-2026-084/);
    await page.keyboard.press('Escape');
    await dialog.waitFor({ state: 'detached' });
    assert.equal(await opener.evaluate(el => el === document.activeElement), true);
    await search.click();
    dialog = page.getByRole('dialog', { name: 'البحث في المنصة' });
    await dialog.waitFor();
    await page.waitForFunction(
      () =>
        document.activeElement?.getAttribute('aria-label') ===
        'ابحث عن حادثة، تنبيه، أصل، مصدر بيانات أو عنوان IP أو MAC',
    );
    await page.keyboard.press('Escape');
    await dialog.waitFor({ state: 'detached' });
    assert.equal(await search.evaluate(el => el === document.activeElement), true);
    // Do not hijack browser Ctrl+K, nor Alt+K while a text field has focus.
    const browserKeyPrevented = await page.evaluate(() => {
      const e = new KeyboardEvent('keydown', {
        key: 'k',
        code: 'KeyK',
        ctrlKey: true,
        bubbles: true,
        cancelable: true,
      });
      document.activeElement.dispatchEvent(e);
      return e.defaultPrevented;
    });
    assert.equal(browserKeyPrevented, false);
    assert.equal(await dialog.count(), 0);
    await nav(page, 'الإعدادات');
    const org = page.getByLabel('اسم المؤسسة');
    await org.focus();
    await page.keyboard.press('Alt+k');
    assert.equal(await dialog.count(), 0);
    await search.focus();
    const arabicKeyPrevented = await page.evaluate(() => {
      const e = new KeyboardEvent('keydown', {
        key: 'ن',
        code: 'KeyK',
        altKey: true,
        bubbles: true,
        cancelable: true,
      });
      document.activeElement.dispatchEvent(e);
      return e.defaultPrevented;
    });
    assert.equal(arabicKeyPrevented, true);
    await dialog.waitFor();
    await page.keyboard.press('Escape');
    await dialog.waitFor({ state: 'detached' });
  });
  // Mac presentation: Option and Alt describe the same physical modifier.
  {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      reducedMotion: 'reduce',
    });
    try {
      await context.addInitScript(() =>
        Object.defineProperty(navigator, 'platform', { configurable: true, get: () => 'MacIntel' }),
      );
      const page = await context.newPage();
      await page.goto(builtUrl);
      await login(page);
      const trigger = page.getByRole('button', { name: 'البحث في المنصة' });
      assert.equal(await trigger.locator('kbd').innerText(), '⌥ + K');
      await trigger.focus();
      await page.keyboard.press('Alt+k');
      await page.getByRole('dialog', { name: 'البحث في المنصة' }).waitFor();
      console.log('PASS search shortcut label on macOS');
    } finally {
      await context.close();
    }
  }
  await run('investigation context, back stack and source-card links', {}, async page => {
    await nav(page, 'الحوادث');
    await page.locator('table tbody tr').filter({ hasText: 'INC-2026-084' }).click();
    let drawer = activeDrawer(page);
    await drawer.getByRole('button', { name: 'التنبيهات', exact: true }).click();
    await drawer.locator('.related-row').filter({ hasText: 'ALT-1284' }).click();
    drawer = activeDrawer(page);
    assert.match(await drawer.locator('h2').first().innerText(), /ALT-1284/);
    await drawer.getByRole('button', { name: 'عرض مصدر البيانات' }).click();
    drawer = activeDrawer(page);
    assert.match(await drawer.locator('h2').first().innerText(), /SRC-/);
    assert.match(await drawer.locator('.investigation-crumbs').innerText(), /INC-2026-084/);
    assert.match(await drawer.innerText(), /أحداث المصدر في العينة/);
    await drawer.getByRole('button', { name: 'العودة للسجل السابق' }).click();
    drawer = activeDrawer(page);
    assert.match(await drawer.locator('h2').first().innerText(), /ALT-1284/);
    await drawer.getByRole('button', { name: 'العودة للسجل السابق' }).click();
    drawer = activeDrawer(page);
    assert.equal(
      await drawer
        .getByRole('button', { name: 'التنبيهات', exact: true })
        .getAttribute('aria-pressed'),
      'true',
    );
    await drawer.getByRole('button', { name: 'إغلاق' }).click();
    await nav(page, 'مصادر البيانات');
    await page
      .locator('.source-card')
      .first()
      .getByRole('button', { name: 'تفاصيل المصدر' })
      .click();
    drawer = activeDrawer(page);
    assert.match(await drawer.innerText(), /SRC-001/);
    assert.match(await drawer.innerText(), /طريقة جمع البيانات/);
    const related = drawer.locator('.related-row').first();
    assert.ok((await related.count()) > 0);
    await related.click();
    drawer = activeDrawer(page);
    assert.match(await drawer.locator('.investigation-crumbs').innerText(), /SRC-001/);
    await drawer.getByRole('button', { name: 'إغلاق' }).click();
    await nav(page, 'الأصول');
    await page.locator('table tbody tr').filter({ hasText: 'AD-SRV-01' }).click();
    drawer = activeDrawer(page);
    assert.match(await drawer.innerText(), /تنبيهات الأصل في العينة/);
    assert.match(await drawer.innerText(), /أحداث الأصل في العينة/);
    const assetRelated = drawer
      .locator('.investigation-related')
      .filter({ hasText: 'تنبيهات الأصل في العينة' })
      .locator('.related-row')
      .first();
    assert.ok((await assetRelated.count()) > 0);
    await assetRelated.click();
    assert.match(await activeDrawer(page).locator('.investigation-crumbs').innerText(), /AST-/);
  });
  await run('approval return, resubmission, rejection and history', {}, async page => {
    await page.locator('.attention-approval button').click();
    let dialog = page.getByRole('dialog', { name: 'مراجعة طلب الاحتواء' });
    await dialog.getByLabel('إعادة للتعديل').check();
    await dialog.getByLabel('سبب الإعادة للتعديل').fill('نحتاج تحديد الهدف');
    await dialog.getByRole('checkbox').check();
    await dialog.getByRole('button', { name: 'تسجيل الإعادة للتعديل' }).click();
    await nav(page, 'الحوادث');
    await page.locator('table tbody tr').filter({ hasText: 'INC-2026-083' }).click();
    let drawer = activeDrawer(page);
    assert.match(await drawer.innerText(), /راجع سبب الإعادة/);
    await drawer.getByRole('button', { name: 'الإجراءات', exact: true }).click();
    assert.match(await drawer.locator('.approval-history').innerText(), /نحتاج تحديد الهدف/);
    await drawer.getByRole('button', { name: 'طلب الموافقة' }).click();
    dialog = page.getByRole('dialog', { name: 'طلب إجراء احتواء' });
    await dialog.getByLabel('سبب طلب الاحتواء').fill('تم تحديد الهدف من جديد');
    await dialog.getByRole('button', { name: 'إرسال طلب تجريبي' }).click();
    await drawer.getByRole('button', { name: 'مراجعة الموافقة' }).click();
    dialog = page.getByRole('dialog', { name: 'مراجعة طلب الاحتواء' });
    await dialog.getByLabel('رفض الطلب').check();
    await dialog.getByLabel('سبب الرفض').fill('المعلومات غير كافية');
    await dialog.getByRole('checkbox').check();
    await dialog.getByRole('button', { name: 'تسجيل الرفض' }).click();
    assert.match(await drawer.innerText(), /مرفوض/);
    assert.match(await drawer.locator('.approval-history').innerText(), /المعلومات غير كافية/);
    await drawer.getByRole('button', { name: 'إغلاق' }).click();
    await page.getByRole('button', { name: 'الإشعارات التجريبية' }).click();
    assert.match(
      await page.getByRole('region', { name: 'مركز الإشعارات التجريبي' }).innerText(),
      /تحديث طلب احتواء: مرفوض/,
    );
  });
  await run('unsaved form and settings guards', {}, async page => {
    await nav(page, 'مصادر البيانات');
    await page.getByRole('button', { name: 'إضافة مصدر' }).click();
    const dialog = page.getByRole('dialog', { name: 'إضافة مصدر بيانات' }),
      name = dialog.getByPlaceholder('مثال: مستشعر المقر الرئيسي');
    await name.fill('اختبار حفظ');
    assert.equal(
      await page.evaluate(() => {
        const e = new Event('beforeunload', { cancelable: true });
        window.dispatchEvent(e);
        return e.defaultPrevented;
      }),
      true,
    );
    await page.keyboard.press('Escape');
    let confirm = page.getByRole('dialog', { name: 'تغييرات غير محفوظة' });
    await confirm.getByRole('button', { name: 'متابعة التعديل' }).click();
    assert.equal(await name.inputValue(), 'اختبار حفظ');
    await dialog.getByRole('button', { name: 'إغلاق' }).click();
    await confirm.getByRole('button', { name: 'تجاهل التغييرات' }).click();
    assert.equal(await page.getByRole('dialog').count(), 0);
    await nav(page, 'الإعدادات');
    const org = page.getByLabel('اسم المؤسسة');
    // Dirty protection must update synchronously, not depend on a deferred React effect.
    for (let i = 0; i < 3; i++) {
      await org.fill(`تعديل ${i}`);
      assert.equal(
        await page.evaluate(() => {
          const e = new Event('beforeunload', { cancelable: true });
          window.dispatchEvent(e);
          return e.defaultPrevented;
        }),
        true,
      );
      await org.fill('المؤسسة التجريبية');
      assert.equal(
        await page.evaluate(() => {
          const e = new Event('beforeunload', { cancelable: true });
          window.dispatchEvent(e);
          return e.defaultPrevented;
        }),
        false,
      );
    }
    await org.fill('تعديل مؤقت');
    assert.equal(
      await page.evaluate(() => {
        const e = new Event('beforeunload', { cancelable: true });
        window.dispatchEvent(e);
        return e.defaultPrevented;
      }),
      true,
    );
    await nav(page, 'الحوادث');
    confirm = page.getByRole('dialog', { name: 'إعدادات غير محفوظة' });
    await confirm.getByRole('button', { name: 'متابعة التعديل' }).click();
    assert.equal(await page.getByLabel('اسم المؤسسة').inputValue(), 'تعديل مؤقت');
    await page.getByRole('button', { name: 'حفظ التغييرات' }).click();
    await nav(page, 'الحوادث');
    assert.equal(await page.getByRole('dialog', { name: 'إعدادات غير محفوظة' }).count(), 0);
  });
  await run(
    'bulk review, assignment, confirmation and undo on mobile',
    { width: 320 },
    async page => {
      await nav(page, 'التنبيهات');
      await page.getByRole('checkbox', { name: 'تحديد ALT-1284' }).check();
      await page.getByRole('checkbox', { name: 'تحديد ALT-1283' }).check();
      assert.match(await page.locator('.bulk-toolbar').innerText(), /٢ محدد/);
      await page.getByRole('button', { name: 'مراجعة المحدد' }).click();
      let dialog = page.getByRole('dialog', { name: 'مراجعة تنبيهات محددة' });
      await dialog.getByRole('checkbox').check();
      await dialog.getByRole('button', { name: 'تأكيد مراجعة المحدد' }).click();
      assert.match(
        await page.locator('table tbody tr').filter({ hasText: 'ALT-1284' }).innerText(),
        /تمت المراجعة/,
      );
      await page.getByRole('button', { name: 'تراجع', exact: true }).click();
      assert.match(
        await page.locator('table tbody tr').filter({ hasText: 'ALT-1284' }).innerText(),
        /جديد/,
      );
      await page.getByRole('checkbox', { name: 'تحديد ALT-1284' }).check();
      await page.getByRole('button', { name: 'إسناد المحدد' }).click();
      dialog = page.getByRole('dialog', { name: 'إسناد تنبيهات محددة' });
      await dialog.getByLabel('إسناد إلى مستخدم تجريبي').selectOption({ label: 'سارة أحمد' });
      await dialog.getByRole('checkbox').check();
      await dialog.getByRole('button', { name: 'تأكيد الإسناد' }).click();
      assert.match(
        await page.locator('table tbody tr').filter({ hasText: 'ALT-1284' }).innerText(),
        /سارة أحمد/,
      );
      await page.getByRole('button', { name: 'تراجع', exact: true }).click();
      assert.match(
        await page.locator('table tbody tr').filter({ hasText: 'ALT-1284' }).innerText(),
        /غير مسند/,
      );
      await noOverflow(page, 'mobile bulk actions');
    },
  );
  await run(
    'CSV preview, chosen rows and visible columns, actual local download',
    {},
    async page => {
      await nav(page, 'التنبيهات');
      await page.getByRole('combobox', { name: 'مستوى الخطورة' }).selectOption({ label: 'حرجة' });
      await page.locator('.table-view-actions button').filter({ hasText: 'الأعمدة' }).click();
      await page
        .locator('.column-options label')
        .filter({ hasText: 'عنوان المصدر' })
        .locator('input')
        .uncheck();
      await page.getByRole('checkbox', { name: 'تحديد ALT-1283' }).check();
      await page.getByRole('button', { name: 'تصدير العينة' }).click();
      const dialog = page.getByRole('dialog', { name: 'معاينة تصدير CSV' });
      assert.match(await dialog.locator('.export-preview-head').innerText(), /٢ صف/);
      assert.equal(
        await dialog
          .locator('.export-columns label')
          .filter({ hasText: 'عنوان المصدر' })
          .locator('input')
          .isChecked(),
        false,
      );
      await dialog.getByLabel(/تحديد يدوي/).check();
      assert.match(await dialog.locator('.export-preview-head').innerText(), /١ صف/);
      assert.match(await dialog.locator('.export-preview-scroll').innerText(), /ALT-1283/);
      assert.doesNotMatch(await dialog.locator('.export-preview-scroll').innerText(), /ALT-1284/);
      const [download] = await Promise.all([
        page.waitForEvent('download'),
        dialog.getByRole('button', { name: 'تنزيل CSV' }).click(),
      ]);
      const csv = fs.readFileSync(await download.path(), 'utf8');
      assert.match(csv, /ALT-1283/);
      assert.doesNotMatch(csv, /ALT-1284|عنوان المصدر/);
    },
  );
  await run('CSV defaults match the other tables and respect unfiltered scope', {}, async page => {
    for (const [label, button, headers] of [
      [
        'الأصول',
        'تصدير',
        [
          'الأصل',
          'النوع',
          'عنوان IP',
          'عنوان MAC',
          'الواجهات',
          'الأهمية',
          'المالك',
          'خط الأساس',
          'التنبيهات',
        ],
      ],
      [
        'قواعد الكشف',
        'تصدير',
        ['القاعدة', 'المصدر', 'الخطورة', 'تقنية ATT&CK', 'آخر تحديث', 'الحالة'],
      ],
      [
        'مؤشرات التهديد',
        'تصدير',
        ['المؤشر', 'النوع', 'المصدر', 'الخطورة', 'تاريخ الإضافة', 'المطابقات'],
      ],
      [
        'سجل التدقيق',
        'تصدير السجل',
        [
          'الوقت',
          'العملية',
          'المنفّذ',
          'الكيان المتأثر',
          'عنوان المصدر',
          'النتيجة',
          'بصمة توضيحية غير متحققة',
        ],
      ],
    ]) {
      await nav(page, label);
      if (label === 'الأصول')
        await page
          .getByPlaceholder('بحث باسم الأصل أو عنوان IP أو MAC أو المالك')
          .fill('AD-SRV-01');
      await page.getByRole('button', { name: button, exact: true }).click();
      const dialog = page.getByRole('dialog', { name: 'معاينة تصدير CSV' });
      const selected = await dialog
        .locator('.export-columns label:has(input:checked) span')
        .allTextContents();
      assert.deepEqual(selected, headers, label);
      if (label === 'الأصول') {
        assert.match(await dialog.locator('.export-preview-head').innerText(), /١ صف/);
        await dialog.getByLabel(/كل سجلات العينة/).check();
        assert.doesNotMatch(await dialog.locator('.export-preview-head').innerText(), /١ صف/);
      }
      await dialog.getByRole('button', { name: 'إغلاق' }).click();
    }
  });
  await run('CSV prefixes that resemble spreadsheet formulas', {}, async page => {
    await nav(page, 'الأصول');
    await page.getByRole('button', { name: 'إضافة أصل' }).click();
    let dialog = page.getByRole('dialog', { name: 'إضافة أصل' });
    await dialog.getByLabel('اسم الأصل').fill('=1+2');
    await dialog.getByLabel('عنوان IP').fill('192.0.2.1');
    await dialog.getByLabel('المالك').fill('فريق تجريبي');
    await dialog.getByRole('button', { name: 'إضافة الأصل' }).click();
    await page.getByRole('button', { name: 'تصدير', exact: true }).click();
    dialog = page.getByRole('dialog', { name: 'معاينة تصدير CSV' });
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      dialog.getByRole('button', { name: 'تنزيل CSV' }).click(),
    ]);
    const csv = fs.readFileSync(await download.path(), 'utf8');
    assert.match(csv, /"'=1\+2 · AST-DEMO-/);
  });
  await run(
    'notification filtering, approval link, Escape and outside click',
    { width: 320 },
    async page => {
      const trigger = page.getByRole('button', { name: 'الإشعارات التجريبية' });
      assert.equal(await trigger.getAttribute('aria-describedby'), 'notification-unread-count');
      await trigger.click();
      let center = page.getByRole('region', { name: 'مركز الإشعارات التجريبي' });
      assert.equal(await center.locator('.notification-entry').count(), 3);
      await center.getByRole('button', { name: 'غير المقروء', exact: true }).click();
      assert.equal(await center.locator('.notification-entry').count(), 2);
      await center.getByRole('button', { name: 'تحديد كمقروء: حادثة جديدة تحتاج إسنادًا' }).click();
      assert.equal(await center.locator('.notification-entry').count(), 1);
      await page.waitForFunction(() =>
        document.activeElement?.classList.contains('notification-mark'),
      );
      await page.keyboard.press('Escape');
      assert.equal(await trigger.getAttribute('aria-expanded'), 'false');
      await page.waitForFunction(
        () => document.activeElement === document.querySelector('.notification-button'),
      );
      await trigger.click();
      center = page.getByRole('region', { name: 'مركز الإشعارات التجريبي' });
      await center
        .locator('.notification-open')
        .filter({ hasText: 'طلب احتواء بانتظار المراجعة' })
        .click();
      const dialog = page.getByRole('dialog', { name: 'مراجعة طلب الاحتواء' });
      assert.match(await dialog.innerText(), /INC-2026-083/);
      await dialog.getByRole('button', { name: 'إغلاق' }).click();
      await page.waitForFunction(
        () => document.activeElement === document.querySelector('.notification-button'),
      );
      await trigger.click();
      center = page.getByRole('region', { name: 'مركز الإشعارات التجريبي' });
      assert.match(await center.innerText(), /لا توجد إشعارات/);
      await page.locator('.breadcrumbs').click();
      assert.equal(await trigger.getAttribute('aria-expanded'), 'false');
      await noOverflow(page, 'notification center mobile');
    },
  );
  await run(
    'offline simulation uses read-only notice links and blocks edits',
    { theme: 'light' },
    async page => {
      await nav(page, 'الإعدادات');
      await page.getByRole('switch', { name: 'محاكاة انقطاع الاتصال' }).click();
      assert.match(await page.locator('.offline-banner').innerText(), /للقراءة فقط/);
      await page.getByRole('button', { name: 'الإشعارات التجريبية' }).click();
      await page
        .locator('.notification-open')
        .filter({ hasText: 'طلب احتواء بانتظار المراجعة' })
        .click();
      const drawer = activeDrawer(page);
      assert.match(await drawer.innerText(), /INC-2026-083/);
      assert.equal(await page.getByRole('dialog', { name: 'مراجعة طلب الاحتواء' }).count(), 0);
      await drawer.getByRole('button', { name: 'إغلاق' }).click();
      await nav(page, 'مصادر البيانات');
      await page.getByRole('button', { name: 'إضافة مصدر' }).click();
      assert.equal(await page.getByRole('dialog', { name: 'إضافة مصدر بيانات' }).count(), 0);
      assert.match(await page.locator('.toast').innerText(), /للقراءة فقط/);
      await page.getByRole('button', { name: 'إنهاء المحاكاة' }).click();
      await page.getByRole('button', { name: 'إضافة مصدر' }).click();
      await page.getByRole('dialog', { name: 'إضافة مصدر بيانات' }).waitFor();
    },
  );
  await run(
    'optional guided tour progress, skip, restore and metric provenance',
    { width: 320, theme: 'light' },
    async page => {
      const progress = page.locator('.start-guide .guide-progress');
      assert.equal(await progress.getAttribute('aria-valuenow'), '0');
      await page.getByRole('button', { name: 'ابدأ الجولة' }).click();
      let tour = page.locator('.tour-dialog');
      assert.equal(await page.locator('.tour-layer').getAttribute('data-guide-step'), 'welcome');
      await tour.getByRole('button', { name: 'التالي' }).click();
      await tour.getByRole('button', { name: 'التالي' }).click();
      assert.equal(await progress.getAttribute('aria-valuenow'), '3');
      await tour.getByRole('button', { name: 'تخطي الجولة' }).click();
      assert.equal(await page.locator('.start-guide').count(), 0);
      await page.reload();
      await login(page);
      assert.equal(await page.locator('.start-guide').count(), 0);
      await page.getByRole('button', { name: 'دليل البدء' }).click();
      tour = page.locator('.tour-dialog');
      assert.equal(await page.locator('.tour-layer').getAttribute('data-guide-step'), 'search');
      await tour.getByRole('button', { name: 'إيقاف الجولة مؤقتًا' }).click();
      assert.equal(await progress.getAttribute('aria-valuenow'), '3');
      await page.getByRole('button', { name: 'ابدأ من جديد' }).click();
      assert.equal(await page.locator('.tour-layer').getAttribute('data-guide-step'), 'welcome');
      await page
        .locator('.tour-dialog')
        .getByRole('button', { name: 'إيقاف الجولة مؤقتًا' })
        .click();
      assert.equal(await progress.getAttribute('aria-valuenow'), '1');
      await page.getByRole('combobox', { name: 'الفترة الزمنية' }).selectOption('7d');
      await page.locator('.metric-definitions summary').first().click();
      assert.match(
        await page.locator('.metric-definitions details').first().innerText(),
        /آخر ٧ أيام/,
      );
      assert.match(
        await page.locator('.metric-definitions details').first().innerText(),
        /عينة أصغر/,
      );
      await noOverflow(page, 'guide and metric provenance');
    },
  );
  // Emulates the in-app preview: sandboxed iframe permits scripts but not forms/downloads.
  const html = fs.readFileSync('dist/index.html');
  const server = http.createServer((req, res) => {
    if (req.url === '/demo') {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      res.end(html);
    } else {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      res.end(
        '<!doctype html><html><body style="margin:0"><iframe title="preview" sandbox="allow-scripts" src="/demo" style="width:100%;height:100vh;border:0"></iframe></body></html>',
      );
    }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const context = await browser.newContext({
      viewport: { width: 1280, height: 900 },
      reducedMotion: 'reduce',
    }),
    errors = [],
    external = [];
  try {
    const page = await context.newPage();
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => {
      if (m.type() === 'error') errors.push(m.text());
    });
    await context.route('**/*', route => {
      if (!route.request().url().startsWith(origin)) {
        external.push(route.request().url());
        return route.abort();
      }
      return route.continue();
    });
    await page.goto(origin);
    const frame = page.frameLocator('iframe');
    await frame.getByText('استخدام بيانات تجريبية', { exact: true }).click();
    await frame.getByLabel('كلمة المرور', { exact: true }).press('Enter');
    await frame.getByText('ملء الرمز', { exact: true }).click();
    await frame.getByLabel(/رمز التحقق التجريبي،/).press('Enter');
    await frame.getByRole('button', { name: 'NEXORA الصفحة الرئيسية' }).focus();
    await page.keyboard.press('Alt+k');
    const searchDialog = frame.getByRole('dialog', { name: 'البحث في المنصة' });
    await searchDialog.waitFor();
    const searchField = searchDialog.getByLabel(
      'ابحث عن حادثة، تنبيه، أصل، مصدر بيانات أو عنوان IP أو MAC',
    );
    await searchField.waitFor();
    await page
      .frame({ url: `${origin}/demo` })
      .waitForFunction(
        () => document.activeElement?.getAttribute('data-dialog-autofocus') === 'true',
      );
    await page.keyboard.type('ALT-1284');
    assert.match(await searchDialog.locator('.search-results').innerText(), /ALT-1284/);
    await page.keyboard.press('Escape');
    await searchDialog.waitFor({ state: 'detached' });
    await frame.locator('#primary-navigation').getByText('مصادر البيانات', { exact: true }).click();
    await frame.getByRole('button', { name: 'إضافة مصدر' }).click();
    let dialog = frame.getByRole('dialog', { name: 'إضافة مصدر بيانات' });
    await dialog.getByPlaceholder('مثال: مستشعر المقر الرئيسي').fill('مصدر معاينة');
    await dialog.getByPlaceholder('مثال: مستشعر المقر الرئيسي').press('Enter');
    await dialog.getByRole('button', { name: 'التالي' }).click();
    await dialog.getByRole('button', { name: 'إضافة إلى العينة' }).click();
    assert.match(await frame.locator('.source-grid').innerText(), /مصدر معاينة/);
    await frame.locator('#primary-navigation').getByText('التنبيهات', { exact: true }).click();
    await frame.getByRole('button', { name: 'تصدير العينة' }).click();
    dialog = frame.getByRole('dialog', { name: 'معاينة تصدير CSV' });
    assert.match(await dialog.innerText(), /قد يمنع عارض الملفات المعزول التنزيل/);
    assert.deepEqual(errors, []);
    assert.deepEqual(external, []);
    console.log(
      'PASS sandboxed iframe · search shortcut, Enter and forms · CSV limitation disclosure',
    );
  } finally {
    await context.close();
    await new Promise(resolve => server.close(resolve));
  }
} finally {
  await browser.close();
}
console.log(
  'PASS local demo flows. No backend, real authentication, notification delivery, approval or containment was tested.',
);
