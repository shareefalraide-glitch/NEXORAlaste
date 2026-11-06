// Focused, repeatable checks. Not a full WCAG or assistive-technology audit.
import { assert, launch, newPage, login, nav, noOverflow, clean } from '../support/helpers.mjs';

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
const pairs = [
  ['--nx-tx1', '--nx-bg2'],
  ['--nx-tx2', '--nx-bg2'],
  ['--nx-brand-ink', '--nx-bg2'],
  ['--nx-red-ink', '--nx-tint-red'],
  ['--nx-blue-ink', '--nx-tint-blue'],
  ['--nx-yellow-ink', '--nx-tint-yellow'],
];
const browser = await launch();
try {
  for (const theme of ['dark', 'light'])
    for (const width of [1440, 320]) {
      const run = await newPage(browser, { theme, width }),
        { page } = run;
      try {
        assert.equal(await page.locator('html').getAttribute('dir'), 'rtl');
        const ratios = await page.evaluate(pairs => {
          const styles = getComputedStyle(document.documentElement);
          function luminance(token) {
            let hex = styles.getPropertyValue(token).trim();
            if (/^#[0-9a-f]{3}$/i.test(hex)) hex = '#' + [...hex.slice(1)].map(x => x + x).join('');
            if (!/^#[0-9a-f]{6}$/i.test(hex))
              throw Error('Expected a hex color token: ' + token + ' ' + hex);
            const c = [1, 3, 5]
              .map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
              .map(x => (x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4));
            return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
          }
          return pairs.map(([a, b]) => {
            const x = luminance(a),
              y = luminance(b);
            return { a, b, ratio: (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05) };
          });
        }, pairs);
        for (const item of ratios)
          assert.ok(item.ratio >= 4.5, `${theme} ${item.a} on ${item.b}: ${item.ratio}`);
        await login(page);
        for (const label of pages) {
          await nav(page, label);
          await noOverflow(page, `${theme}/${width}/${label}`);
          assert.equal(
            await page.locator('#primary-navigation button[aria-current="page"]').count(),
            1,
          );
          // Checks names for visible native buttons and icon-only controls; dynamic states need manual review too.
          const unnamed = await page.evaluate(() =>
            Array.from(document.querySelectorAll('button'))
              .filter(el => {
                // Closed <details> descendants may retain layout boxes while innerText is
                // empty. Exclude only children hidden by a closed ancestor; controls in
                // expanded modules are independently scanned by integrated-a11y.mjs.
                for (let p = el.parentElement; p; p = p.parentElement)
                  if (p.tagName === 'DETAILS' && !p.open) {
                    const summary = Array.from(p.children).find(x => x.tagName === 'SUMMARY');
                    if (!summary?.contains(el)) return false;
                  }
                const r = el.getBoundingClientRect(),
                  s = getComputedStyle(el);
                return (
                  r.width > 0 &&
                  r.height > 0 &&
                  s.visibility !== 'hidden' &&
                  s.display !== 'none' &&
                  r.right > 0 &&
                  r.left < innerWidth &&
                  !el.getAttribute('aria-label') &&
                  !el.getAttribute('aria-labelledby') &&
                  !el.getAttribute('title') &&
                  !el.innerText.trim()
                );
              })
              .map(el => el.outerHTML.slice(0, 220)),
          );
          assert.deepEqual(unnamed, [], `${theme}/${width}/${label}: unnamed buttons`);
        }
        // The design-system gallery is part of Settings, in both modes and widths.
        await page.getByRole('button', { name: /مكتبة المكوّنات/ }).click();
        assert.equal(await page.getByRole('heading', { name: 'مكتبة المكوّنات' }).count(), 1);
        await page.getByRole('button', { name: 'إجراء أساسي' }).click();
        assert.match(await page.locator('.design-feedback').innerText(), /للمعاينة|المعاينة/);
        await noOverflow(page, `${theme}/${width}/component-gallery`);
        // A real Tab event should expose a visible focus indicator.
        await page.getByRole('button', { name: 'إجراء أساسي' }).focus();
        await page.keyboard.press('Tab');
        const focus = await page.evaluate(() => {
          const e = document.activeElement,
            s = getComputedStyle(e);
          return {
            tag: e.tagName,
            visible: e.matches(':focus-visible'),
            outline: s.outlineStyle,
            width: parseFloat(s.outlineWidth),
            box: s.boxShadow,
          };
        });
        assert.ok(
          focus.visible && ((focus.outline !== 'none' && focus.width > 0) || focus.box !== 'none'),
          `Focus indicator missing: ${JSON.stringify(focus)}`,
        );
        await nav(page, 'مصادر البيانات');
        const trigger = page.getByRole('button', { name: 'إضافة مصدر' });
        await trigger.click();
        const dialog = page.getByRole('dialog', { name: /إضافة مصدر/ });
        await dialog.waitFor();
        assert.equal(await dialog.getAttribute('aria-modal'), 'true');
        // From the dialog container Shift+Tab wraps to its final focusable control.
        await dialog.focus();
        await page.keyboard.press('Shift+Tab');
        const inside = await page.evaluate(() => {
          const d = document.querySelector('.overlay [role="dialog"]');
          return d?.contains(document.activeElement);
        });
        assert.equal(inside, true, 'focus should stay in the top dialog');
        await page.keyboard.press('Escape');
        await dialog.waitFor({ state: 'detached' });
        assert.equal(
          await trigger.evaluate(el => el === document.activeElement),
          true,
          'focus restored to opener',
        );
        clean(run);
        console.log(`PASS a11y/navigation · ${theme} · ${width}px · ${pages.length} pages`);
      } finally {
        await run.context.close();
      }
    }
} finally {
  await browser.close();
}
console.log(
  'PASS focused contrast-token, semantic, focus, keyboard and responsive checks (not a full accessibility audit).',
);
