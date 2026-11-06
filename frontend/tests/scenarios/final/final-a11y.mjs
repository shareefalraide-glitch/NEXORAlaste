// Targeted automated checks of new states, not a human review or WCAG claim.
// Axe 'incomplete' outcomes require manual review and are counted separately.
import AxeBuilder from '@axe-core/playwright';
import { assert, launch, newPage, login, nav, clean, noOverflow } from '../../support/helpers.mjs';

const tags = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'];
const drawer = page => page.locator('.detail-layer-active .drawer');
const browser = await launch();
try {
  for (const [width, theme] of [
    [1440, 'dark'],
    [320, 'light'],
    [1440, 'light'],
    [320, 'dark'],
  ]) {
    const run = await newPage(browser, { width, height: 900, theme }),
      { page } = run;
    let count = 0,
      incomplete = 0,
      review = new Map();
    const scan = async label => {
      const result = await new AxeBuilder({ page }).withTags(tags).analyze();
      count++;
      incomplete += result.incomplete.length;
      for (const rule of result.incomplete) {
        const current = review.get(rule.id) || { states: 0, nodes: 0, examples: [] };
        current.states++;
        current.nodes += rule.nodes.length;
        for (const node of rule.nodes) {
          const target = node.target.join(' > ');
          if (current.examples.length < 3 && !current.examples.includes(target))
            current.examples.push(target);
        }
        review.set(rule.id, current);
      }
      const unsupportedLabels = result.incomplete
        .filter(v => v.id === 'aria-prohibited-attr')
        .flatMap(v => v.nodes.map(n => n.target));
      assert.deepEqual(
        unsupportedLabels,
        [],
        `${theme}/${width}/${label}: unsupported ARIA labels ${JSON.stringify(unsupportedLabels)}`,
      );
      const violations = result.violations.map(v => ({
        id: v.id,
        impact: v.impact,
        targets: v.nodes.map(n => n.target),
      }));
      assert.deepEqual(violations, [], `${theme}/${width}/${label} ${JSON.stringify(violations)}`);
      await noOverflow(page, `${theme}/${width}/${label}`);
    };
    try {
      await login(page);
      await page.locator('.global-session-help>summary').click();
      await page.locator('.global-time-help>summary').click();
      await scan('global scope help');
      await page.locator('.global-session-help>summary').click();
      await page.locator('.global-time-help>summary').click();
      await page.getByRole('button', { name: 'استكشف رحلة التحقيق' }).click();
      let d = drawer(page);
      await d.getByRole('button', { name: 'المتابعة وSLA' }).click();
      await scan('SLA and escalation');
      await d.getByRole('button', { name: 'مراجع الأدلة', exact: true }).click();
      await d.getByLabel('عنوان المرجع التجريبي').fill('مرجع للتحقق الآلي');
      await d.getByRole('button', { name: 'إضافة مرجع' }).click();
      await d.locator('.evidence-record summary').click();
      await scan('evidence and custody details');
      await d.getByRole('button', { name: 'قوالب الاستجابة', exact: true }).click();
      await d.locator('.workflow-designer>summary').click();
      await scan('workflow designer');
      await d.getByRole('button', { name: 'اسأل المساعد عن الحادثة' }).click();
      let a = page.getByRole('dialog', { name: 'المساعد التجريبي' });
      await a.getByLabel('سؤال للمساعد التجريبي').fill('ما السجلات؟');
      await a.getByRole('button', { name: 'عرض الرد التجريبي' }).click();
      await scan('contextual copilot answer');
      await a.getByRole('button', { name: 'إغلاق' }).click();
      await d.getByRole('button', { name: 'إغلاق' }).click();
      await nav(page, 'الحوادث');
      await page.locator('.experience-module>summary').first().click();
      await scan('shift handover');
      await nav(page, 'مستكشف الأحداث');
      await page.locator('.hunt-workspace>summary').click();
      await page.getByRole('button', { name: 'إضافة شرط' }).click();
      await scan('hunt hypothesis and conditions');
      await nav(page, 'قواعد الكشف');
      await page.locator('.rule-studio>summary').click();
      await scan('detection engineering draft');
      await nav(page, 'مصادر البيانات');
      await page.locator('.integration-hub>summary').click();
      await scan('integrations');
      await nav(page, 'الأصول');
      await page.locator('.vuln-module>summary').click();
      await scan('vulnerability examples');
      await page.locator('.vuln-module .module-record-list button').first().click();
      d = drawer(page);
      await d.getByRole('button', { name: 'الخدمة والثغرات' }).click();
      await scan('asset business context');
      await d.getByRole('button', { name: 'إغلاق' }).click();
      await nav(page, 'خريطة العلاقات');
      await scan('attack path association');
      await nav(page, 'الإعدادات');
      await page.getByRole('button', { name: /النسخ والاستعادة/ }).click();
      await scan('backup and recovery preview');
      clean(run);
      console.log(
        `PASS final axe ${theme}/${width} · ${count} states · ${incomplete} incomplete rule results for manual review · ${JSON.stringify(Object.fromEntries(review))}`,
      );
    } finally {
      await run.context.close();
    }
  }
} finally {
  await browser.close();
}
console.log(
  'PASS automated axe checks only; human testing and motion accessibility remain unresolved.',
);
