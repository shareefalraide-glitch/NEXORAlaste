import fs from 'node:fs';
import { chromium, firefox, webkit } from 'playwright';
import { assert, newPage, login, nav, noOverflow, clean } from '../support/helpers.mjs';

const image = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRqkAAAAASUVORK5CYII=',
  'base64',
);
const drawer = root => root.locator('.detail-layer-active .drawer');
const tabs = root => drawer(root).getByRole('region', { name: 'تحقيقات الجلسة المفتوحة' });
const pane = (root, id) => root.getByRole('region', { name: `لوحة تحقيق ${id}` });
const book = root => root.getByRole('region', { name: 'قائمة مهام وملاحظات الحادثة' });
async function openSplit(root) {
  await nav(root, 'الحوادث');
  await root.locator('table tbody tr').filter({ hasText: 'INC-2026-084' }).click();
  await tabs(root).locator('.investigation-tab-add summary').click();
  await tabs(root).getByLabel('اختيار حادثة لفتح تحقيق آخر').selectOption('INC-2026-083');
  await tabs(root).getByRole('button', { name: 'فتح التحقيق', exact: true }).click();
  await tabs(root).getByLabel('اختيار التحقيق الثاني للعرض المنقسم').selectOption('INC-2026-084');
  await tabs(root).getByRole('button', { name: 'عرض تحقيقين', exact: true }).click();
  const split = root.getByRole('dialog', { name: 'عرض تحقيقين' });
  await split.waitFor();
  return split;
}
async function mobilePane(split, id) {
  const controls = split.getByRole('group', { name: 'التبديل بين لوحتي التحقيق' });
  if (await controls.isVisible())
    await controls.getByRole('button', { name: new RegExp(id) }).click();
}
async function exercise(browser, { name, width, theme }) {
  const run = await newPage(browser, { width, height: 860, theme }),
    { page } = run;
  try {
    await login(page);
    const split = await openSplit(page),
      first = pane(split, 'INC-2026-083'),
      second = pane(split, 'INC-2026-084');
    if (width > 960) {
      assert.equal(await first.isVisible(), true);
      assert.equal(await second.isVisible(), true);
      const range = split.getByLabel('حجم لوحة التحقيق الأولى');
      await range.focus();
      await range.press('ArrowRight');
      assert.notEqual(await range.inputValue(), '50');
      if (name === 'Chromium' && process.env.NEXORA_CAPTURE_DIR) {
        fs.mkdirSync(process.env.NEXORA_CAPTURE_DIR, { recursive: true });
        await page.screenshot({ path: `${process.env.NEXORA_CAPTURE_DIR}/split-desktop.png` });
      }
    } else {
      assert.equal(await first.isVisible(), true);
      assert.equal(await second.isVisible(), false);
      if (name === 'Chromium' && process.env.NEXORA_CAPTURE_DIR)
        await page.screenshot({ path: `${process.env.NEXORA_CAPTURE_DIR}/split-mobile.png` });
    }
    await first.getByRole('button', { name: 'المهام والملاحظات', exact: true }).click();
    await book(first).getByLabel('ملخص المحلل للحادثة').fill('ملخص التحقيق الأول');
    await book(first).getByLabel('ملاحظة جديدة للحادثة').fill('مسودة مستقلة للتحقيق الأول');
    await mobilePane(split, 'INC-2026-084');
    await second.getByRole('button', { name: 'المهام والملاحظات', exact: true }).click();
    const secondBook = book(second);
    assert.equal(await secondBook.getByLabel('ملاحظة جديدة للحادثة').inputValue(), '');
    await secondBook.getByLabel('ملخص المحلل للحادثة').fill('ملخص مستقل يكتبه المحلل');
    await secondBook.getByLabel('قسم الملاحظة').selectOption('analysis');
    await secondBook.getByLabel('نوع الملاحظة').selectOption('hypothesis');
    await secondBook.getByLabel('ربط الملاحظة بسجل').selectOption('event|EVT-90481');
    await secondBook
      .getByLabel('ملاحظة جديدة للحادثة')
      .fill('# عنوان للتحقيق\n- بند توضيحي\n<script>alert(1)</script>');
    await secondBook
      .getByLabel('اختيار صورة توضيحية للملاحظة')
      .setInputFiles({ name: 'illustration.png', mimeType: 'image/png', buffer: image });
    await secondBook.getByAltText('معاينة الصورة المختارة مؤقتًا').waitFor();
    await secondBook.getByRole('button', { name: 'إضافة ملاحظة' }).click();
    assert.match(await secondBook.locator('.case-notes').innerText(), /عنوان للتحقيق/);
    assert.equal(await secondBook.locator('.case-notes .notebook-line-heading').count(), 1);
    await secondBook.locator('.notebook-export > summary').click();
    const preview = secondBook.getByRole('article', { name: 'معاينة دفتر التحقيق' });
    assert.equal(await preview.locator('img').count(), 0, 'images omitted by default');
    assert.match(await preview.innerText(), /ملخص مستقل يكتبه المحلل/);
    assert.match(await preview.innerText(), /<script>alert\(1\)<\/script>/);
    const downloadPromise = page.waitForEvent('download');
    await secondBook.getByRole('button', { name: 'تنزيل دفتر HTML' }).click();
    const download = await downloadPromise;
    const html = fs.readFileSync(await download.path(), 'utf8');
    assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
    assert.doesNotMatch(html, /<script>/i);
    assert.doesNotMatch(html, /data:image/i);
    await secondBook.getByLabel('تضمين الصور المحلية اختياريًا').check();
    assert.equal(await preview.locator('img').count(), 1);
    await page.evaluate(() => {
      window.__notebookPrint = '';
      window.print = () => {
        window.__notebookPrint = document.body.classList.contains('nexora-notebook-printing')
          ? document.querySelector('.notebook-print-root')?.textContent || ''
          : 'missing';
      };
    });
    await secondBook.getByRole('button', { name: 'طباعة / حفظ PDF' }).click();
    assert.match(await page.evaluate(() => window.__notebookPrint), /ملخص مستقل يكتبه المحلل/);
    await secondBook.locator('.notebook-export > summary').click();
    await second.getByRole('button', { name: 'الخط الزمني', exact: true }).click();
    const linked = second.locator('.timeline-linked-notes');
    assert.ok((await linked.count()) > 0);
    assert.match(await linked.first().innerText(), /ليست مؤرخة في زمن العينة/);
    assert.match(await linked.first().innerText(), /عنوان للتحقيق/);
    await second.getByRole('button', { name: 'المهام والملاحظات', exact: true }).click();
    await secondBook.getByRole('button', { name: /فتح السجل المرتبط:.*EVT-90481/ }).click();
    assert.match(await second.locator('.split-detail-heading:visible').innerText(), /EVT-90481/);
    await mobilePane(split, 'INC-2026-083');
    assert.equal(
      await book(first).getByLabel('ملاحظة جديدة للحادثة').inputValue(),
      'مسودة مستقلة للتحقيق الأول',
    );
    assert.equal(
      await book(first).getByLabel('ملخص المحلل للحادثة').inputValue(),
      'ملخص التحقيق الأول',
    );
    await mobilePane(split, 'INC-2026-084');
    if (width > 960) await second.locator('.split-detail-heading:visible').focus();
    await split.getByRole('button', { name: 'إغلاق', exact: true }).click();
    assert.match(
      await drawer(page).getAttribute('aria-label'),
      /EVT-90481/,
      'the focused pane trail is restored',
    );
    await tabs(page).getByRole('button', { name: 'استعادة تحقيق INC-2026-083' }).click();
    assert.equal(
      await book(drawer(page)).getByLabel('ملاحظة جديدة للحادثة').inputValue(),
      'مسودة مستقلة للتحقيق الأول',
    );
    await drawer(page).getByRole('button', { name: 'إغلاق', exact: true }).click();
    await nav(page, 'التنبيهات');
    await page.getByLabel('تحديد ALT-1284').check();
    await page.getByLabel('تحديد ALT-1283').check();
    const oldA = await page.locator('table tbody tr').filter({ hasText: 'ALT-1284' }).innerText(),
      oldB = await page.locator('table tbody tr').filter({ hasText: 'ALT-1283' }).innerText();
    await page.getByRole('button', { name: 'فرز مستقل للمحدد' }).click();
    let batch = page.getByRole('dialog', { name: 'مراجعة مستقلة للتنبيهات' });
    await batch.getByRole('button', { name: 'معاينة القرارات المستقلة' }).click();
    assert.match(await batch.getByRole('alert').innerText(), /قرار وأولوية وسبب/);
    await batch.getByLabel('قرار التنبيه ALT-1284').selectOption('followup');
    await batch.getByLabel('أولوية التنبيه ALT-1284').selectOption('p1');
    await batch.getByLabel('سبب التنبيه ALT-1284').fill('سبب مستقل ألف');
    await batch
      .getByRole('group', { name: 'قائمة التنبيهات المختارة' })
      .getByRole('button', { name: /ALT-1283/ })
      .click();
    await batch.getByLabel('قرار التنبيه ALT-1283').selectOption('unknown');
    await batch.getByLabel('أولوية التنبيه ALT-1283').selectOption('p3');
    await batch.getByLabel('سبب التنبيه ALT-1283').fill('سبب مستقل باء');
    await batch.getByRole('button', { name: 'معاينة القرارات المستقلة' }).click();
    const batchPreview = batch.getByRole('region', { name: 'معاينة القرارات المستقلة' });
    assert.match(await batchPreview.innerText(), /سبب مستقل ألف/);
    assert.match(await batchPreview.innerText(), /سبب مستقل باء/);
    await batch.getByRole('button', { name: 'إغلاق', exact: true }).first().click();
    assert.equal(
      await page.locator('table tbody tr').filter({ hasText: 'ALT-1284' }).innerText(),
      oldA,
      'preview does not commit',
    );
    await page.getByRole('button', { name: 'فرز مستقل للمحدد' }).click();
    batch = page.getByRole('dialog', { name: 'مراجعة مستقلة للتنبيهات' });
    assert.equal(await batch.getByLabel('سبب التنبيه ALT-1284').inputValue(), 'سبب مستقل ألف');
    await batch
      .getByRole('group', { name: 'قائمة التنبيهات المختارة' })
      .getByRole('button', { name: /ALT-1283/ })
      .click();
    assert.equal(await batch.getByLabel('سبب التنبيه ALT-1283').inputValue(), 'سبب مستقل باء');
    await batch.getByRole('button', { name: 'معاينة القرارات المستقلة' }).click();
    await batch.getByRole('button', { name: 'تأكيد تسجيل القرارات' }).click();
    assert.match(
      await page.locator('table tbody tr').filter({ hasText: 'ALT-1284' }).innerText(),
      /تمت المراجعة/,
    );
    assert.match(
      await page.locator('table tbody tr').filter({ hasText: 'ALT-1283' }).innerText(),
      /تمت المراجعة/,
    );
    await page.locator('table tbody tr').filter({ hasText: 'ALT-1284' }).click();
    await drawer(page).locator('.triage-assistant summary').click();
    assert.match(await drawer(page).locator('.triage-history').innerText(), /سبب مستقل ألف/);
    await drawer(page).getByRole('button', { name: 'إغلاق', exact: true }).click();
    await page.locator('.undo-banner').getByRole('button', { name: 'تراجع', exact: true }).click();
    assert.equal(
      await page.locator('table tbody tr').filter({ hasText: 'ALT-1284' }).innerText(),
      oldA,
    );
    assert.equal(
      await page.locator('table tbody tr').filter({ hasText: 'ALT-1283' }).innerText(),
      oldB,
    );
    await noOverflow(page, `${name}/${width}/triage`);
    await nav(page, 'تحليل الشبكة');
    const heat = page.getByRole('region', { name: 'خريطة محاولات الشبكة الحرارية' });
    if (width > 760) await heat.locator('.heatmap-cell[aria-label^="AD-SRV-01،"]').last().click();
    else {
      await heat.getByLabel('أصل الخريطة الحرارية').selectOption('AST-001');
      await heat.locator('.heatmap-mobile-cells button').last().click();
    }
    const net = heat.getByRole('region', { name: 'سياق الأصل والفاصل' });
    assert.match(await net.innerText(), /لا يثبت/);
    assert.match(await net.innerText(), /EVT-90481/);
    assert.match(await net.innerText(), /ALT-1284/);
    await net.locator('.network-session-notes summary').click();
    assert.match(await net.locator('.network-session-notes').innerText(), /عنوان للتحقيق/);
    assert.match(await net.locator('.network-session-notes').innerText(), /لا تُرشّح بوقت الفاصل/);
    await net.getByRole('button', { name: 'فتح حدث EVT-90481 من سياق الشبكة' }).click();
    assert.match(await drawer(page).getAttribute('aria-label'), /EVT-90481/);
    await drawer(page).getByRole('button', { name: 'إغلاق', exact: true }).click();
    await noOverflow(page, `${name}/${width}/network`);
    await nav(page, 'خريطة العلاقات');
    await page.getByRole('button', { name: 'مستكشف التحقيق', exact: true }).click();
    const graph = page.getByRole('region', { name: 'مستكشف التحقيق التفاعلي' });
    await graph
      .getByLabel('تصفية نوع العلاقات')
      .selectOption({ label: 'الأصل المرتبط بسجل الحادثة' });
    await graph.getByRole('button', { name: 'فحص العلاقة', exact: true }).first().click();
    let edge = graph.getByRole('region', { name: 'تفاصيل العلاقة المختارة' });
    assert.match(await edge.innerText(), /الأصل المرتبط بسجل الحادثة/);
    assert.match(await edge.innerText(), /INC-2026-084/);
    assert.match(await edge.innerText(), /لا تثبت اتصالًا/);
    if (await graph.locator('.analyst-canvas').isVisible()) {
      const line = graph.locator('.graph-edge-hit').first();
      await line.focus();
      await line.press('Enter');
      edge = graph.getByRole('region', { name: 'تفاصيل العلاقة المختارة' });
      assert.equal(await edge.isVisible(), true);
    }
    await noOverflow(page, `${name}/${width}/graph`);
    clean(run);
    console.log(
      `PASS 1.6 ${name} ${theme}/${width}: split trails and drafts, safe export/print, linked timeline notes, independent batch/undo, network context and relationship inspector`,
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
    await exercise(browser, { name, width: 1440, theme: 'dark' });
    await exercise(browser, { name, width: 320, theme: 'light' });
  } finally {
    await browser.close();
  }
}
