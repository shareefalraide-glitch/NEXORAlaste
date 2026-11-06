// Targeted axe checks for professional SOC additions. Incomplete is not a pass.
import AxeBuilder from '@axe-core/playwright';
import { assert, launch, newPage, login, nav, noOverflow, clean } from '../../support/helpers.mjs';
const tags = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'];
const browser = await launch(),
  drawer = page => page.locator('.detail-layer-active .drawer');
try {
  for (const [width, theme] of [
    [1440, 'dark'],
    [320, 'light'],
  ]) {
    const run = await newPage(browser, { width, height: 900, theme }),
      { page } = run;
    let count = 0;
    const incomplete = new Map();
    async function scan(label) {
      const result = await new AxeBuilder({ page }).withTags(tags).analyze();
      count++;
      for (const rule of result.incomplete) {
        const item = incomplete.get(rule.id) || { states: 0, nodes: 0 };
        item.states++;
        item.nodes += rule.nodes.length;
        incomplete.set(rule.id, item);
      }
      const violations = result.violations.map(v => ({
        id: v.id,
        impact: v.impact,
        targets: v.nodes.map(n => n.target),
      }));
      assert.deepEqual(violations, [], `${theme}/${width}/${label}: ${JSON.stringify(violations)}`);
      await noOverflow(page, `${theme}/${width}/${label}`);
    }
    try {
      await login(page);
      await page.locator('.dashboard-customize>summary').click();
      await page.locator('.dashboard-customize .named-views>summary').click();
      await scan('dashboard named layouts');
      await nav(page, 'الحوادث');
      await page.locator('.record-comparison>summary').click();
      await page
        .getByRole('button', { name: /الأعمدة/ })
        .first()
        .click();
      await page.locator('.data-panel .named-views>summary').click();
      await scan('comparison and named table views');
      await page.locator('.data-panel tbody tr').filter({ hasText: 'INC-2026-084' }).click();
      let d = drawer(page);
      await scan('case workspace');
      await d.getByRole('button', { name: 'الخط الزمني', exact: true }).click();
      await d.getByLabel('تكبير الخط الزمني').selectOption('focus');
      await scan('interactive timeline');
      await d.locator('.drawer-header h2').focus();
      await page.keyboard.press('Alt+k');
      await page.getByRole('dialog', { name: 'البحث في المنصة' }).waitFor();
      await scan('contextual command center over drawer');
      await page.keyboard.press('Escape');
      await d.getByRole('button', { name: 'إغلاق' }).click();
      await nav(page, 'قواعد الكشف');
      await page.locator('.rule-studio>summary').click();
      await page.getByRole('button', { name: 'إضافة شرط وصفي' }).click();
      await scan('draft condition builder');
      await nav(page, 'التقارير');
      await page.locator('.report-designer>summary').click();
      await page.getByRole('button', { name: 'تقديم قسم الحوادث المفصّلة' }).click();
      await scan('report order');
      await nav(page, 'خريطة العلاقات');
      await page.locator('.relationship-node').first().click();
      await page.getByLabel('إظهار العقدة المختارة وجيرانها المباشرين فقط').check();
      await scan('focused relationships');
      await page.getByRole('button', { name: 'الإشعارات التجريبية' }).click();
      let n = page.getByRole('region', { name: 'مركز الإشعارات التجريبي' });
      await n.getByLabel('تجميع الإشعارات').selectOption('incident');
      await n
        .getByRole('button', { name: /تثبيت الإشعار:/ })
        .first()
        .click();
      await scan('grouped pinned notifications');
      clean(run);
      console.log(
        `PASS professional axe ${theme}/${width} · ${count} states · incomplete for manual review: ${JSON.stringify(Object.fromEntries(incomplete))}`,
      );
    } finally {
      await run.context.close();
    }
  }
} finally {
  await browser.close();
}
console.log('PASS limited automated scans only; no human audit or WCAG certification.');
