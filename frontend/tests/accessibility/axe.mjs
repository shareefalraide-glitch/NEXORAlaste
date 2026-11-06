// axe-core automated checks are useful but cannot establish WCAG conformance.
import AxeBuilder from '@axe-core/playwright';
import { assert, launch, newPage, login, nav, clean } from '../support/helpers.mjs';
const pages = [
  'نظرة عامة',
  'التنبيهات',
  'الحوادث',
  'مستكشف الأحداث',
  'تحليل الشبكة',
  'الأصول',
  'خريطة العلاقات',
  'قواعد الكشف',
  'نموذج الشذوذ',
  'مؤشرات التهديد',
  'تغطية MITRE',
  'مصادر البيانات',
  'التقارير',
  'سجل التدقيق',
  'المستخدمون والأدوار',
  'الإعدادات',
];
const tags = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'];
const browser = await launch();
try {
  for (const theme of ['dark', 'light'])
    for (const width of [1440, 320]) {
      const run = await newPage(browser, { theme, width }),
        { page } = run;
      let scans = 0,
        incomplete = 0;
      const scan = async state => {
        const result = await new AxeBuilder({ page }).withTags(tags).analyze();
        scans++;
        incomplete += result.incomplete.length;
        const violations = result.violations.map(v => ({
          id: v.id,
          impact: v.impact,
          targets: v.nodes.map(n => n.target),
        }));
        assert.deepEqual(
          violations,
          [],
          `axe ${theme}/${width}/${state}: ${JSON.stringify(violations)}`,
        );
      };
      try {
        await scan('login');
        await login(page);
        for (const label of pages) {
          await nav(page, label);
          await scan(label);
        }
        await page.getByRole('button', { name: /اختصارات لوحة المفاتيح/ }).click();
        await scan('shortcut settings');
        await page.getByRole('button', { name: /تخصيص الواجهة/ }).click();
        await scan('layout settings');
        await nav(page, 'نظرة عامة');
        await page.getByRole('button', { name: 'البحث في المنصة' }).click();
        await scan('search dialog');
        await page.keyboard.press('Escape');
        await nav(page, 'التنبيهات');
        await page.getByLabel('تجميع التنبيهات').selectOption('asset');
        await scan('grouped alerts');
        await nav(page, 'الحوادث');
        await page.locator('table tbody tr').filter({ hasText: 'INC-2026-084' }).click();
        await page
          .locator('.detail-layer-active .drawer')
          .getByRole('button', { name: 'المهام والملاحظات' })
          .click();
        await scan('incident workspace');
        await page
          .locator('.detail-layer-active .drawer')
          .getByRole('button', { name: 'إغلاق' })
          .click();
        await page.getByRole('button', { name: 'الإشعارات التجريبية' }).click();
        await scan('notifications');
        await page.keyboard.press('Escape');
        await nav(page, 'خريطة العلاقات');
        await page.getByRole('button', { name: 'مصدر مستشعر حدود الشبكة SRC-002' }).click();
        await scan('selected relationship node');
        await nav(page, 'الأصول');
        await page.locator('table tbody tr').filter({ hasText: 'AST-001' }).click();
        const assetPanel = page.locator('.detail-layer-active .drawer');
        await assetPanel.getByRole('button', { name: /واجهات الشبكة/ }).click();
        await scan('asset interface list');
        await assetPanel.getByRole('button', { name: 'إضافة واجهة' }).click();
        let modal = page.getByRole('dialog', { name: 'إضافة واجهة شبكة' });
        await modal.getByLabel('اسم واجهة الشبكة').fill('eth2');
        await modal.getByLabel('عنوان IP للواجهة').fill('bad');
        await modal.getByRole('button', { name: 'إضافة الواجهة' }).click();
        await scan('interface validation');
        await modal.getByRole('button', { name: 'إغلاق' }).click();
        await page
          .getByRole('dialog', { name: 'تغييرات غير محفوظة' })
          .getByRole('button', { name: 'تجاهل التغييرات' })
          .click();
        await assetPanel.getByRole('button', { name: 'إغلاق' }).click();
        await page.getByRole('button', { name: 'استيراد CSV' }).click();
        modal = page.getByRole('dialog', { name: 'استيراد أصول CSV' });
        await modal.getByRole('button', { name: 'استخدام مثال تجريبي' }).click();
        await modal.getByRole('button', { name: 'معاينة والتحقق' }).click();
        await scan('CSV import preview');
        await page.keyboard.press('Escape');
        await scan('CSV unsaved confirmation');
        await page
          .getByRole('dialog', { name: 'تغييرات غير محفوظة' })
          .getByRole('button', { name: 'تجاهل التغييرات' })
          .click();

        clean(run);
        console.log(
          `PASS axe-core · ${theme} · ${width}px · ${scans} selected states (incomplete rule results requiring manual review: ${incomplete})`,
        );
      } finally {
        await run.context.close();
      }
    }
} finally {
  await browser.close();
}
console.log(
  'PASS automated axe tags only; incomplete results and untested interactions require manual review. Not WCAG certification.',
);
