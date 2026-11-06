import fs from 'node:fs';
import { chromium, firefox, webkit } from 'playwright';
import { assert, newPage, login, nav, noOverflow, clean } from '../support/helpers.mjs';

const image = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRqkAAAAASUVORK5CYII=',
  'base64',
);
const drawer = root => root.locator('.detail-layer-active .drawer');
const pane = (root, id) => root.getByRole('region', { name: `لوحة تحقيق ${id}` });
const book = root => root.getByRole('region', { name: 'قائمة مهام وملاحظات الحادثة' });
async function openSplit(page) {
  await nav(page, 'الحوادث');
  await page.locator('table tbody tr').filter({ hasText: 'INC-2026-084' }).click();
  const bar = drawer(page).getByRole('region', { name: 'تحقيقات الجلسة المفتوحة' });
  await bar.locator('.investigation-tab-add summary').click();
  await bar.getByLabel('اختيار حادثة لفتح تحقيق آخر').selectOption('INC-2026-083');
  await bar.getByRole('button', { name: 'فتح التحقيق', exact: true }).click();
  await bar.getByLabel('اختيار التحقيق الثاني للعرض المنقسم').selectOption('INC-2026-084');
  await bar.getByRole('button', { name: 'عرض تحقيقين', exact: true }).click();
  const split = page.getByRole('dialog', { name: 'عرض تحقيقين' });
  await split.waitFor();
  return split;
}
async function mobilePane(split, id) {
  const group = split.getByRole('group', { name: 'التبديل بين لوحتي التحقيق' });
  if (await group.isVisible()) await group.getByRole('button', { name: new RegExp(id) }).click();
}
const normalize = text =>
  text
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/gu, ' ')
    .trim();
