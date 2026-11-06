// Automated spot checks only, not a human accessibility audit or certification.
import AxeBuilder from '@axe-core/playwright';
import { assert, launch, newPage, login, nav, noOverflow, clean } from '../support/helpers.mjs';
const tags = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'];
const d = page => page.locator('.detail-layer-active .drawer');
const browser = await launch();
try {
  for (const [width, theme] of [
    [1440, 'dark'],
    [320, 'light'],
  ]) {
    const run = await newPage(browser, { width, height: 760, theme }),
      { page } = run;
    let scans = 0;
    const incomplete = new Map();
    async function scan(label) {
      const result = await new AxeBuilder({ page }).withTags(tags).analyze();
      scans++;
      for (const rule of result.incomplete) {
        const x = incomplete.get(rule.id) || { states: 0, nodes: 0 };
        x.states++;
        x.nodes += rule.nodes.length;
        incomplete.set(rule.id, x);
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
      await nav(page, 'الحوادث');
      await page.locator('table tbody tr').filter({ hasText: 'INC-2026-084' }).click();
      let bar = d(page).getByRole('region', { name: 'تحقيقات الجلسة المفتوحة' });
      await scan('case tabs');
      await bar.locator('summary').click();
      await scan('open case selector');
      await bar.getByLabel('اختيار حادثة لفتح تحقيق آخر').selectOption('INC-2026-083');
      await bar.getByRole('button', { name: 'فتح التحقيق' }).click();
      bar = d(page).getByRole('region', { name: 'تحقيقات الجلسة المفتوحة' });
      await bar.getByRole('button', { name: 'استعادة تحقيق INC-2026-084' }).click();
      await d(page).getByRole('button', { name: 'المهام والملاحظات' }).click();
      let book = d(page).getByRole('region', { name: 'قائمة مهام وملاحظات الحادثة' });
      await book.getByLabel('ربط الملاحظة بسجل').selectOption('event|EVT-90481');
      await book.getByRole('button', { name: 'إضافة رابط آخر' }).click();
      await book.getByLabel('ملاحظة جديدة للحادثة').fill('فرضية تجريبية قابلة للبحث');
      await book.getByRole('button', { name: 'إضافة ملاحظة' }).click();
      await book.getByLabel('البحث في ملاحظات الحادثة').fill('فرضية');
      await scan('searchable notebook');
      await d(page).getByRole('button', { name: 'نظرة عامة', exact: true }).click();
      await d(page).getByRole('button', { name: 'مستكشف التحقيق', exact: true }).click();
      const graph = d(page).getByRole('region', { name: 'مستكشف التحقيق التفاعلي' });
      await graph.getByLabel('البحث في عقد التحقيق').fill('EVT');
      await graph.locator('.graph-manage summary').click();
      await scan('graph search and multi-select');
      const checkbox = graph.locator('.graph-manage-list input:not(:disabled)').first();
      await checkbox.focus();
      await page.keyboard.press('Space');
      assert.equal(await checkbox.isChecked(), true);
      await graph.getByRole('button', { name: /إخفاء المحدد/ }).click();
      await page.waitForFunction(() =>
        document.activeElement?.matches('.detail-layer-active .graph-manage summary'),
      );
      await scan('graph after hiding selection');
      bar = d(page).getByRole('region', { name: 'تحقيقات الجلسة المفتوحة' });
      await bar.getByRole('button', { name: 'تثبيت تحقيق INC-2026-084' }).click();
      const remove = bar.getByRole('button', { name: 'إزالة تبويب تحقيق INC-2026-084' });
      await remove.click();
      const modal = page.getByRole('dialog', { name: 'إزالة تحقيق مثبّت؟' });
      await page.waitForFunction(
        () =>
          document.activeElement?.closest('[role="dialog"]')?.getAttribute('aria-label') ===
          'إزالة تحقيق مثبّت؟',
      );
      await scan('pinned tab confirmation');
      for (let n = 0; n < 6; n++) {
        await page.keyboard.press('Tab');
        assert.equal(
          await page.evaluate(() =>
            document.activeElement?.closest('[role="dialog"]')?.getAttribute('aria-label'),
          ),
          'إزالة تحقيق مثبّت؟',
          'focus stays in top dialog',
        );
      }
      await page.keyboard.press('Escape');
      assert.equal(await modal.count(), 0);
      assert.equal(await d(page).isVisible(), true, 'Escape closed only the top confirmation');
      await page.waitForFunction(
        () =>
          document.activeElement?.getAttribute('aria-label') === 'إزالة تبويب تحقيق INC-2026-084',
      );
      await d(page).getByRole('button', { name: 'إغلاق', exact: true }).click();
      await scan('restore shelf');
      clean(run);
      console.log(
        `PASS 1.5 keyboard/axe ${theme}/${width} · ${scans} states · unresolved for human review: ${JSON.stringify(Object.fromEntries(incomplete))}`,
      );
    } finally {
      await run.context.close();
    }
  }
} finally {
  await browser.close();
}
console.log('PASS limited automated checks; no human review or WCAG conformance claimed.');
