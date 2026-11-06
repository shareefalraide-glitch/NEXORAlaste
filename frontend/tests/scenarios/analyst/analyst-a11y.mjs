// Limited automated accessibility checks for new UI; not a human audit or WCAG certification.
import AxeBuilder from '@axe-core/playwright';
import { assert, launch, newPage, login, nav, noOverflow, clean } from '../../support/helpers.mjs';
const tags = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'];
const drawer = page => page.locator('.detail-layer-active .drawer');
const browser = await launch();
try {
  for (const [width, theme] of [
    [1440, 'dark'],
    [320, 'light'],
  ]) {
    const run = await newPage(browser, { width, height: 860, theme }),
      { page } = run;
    let count = 0;
    const incomplete = new Map();
    async function scan(label) {
      const result = await new AxeBuilder({ page }).withTags(tags).analyze();
      count++;
      for (const rule of result.incomplete) {
        const entry = incomplete.get(rule.id) || { states: 0, nodes: 0 };
        entry.states++;
        entry.nodes += rule.nodes.length;
        incomplete.set(rule.id, entry);
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
      await nav(page, 'التنبيهات');
      await page.locator('table tbody tr').filter({ hasText: 'ALT-1284' }).click();
      let d = drawer(page);
      await d.locator('.triage-assistant summary').click();
      await scan('triage form');
      await d.getByLabel('قرار مراجعة التنبيه', { exact: true }).selectOption('unknown');
      await d.getByLabel('أولوية مراجعة التنبيه', { exact: true }).selectOption('p2');
      await d.getByLabel('سبب قرار مراجعة التنبيه').fill('لا تكفي المعطيات للجزم.');
      await d.getByRole('button', { name: 'معاينة القرار' }).click();
      await scan('triage preview');
      await d.getByRole('button', { name: 'إغلاق' }).click();
      await nav(page, 'الحوادث');
      await page.locator('table tbody tr').filter({ hasText: 'INC-2026-084' }).click();
      d = drawer(page);
      await d.getByRole('button', { name: 'بدء تحقيق موجّه' }).click();
      let guide = d.getByRole('region', { name: 'التحقيق الموجّه للحادثة' });
      await scan('guided investigation');
      await guide.getByRole('button', { name: 'التالي', exact: true }).click();
      await guide.getByRole('button', { name: 'فتح مستكشف التحقيق' }).click();
      await scan('interactive graph');
      await d.getByRole('button', { name: 'المهام والملاحظات' }).click();
      await d.getByLabel('نوع الملاحظة').selectOption('question');
      await d.getByLabel('ملاحظة جديدة للحادثة').fill('هل يوجد حدث نجاح في السجل؟');
      await d.getByRole('button', { name: 'إضافة ملاحظة' }).click();
      await scan('notebook');
      await d.getByRole('button', { name: 'الخط الزمني', exact: true }).click();
      await d.getByRole('button', { name: 'قصة التحقيق' }).click();
      await scan('storyboard');
      await d.getByRole('button', { name: 'إغلاق' }).click();
      await nav(page, 'تحليل الشبكة');
      await scan('network heatmap');
      await page
        .locator('.network-protocols-panel .network-distribution-group')
        .first()
        .getByRole('button', { name: /TCP/ })
        .click();
      await scan('protocol details');
      clean(run);
      console.log(
        `PASS analyst axe ${theme}/${width} · ${count} states · incomplete for human review: ${JSON.stringify(Object.fromEntries(incomplete))}`,
      );
    } finally {
      await run.context.close();
    }
  }
} finally {
  await browser.close();
}
console.log(
  'PASS limited automated checks only; unresolved items need human review, no WCAG certification.',
);