async function checkHtmlMatches(page, book, preview, label) {
  const downloadPromise = page.waitForEvent('download');
  await book.getByRole('button', { name: 'تنزيل دفتر HTML' }).click();
  const download = await downloadPromise,
    html = fs.readFileSync(await download.path(), 'utf8');
  assert.doesNotMatch(html, /<script>/i, `${label}: analyst input is not executable`);
  const result = await preview.evaluate((node, source) => {
    const doc = new DOMParser().parseFromString(source, 'text/html'),
      main = doc.querySelector('main');
    const images = root =>
      [...root.querySelectorAll('img')].map(img => ({
        alt: img.getAttribute('alt'),
        src: img.getAttribute('src'),
      }));
    return {
      preview: node.textContent,
      exported: main.textContent,
      previewImages: images(node),
      exportedImages: images(main),
    };
  }, html);
  assert.equal(
    normalize(result.preview),
    normalize(result.exported),
    `${label}: selected preview and HTML text differ`,
  );
  assert.deepEqual(
    result.previewImages,
    result.exportedImages,
    `${label}: image sources and alternatives differ`,
  );
  return html;
}
async function checkStandaloneExport(page, html, preview, { name, width }) {
  if (name !== 'Chromium' || width !== 1440) return;
  const standalone = await page.context().newPage();
  try {
    await standalone.setContent(html, { waitUntil: 'load' });
    assert.equal(
      normalize(await standalone.locator('main').textContent()),
      normalize(await preview.textContent()),
      'opened standalone HTML has the same chosen text',
    );
    assert.equal(
      await standalone.locator('img').evaluate(img => img.complete && img.naturalWidth > 0),
      true,
      'the selected local image renders in exported HTML',
    );
    const pdf = await standalone.pdf({ format: 'A4', printBackground: true });
    assert.equal(pdf.subarray(0, 5).toString(), '%PDF-');
    assert.ok(pdf.length > 10000);
    if (process.env.NEXORA_CAPTURE_DIR) {
      fs.mkdirSync(process.env.NEXORA_CAPTURE_DIR, { recursive: true });
      fs.writeFileSync(`${process.env.NEXORA_CAPTURE_DIR}/exported-html-with-image.pdf`, pdf);
    }
  } finally {
    await standalone.close();
  }
}
async function checkPrintMatches(page, book, preview, { name, width }) {
  const expected = await preview.evaluate(node => ({
    text: node.textContent,
    images: [...node.querySelectorAll('img')].map(img => ({
      alt: img.getAttribute('alt'),
      src: img.getAttribute('src'),
    })),
  }));
  await page.evaluate(() => {
    window.__printedNotebook = null;
    window.print = () => {
      const root = document.querySelector('.notebook-print-root');
      window.__printedNotebook = {
        text: root?.textContent,
        images: [...root.querySelectorAll('img')].map(img => ({
          alt: img.getAttribute('alt'),
          src: img.getAttribute('src'),
        })),
      };
    };
  });
  await book.getByRole('button', { name: 'طباعة / حفظ PDF' }).click();
  const actual = await page.evaluate(() => window.__printedNotebook);
  assert.equal(
    normalize(actual.text),
    normalize(expected.text),
    'print clone has exactly the preview text',
  );
  assert.deepEqual(
    actual.images,
    expected.images,
    'print clone has exactly the selected images and alternatives',
  );
  if (name === 'Chromium' && width === 1440) {
    await page.emulateMedia({ media: 'print' });
    const pdf = await page.pdf({ format: 'A4', printBackground: true });
    assert.equal(pdf.subarray(0, 5).toString(), '%PDF-');
    assert.ok(pdf.length > 10000);
    if (process.env.NEXORA_CAPTURE_DIR) {
      fs.mkdirSync(process.env.NEXORA_CAPTURE_DIR, { recursive: true });
      fs.writeFileSync(`${process.env.NEXORA_CAPTURE_DIR}/notebook-selected-with-image.pdf`, pdf);
    }
    await page.emulateMedia({ media: 'screen' });
  }
  await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
}
async function exercise(browser, { name, width, theme }) {
  const run = await newPage(browser, { width, height: 860, theme }),
    { page } = run;
  try {
    await login(page);
    const split = await openSplit(page),
      first = pane(split, 'INC-2026-083'),
      second = pane(split, 'INC-2026-084');
    const legend = split.locator('.split-sharing');
    assert.equal(await legend.isVisible(), true);
    assert.match(await legend.innerText(), /مستقل[\s\S]*مسودة[\s\S]*مشترك[\s\S]*قراراته المؤكدة/);
    assert.equal(await split.locator('.split-shared-record').count(), 0);
    if (name === 'Chromium' && process.env.NEXORA_CAPTURE_DIR) {
      fs.mkdirSync(process.env.NEXORA_CAPTURE_DIR, { recursive: true });
      await page.screenshot({ path: `${process.env.NEXORA_CAPTURE_DIR}/split-${width}.png` });
    }
    // Open the same alert from two different case trails; only the confirmed record is shared.
    await first.getByRole('button', { name: 'مستكشف التحقيق', exact: true }).click();
    let graph = first.getByRole('region', { name: 'مستكشف التحقيق التفاعلي' });
    await graph.getByLabel('البحث في عقد التحقيق').fill('ALT-1284');
    await graph.getByRole('button', { name: /تحديد نتيجة تنبيه .*ALT-1284/ }).click();
    await graph.getByRole('button', { name: 'فتح السياق', exact: true }).click();
    let triageA = first.locator('.split-layer:not([hidden]) .triage-assistant');
    await triageA.locator('summary').click();
    await triageA.getByLabel('سبب قرار مراجعة التنبيه').fill('مسودة مستقلة أولى');
    await mobilePane(split, 'INC-2026-084');
    await second.getByRole('button', { name: 'التنبيهات', exact: true }).click();
    await second.locator('.related-row').filter({ hasText: 'ALT-1284' }).click();
    let triageB = second.locator('.split-layer:not([hidden]) .triage-assistant');
    await triageB.locator('summary').click();
    assert.equal(await triageB.getByLabel('سبب قرار مراجعة التنبيه').inputValue(), '');
    await triageB.getByLabel('سبب قرار مراجعة التنبيه').fill('مسودة مستقلة ثانية');
    const same = split.locator('.split-shared-record');
    assert.equal(await same.isVisible(), true);
    assert.match(
      await same.innerText(),
      /ALT-1284[\s\S]*حالته وقراراته المؤكدة مشتركة[\s\S]*مسودة المراجعة مستقلة/,
    );
    if (name === 'Chromium' && process.env.NEXORA_CAPTURE_DIR)
      await page.screenshot({ path: `${process.env.NEXORA_CAPTURE_DIR}/same-alert-${width}.png` });
    await mobilePane(split, 'INC-2026-083');
    await triageA.getByLabel('قرار مراجعة التنبيه', { exact: true }).selectOption('followup');
    await triageA.getByLabel('أولوية مراجعة التنبيه', { exact: true }).selectOption('p1');
    await triageA.getByRole('button', { name: 'معاينة القرار', exact: true }).click();
    assert.equal(await triageB.locator('.triage-history li').count(), 0, 'preview does not commit');
    await triageA.getByRole('button', { name: 'تأكيد تسجيل القرار', exact: true }).click();
    assert.match(await triageA.locator('.triage-history').innerText(), /مسودة مستقلة أولى/);
    await mobilePane(split, 'INC-2026-084');
    assert.equal(
      await triageB.getByLabel('سبب قرار مراجعة التنبيه').inputValue(),
      'مسودة مستقلة ثانية',
      'other case draft is retained',
    );
    assert.match(
      await triageB.locator('.triage-history').innerText(),
      /مسودة مستقلة أولى/,
      'confirmed decision is visible in other case',
    );
    assert.match(await second.innerText(), /تمت المراجعة/, 'confirmed alert state is shared');
    await second.getByRole('button', { name: 'العودة للسجل السابق' }).click();
    assert.equal(
      await split.locator('.split-shared-record').count(),
      0,
      'same-record notice clears when one trail changes',
    );
    await second.getByRole('button', { name: 'المهام والملاحظات', exact: true }).click();
    const notebook = book(second);
    await notebook.getByLabel('ملخص المحلل للحادثة').fill('ملخص انتخابي تجريبي');
    await notebook.getByLabel('قسم الملاحظة').selectOption('analysis');
    await notebook.getByLabel('ربط الملاحظة بسجل').selectOption('event|EVT-90481');
    await notebook
      .getByLabel('ملاحظة جديدة للحادثة')
      .fill('# عنوان اختبار\n- بند أول\n<script>alert(1)</script>');
    await notebook
      .getByLabel('اختيار صورة توضيحية للملاحظة')
      .setInputFiles({ name: 'صورة-تجريبية.png', mimeType: 'image/png', buffer: image });
    await notebook.getByAltText('معاينة الصورة المختارة مؤقتًا').waitFor();
    await notebook.getByRole('button', { name: 'إضافة ملاحظة' }).click();
    await notebook.getByLabel('قسم الملاحظة').selectOption('followup');
    await notebook.getByLabel('ملاحظة جديدة للحادثة').fill('سؤال متابعة منفصل');
    await notebook.getByRole('button', { name: 'إضافة ملاحظة' }).click();
    await notebook.locator('.notebook-export > summary').click();
    const preview = notebook.getByRole('article', { name: 'معاينة دفتر التحقيق' }),
      manifest = notebook.getByRole('group', { name: 'ملخص محتوى التصدير' });
    assert.match(await manifest.innerText(), /الصور[\s\S]*مستبعدة/);
    assert.equal(await preview.locator('img').count(), 0);
    assert.match(await preview.innerText(), /مراجع مختارة/);
    const color = await preview
      .locator('.notebook-line-heading')
      .evaluate(el => getComputedStyle(el).color);
    assert.equal(color, 'rgb(23, 32, 45)', 'formatted heading is dark on white in either theme');
    let html = await checkHtmlMatches(page, notebook, preview, 'default');
    assert.doesNotMatch(html, /data:image/);
    assert.match(html, /سؤال متابعة منفصل/);
    await notebook.getByLabel('ملخص المحلل', { exact: true }).uncheck();
    await notebook.getByLabel('قائمة التحقق', { exact: true }).uncheck();
    await notebook.locator('.notebook-export-sections').getByLabel('المتابعة والأسئلة').uncheck();
    html = await checkHtmlMatches(page, notebook, preview, 'selected section only');
    assert.doesNotMatch(html, /ملخص انتخابي تجريبي|سؤال متابعة منفصل|قائمة التحقق/);
    assert.match(await manifest.innerText(), /الملخص[\s\S]*مستبعد/);
    await notebook.getByLabel('تضمين الصور المحلية اختياريًا').check();
    assert.equal(await preview.locator('img').count(), 1);
    html = await checkHtmlMatches(page, notebook, preview, 'with selected image');
    assert.match(html, /data:image\/png;base64/);
    assert.match(await manifest.innerText(), /الصور[\s\S]*١ مضمّنة/);
    await checkStandaloneExport(page, html, preview, { name, width });
    await checkPrintMatches(page, notebook, preview, { name, width });
    if (name === 'Chromium' && process.env.NEXORA_CAPTURE_DIR) {
      await preview.scrollIntoViewIfNeeded();
      await page.screenshot({ path: `${process.env.NEXORA_CAPTURE_DIR}/notebook-${width}.png` });
    }
    await notebook.getByLabel('الملاحظات', { exact: true }).uncheck();
    assert.equal(await notebook.getByLabel('تضمين الصور المحلية اختياريًا').isDisabled(), true);
    assert.equal(await notebook.getByLabel('تضمين الصور المحلية اختياريًا').isChecked(), false);
    html = await checkHtmlMatches(page, notebook, preview, 'notes disabled');
    assert.doesNotMatch(html, /data:image|عنوان اختبار|سؤال متابعة منفصل/);
    await notebook.getByLabel('الملاحظات', { exact: true }).check();
    assert.equal(
      await notebook.getByLabel('تضمين الصور المحلية اختياريًا').isChecked(),
      false,
      'images are never silently re-enabled',
    );
    await notebook.locator('.notebook-export-sections').getByLabel('التحليل والفرضيات').uncheck();
    await notebook.locator('.notebook-export-sections').getByLabel('السياق والملاحظات').uncheck();
    html = await checkHtmlMatches(page, notebook, preview, 'no selected sections');
    assert.doesNotMatch(html, /عنوان اختبار|سؤال متابعة منفصل/);
    await noOverflow(page, `${name}/${width}/split and notebook`);
    await split.getByRole('button', { name: 'إغلاق', exact: true }).click();
    await drawer(page).getByRole('button', { name: 'إغلاق', exact: true }).click();
    // Every rendered network record carries the actual asset-match and interval reason.
    await nav(page, 'تحليل الشبكة');
    const heat = page.getByRole('region', { name: 'خريطة محاولات الشبكة الحرارية' });
    if (width > 760) await heat.locator('.heatmap-cell[aria-label^="AD-SRV-01،"]').last().click();
    else {
      await heat.getByLabel('أصل الخريطة الحرارية').selectOption('AST-001');
      await heat.locator('.heatmap-mobile-cells button').last().click();
    }
    const net = heat.getByRole('region', { name: 'سياق الأصل والفاصل' });
    assert.match(await net.innerText(), /لا يثبت/);
    const inside = net.locator('li[data-time-relation="inside"]');
    assert.ok((await inside.count()) > 0);
    assert.match(
      await inside.first().locator('.network-match-reason').innerText(),
      /وقت السجل داخل الفاصل/,
    );
    // The last fixture bucket can contain every record for this asset. Move to
    // an earlier bucket to exercise the separate outside section as well.
    if (width > 760) await heat.locator('.heatmap-cell[aria-label^="AD-SRV-01،"]').first().click();
    else await heat.locator('.heatmap-mobile-cells button').first().click();
    const outside = net
      .locator('details')
      .filter({ hasText: 'سجلات الأصل خارج الفاصل أو بلا وقت عينة' });
    await outside.locator('summary').click();
    const records = net.locator('li[data-asset-match]');
    assert.ok((await records.count()) > 1);
    for (let i = 0; i < (await records.count()); i++) {
      const row = records.nth(i),
        method = await row.getAttribute('data-asset-match'),
        time = await row.getAttribute('data-time-relation'),
        text = await row.locator('.network-match-reason').innerText();
      assert.match(text, /سبب الظهور/);
      assert.match(text, method === 'id' ? /معرّف الأصل/ : /اسم أصل فريد/);
      assert.match(
        text,
        {
          inside: /داخل الفاصل/,
          before: /قبل الفاصل/,
          after: /عند نهاية الفاصل أو بعدها/,
          undated: /وقت العينة غير متاح/,
        }[time],
      );
    }
    await net.locator('.network-session-notes summary').click();
    assert.match(
      await net.locator('.network-session-notes .network-match-reason').first().innerText(),
      /ملاحظة جلسة[\s\S]*لا تُرشّح بوقت الفاصل/,
    );
    if (name === 'Chromium' && process.env.NEXORA_CAPTURE_DIR) {
      await net.scrollIntoViewIfNeeded();
      await page.screenshot({ path: `${process.env.NEXORA_CAPTURE_DIR}/network-${width}.png` });
    }
    await noOverflow(page, `${name}/${width}/network`);
    // The textual inspector remains usable on mobile; its count is provenance, not confidence.
    await nav(page, 'خريطة العلاقات');
    await page.getByRole('button', { name: 'مستكشف التحقيق', exact: true }).click();
    graph = page.getByRole('region', { name: 'مستكشف التحقيق التفاعلي' });
    await graph.getByRole('button', { name: 'فحص العلاقة', exact: true }).first().click();
    const inspector = graph.getByRole('region', { name: 'تفاصيل العلاقة المختارة' }),
      sources = inspector.locator('.graph-edge-sources');
    assert.match(await inspector.innerText(), /ليس عدد اتصالات أو درجة ثقة/);
    assert.match(await inspector.innerText(), /لا تثبت اتصالًا أو سببًا/);
    const referenceCount = await sources.locator('button').count();
    assert.ok(referenceCount > 0);
    assert.ok(
      (await sources.locator('span').first().innerText()).includes(
        new Intl.NumberFormat('ar-EG').format(referenceCount),
      ),
    );
    if (await graph.locator('.analyst-canvas').isVisible()) {
      const line = graph.locator('.graph-edge-hit').first();
      await line.focus();
      await line.press('Enter');
      assert.equal(await inspector.isVisible(), true);
    }
    await noOverflow(page, `${name}/${width}/graph`);
    clean(run);
    console.log(
      `PASS 1.6.1 ${name} ${theme}/${width}: explicit split sharing, selective HTML/print parity, provenance reasons and relationship count`,
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
