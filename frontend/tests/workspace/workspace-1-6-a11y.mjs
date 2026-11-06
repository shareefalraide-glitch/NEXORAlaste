// Limited automated spot checks; incomplete findings remain for a human review.
import AxeBuilder from '@axe-core/playwright';
import { assert, launch, newPage, login, nav, noOverflow, clean } from '../support/helpers.mjs';
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
        const old = incomplete.get(rule.id) || { states: 0, nodes: 0 };
        old.states++;
        old.nodes += rule.nodes.length;
        incomplete.set(rule.id, old);
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
      const bar = drawer(page).getByRole('region', { name: 'تحقيقات الجلسة المفتوحة' });
      await bar.locator('.investigation-tab-add summary').click();
      await bar.getByLabel('اختيار حادثة لفتح تحقيق آخر').selectOption('INC-2026-083');
      await bar.getByRole('button', { name: 'فتح التحقيق' }).click();
      await drawer(page).getByRole('button', { name: 'عرض تحقيقين' }).click();
      const split = page.getByRole('dialog', { name: 'عرض تحقيقين' });
      await scan('split investigations');
      for (let i = 0; i < 9; i++) {
        await page.keyboard.press('Tab');
        assert.equal(
          await page.evaluate(() =>
            document.activeElement?.closest('[role="dialog"]')?.getAttribute('aria-label'),
          ),
          'عرض تحقيقين',
          'focus remains inside split dialog',
        );
      }
      const first = split.getByRole('region', { name: 'لوحة تحقيق INC-2026-083' });
      await first.getByRole('button', { name: 'المهام والملاحظات' }).click();
      const book = first.getByRole('region', { name: 'قائمة مهام وملاحظات الحادثة' });
      await book.getByLabel('ملاحظة جديدة للحادثة').fill('# عنوان\n- بند');
      await book.getByRole('button', { name: 'إضافة ملاحظة' }).click();
      await book.locator('.notebook-export > summary').click();
      await scan('notebook preview');
      await split.getByRole('button', { name: 'إغلاق', exact: true }).click();
      await drawer(page).getByRole('button', { name: 'إغلاق', exact: true }).click();
      await nav(page, 'التنبيهات');
      await page.getByLabel('تحديد ALT-1284').check();
      await page.getByLabel('تحديد ALT-1283').check();
      await page.getByRole('button', { name: 'فرز مستقل للمحدد' }).click();
      const batch = page.getByRole('dialog', { name: 'مراجعة مستقلة للتنبيهات' });
      await scan('independent triage editor');
      await batch.getByLabel('قرار التنبيه ALT-1284').selectOption('unknown');
      await batch.getByLabel('أولوية التنبيه ALT-1284').selectOption('p1');
      await batch.getByLabel('سبب التنبيه ALT-1284').fill('سبب أول');
      await batch
        .getByRole('group', { name: 'قائمة التنبيهات المختارة' })
        .getByRole('button', { name: /ALT-1283/ })
        .click();
      await batch.getByLabel('قرار التنبيه ALT-1283').selectOption('followup');
      await batch.getByLabel('أولوية التنبيه ALT-1283').selectOption('p2');
      await batch.getByLabel('سبب التنبيه ALT-1283').fill('سبب ثانٍ');
      await batch.getByRole('button', { name: 'معاينة القرارات المستقلة' }).click();
      await scan('independent decisions preview');
      await batch.getByRole('button', { name: 'إغلاق', exact: true }).first().click();
      await nav(page, 'خريطة العلاقات');
      await page.getByRole('button', { name: 'مستكشف التحقيق', exact: true }).click();
      const graph = page.getByRole('region', { name: 'مستكشف التحقيق التفاعلي' });
      await graph.getByRole('button', { name: 'فحص العلاقة', exact: true }).first().click();
      await scan('relationship inspector');
      await nav(page, 'تحليل الشبكة');
      const heat = page.getByRole('region', { name: 'خريطة محاولات الشبكة الحرارية' });
      if (width > 760) await heat.locator('.heatmap-cell[aria-label^="AD-SRV-01،"]').last().click();
      else {
        await heat.getByLabel('أصل الخريطة الحرارية').selectOption('AST-001');
        await heat.locator('.heatmap-mobile-cells button').last().click();
      }
      await heat.locator('.network-context details summary').first().click();
      await scan('network context');
      clean(run);
      console.log(
        `PASS 1.6 keyboard/axe ${theme}/${width} · ${count} sampled states · incomplete for human review: ${JSON.stringify(Object.fromEntries(incomplete))}`,
      );
    } finally {
      await run.context.close();
    }
  }
} finally {
  await browser.close();
}
console.log(
  'PASS limited automated checks; no human usability/a11y review or WCAG certification claimed.',
);
