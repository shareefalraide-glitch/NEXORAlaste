// Focus-only regression for a confirmation over a form opened from a split pane.
// It does not stand in for a human screen-reader or spoken-Arabic review.
import { chromium, firefox, webkit } from 'playwright';
import { assert, newPage, login, nav, clean } from '../support/helpers.mjs';
async function runCase(browser, { name, width, theme }) {
  const run = await newPage(browser, { width, height: 860, theme }),
    { page } = run;
  try {
    await login(page);
    await nav(page, 'الحوادث');
    await page.locator('table tbody tr').filter({ hasText: 'INC-2026-084' }).click();
    const drawer = page.locator('.detail-layer-active .drawer'),
      bar = drawer.getByRole('region', { name: 'تحقيقات الجلسة المفتوحة' });
    await bar.locator('.investigation-tab-add summary').click();
    await bar.getByLabel('اختيار حادثة لفتح تحقيق آخر').selectOption('INC-2026-083');
    await bar.getByRole('button', { name: 'فتح التحقيق', exact: true }).click();
    await bar.getByRole('button', { name: 'عرض تحقيقين', exact: true }).click();
    const split = page.getByRole('dialog', { name: 'عرض تحقيقين' }),
      first = split.getByRole('region', { name: 'لوحة تحقيق INC-2026-083' }),
      opener = first.getByRole('button', { name: 'تصنيف إنذار كاذب', exact: true });
    await opener.focus();
    await opener.press('Enter');
    const form = page.getByRole('dialog', { name: 'تصنيف إنذار كاذب' });
    await form.waitFor();
    await page.waitForFunction(
      () =>
        document.activeElement?.closest('[role="dialog"]')?.getAttribute('aria-label') ===
        'تصنيف إنذار كاذب',
    );
    for (let i = 0; i < 8; i++) {
      await page.keyboard.press('Tab');
      assert.equal(
        await form.evaluate(el => el.contains(document.activeElement)),
        true,
        'focus stays in upper form dialog',
      );
    }
    const reason = form.locator('textarea');
    await reason.fill('سبب تجريبي غير محفوظ');
    await page.keyboard.press('Escape');
    const confirm = page.getByRole('dialog', { name: 'تغييرات غير محفوظة' });
    await confirm.waitFor();
    await page.waitForFunction(
      () =>
        document.activeElement?.closest('[role="dialog"]')?.getAttribute('aria-label') ===
        'تغييرات غير محفوظة',
    );
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press('Tab');
      assert.equal(
        await confirm.evaluate(el => el.contains(document.activeElement)),
        true,
        'focus stays in upper confirmation',
      );
    }
    await confirm.getByRole('button', { name: 'متابعة التعديل' }).click();
    await confirm.waitFor({ state: 'hidden' });
    assert.equal(
      await form.evaluate(el => el.contains(document.activeElement)),
      true,
      'focus returns to form after cancelling discard',
    );
    assert.equal(await reason.inputValue(), 'سبب تجريبي غير محفوظ');
    await page.keyboard.press('Escape');
    await page
      .getByRole('dialog', { name: 'تغييرات غير محفوظة' })
      .getByRole('button', { name: 'تجاهل التغييرات' })
      .click();
    await form.waitFor({ state: 'hidden' });
    await page.waitForFunction(() =>
      document.activeElement?.textContent?.includes('تصنيف إنذار كاذب'),
    );
    assert.equal(await split.isVisible(), true, 'closing nested dialogs retains split workspace');
    assert.equal(
      await opener.evaluate(el => el === document.activeElement),
      true,
      'focus returns to the action that opened the form',
    );
    clean(run);
    console.log(
      `PASS 1.6.1 nested focus ${name} ${theme}/${width}: split → form → discard confirmation → restore`,
    );
  } finally {
    await run.context.close();
  }
}
const only = process.env.NEXORA_ENGINES?.split(',');
for (const [name, engine] of [
  ['Chromium', chromium],
  ['Firefox', firefox],
  ['WebKit', webkit],
]) {
  if (only && !only.includes(name)) continue;
  const browser = await engine.launch({
    headless: true,
    ...(name === 'Chromium' ? { args: ['--no-sandbox'] } : {}),
  });
  try {
    await runCase(browser, { name, width: 1440, theme: 'dark' });
    await runCase(browser, { name, width: 320, theme: 'light' });
  } finally {
    await browser.close();
  }
}
