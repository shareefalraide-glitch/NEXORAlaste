// Automated checks of expanded integrated features, not a WCAG certification.
// Incomplete axe results and human/screen-reader reviews remain necessary.
import AxeBuilder from '@axe-core/playwright';
import { assert, launch, newPage, login, nav, clean, noOverflow } from '../../support/helpers.mjs';

const browser = await launch();
const tags = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'];
const drawer = page => page.locator('.detail-layer-active .drawer');
const expand = (page, selector) => page.locator(selector).first().click();
try {
  for (const [width, theme] of [
    [1440, 'dark'],
    [320, 'light'],
    [1440, 'light'],
    [320, 'dark'],
  ]) {
    const run = await newPage(browser, { width, height: 900, theme });
    const { page } = run;
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
        `axe integrated ${theme}/${width}/${state}: ${JSON.stringify(violations)}`,
      );
      await noOverflow(page, `axe integrated ${theme}/${width}/${state}`);
    };
    try {
      await login(page);
      await expand(page, '.global-time-help>summary');
      await expand(page, '.dashboard-customize>summary');
      await scan('global range and overview customize');
      await expand(page, '.global-time-help>summary');
      await nav(page, 'مستكشف الأحداث');
      await expand(page, '.hunt-workspace>summary');
      await scan('hunt expanded');
      await page.locator('.hunt-results button').first().click();
      await drawer(page)
        .getByRole('button', { name: /استكشاف عنوان IP/ })
        .first()
        .click();
      await scan('entity context');
      await drawer(page).getByRole('button', { name: 'إغلاق' }).click();
      await nav(page, 'الحوادث');
      await expand(page, '.experience-module>summary');
      await scan('handover');
      await page.locator('.data-panel tbody tr').filter({ hasText: 'INC-2026-084' }).click();
      for (const label of ['الخط الزمني', 'مراجع الأدلة', 'قوالب الاستجابة']) {
        await drawer(page).getByRole('button', { name: label, exact: true }).click();
        await scan(`incident ${label}`);
      }
      await drawer(page).getByRole('button', { name: 'إغلاق' }).click();
      await nav(page, 'خريطة العلاقات');
      await scan('attack path');
      await nav(page, 'تحليل الشبكة');
      for (let i = 0; i < 3; i++) await expand(page, `.network-extra:nth-child(${i + 1})>summary`);
      await scan('network comparison replay topology');
      await nav(page, 'الأصول');
      await expand(page, '.experience-module>summary');
      await scan('attack surface');
      await nav(page, 'مصادر البيانات');
      await expand(page, '.experience-module>summary');
      await scan('sensor health');
      await nav(page, 'نموذج الشذوذ');
      await expand(page, '.experience-module>summary');
      await scan('behavioral baseline');
      await nav(page, 'تغطية MITRE');
      await page.locator('.mitre-cell').filter({ hasText: 'T1078' }).click();
      await scan('technique detail');
      let dialog = page.getByRole('dialog', { name: 'تفاصيل التقنية' });
      await dialog.getByRole('button', { name: /RULE-005/ }).click();
      await drawer(page).getByRole('button', { name: 'اختبار على عينة' }).click();
      dialog = page.getByRole('dialog', { name: 'اختبار قاعدة كشف' });
      await dialog.getByRole('button', { name: 'تشغيل المعاينة' }).click();
      await scan('rule simulation');
      await dialog.getByRole('button', { name: 'إغلاق' }).click();
      await drawer(page).getByRole('button', { name: 'إغلاق' }).click();
      await nav(page, 'المستخدمون والأدوار');
      await page.getByRole('button', { name: 'الأدوار والصلاحيات' }).click();
      await expand(page, '.role-compare>summary');
      await scan('role comparison');
      await nav(page, 'التقارير');
      await expand(page, '.report-designer>summary');
      await scan('report designer');
      await nav(page, 'الإعدادات');
      await page.getByRole('button', { name: /الكشف والربط/ }).click();
      await expand(page, '.what-if>summary');
      await scan('what-if');
      await page.getByRole('button', { name: 'المساعد التجريبي' }).click();
      await scan('copilot');
      await page
        .getByRole('dialog', { name: 'المساعد التجريبي' })
        .getByRole('button', { name: 'إغلاق' })
        .click();
      await page.getByRole('button', { name: 'الإشعارات التجريبية' }).click();
      await page.getByRole('button', { name: 'ترتيب حسب خطورة السجل' }).click();
      await scan('prioritized notifications');
      clean(run);
      console.log(
        `PASS expanded integrated axe · ${theme}/${width} · ${scans} states · ${incomplete} incomplete rule results for review`,
      );
    } finally {
      await run.context.close();
    }
  }
} finally {
  await browser.close();
}
console.log('PASS automated axe scans only; no human accessibility audit or compliance claim.');
