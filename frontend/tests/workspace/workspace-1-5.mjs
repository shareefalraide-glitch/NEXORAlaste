// 1.5 session UX tests. Everything is a local fixture, not a SOC service.
import fs from 'node:fs';
import { chromium, firefox, webkit } from 'playwright';
import { assert, newPage, login, nav, noOverflow, clean } from '../support/helpers.mjs';
const drawer = root => root.locator('.detail-layer-active .drawer');
const bar = root => drawer(root).getByRole('region', { name: 'تحقيقات الجلسة المفتوحة' });
const notebook = root => drawer(root).getByRole('region', { name: 'قائمة مهام وملاحظات الحادثة' });
const switchTo = (root, id) =>
  bar(root)
    .getByRole('button', { name: `استعادة تحقيق ${id}`, exact: true })
    .click();
const screenshot = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRqkAAAAASUVORK5CYII=',
  'base64',
);
async function openCase(root, id = 'INC-2026-084') {
  await nav(root, 'الحوادث');
  await root.locator('table tbody tr').filter({ hasText: id }).click();
  await drawer(root).waitFor();
}
async function addCase(root, id) {
  const tabs = bar(root);
  await tabs.locator('.investigation-tab-add summary').click();
  await tabs.getByLabel('اختيار حادثة لفتح تحقيق آخر').selectOption(id);
  await tabs.getByRole('button', { name: 'فتح التحقيق', exact: true }).click();
}
async function exercise(browser, { width, theme }) {
  const run = await newPage(browser, { width, height: 860, theme }),
    { page } = run;
  try {
    await login(page);
    await openCase(page);
    await drawer(page).getByRole('button', { name: 'المهام والملاحظات' }).click();
    let book = notebook(page);
    await book.getByLabel('مهمة جديدة للحادثة').fill('مسودة مهمة أولى');
    await book.getByLabel('نوع الملاحظة').selectOption('hypothesis');
    await book.getByLabel('ربط الملاحظة بسجل').selectOption('incident|INC-2026-084');
    await book.getByRole('button', { name: 'إضافة رابط آخر' }).click();
    await book.getByLabel('ربط الملاحظة بسجل').selectOption('event|EVT-90481');
    await book.getByLabel('ملاحظة جديدة للحادثة').fill('مسودة أولى تبقى في الذاكرة فقط');
    await book
      .getByLabel('اختيار صورة توضيحية للملاحظة')
      .setInputFiles({ name: 'draft.png', mimeType: 'image/png', buffer: screenshot });
    await book.getByAltText('معاينة الصورة المختارة مؤقتًا').waitFor();
    const body = drawer(page).locator('.drawer-body');
    await body.evaluate(el => {
      el.scrollTop = el.scrollHeight * 0.55;
    });
    const before = await body.evaluate(el => el.scrollTop);
    await addCase(page, 'INC-2026-083');
    assert.match(await drawer(page).getAttribute('aria-label'), /INC-2026-083/);
    await drawer(page).getByRole('button', { name: 'المهام والملاحظات' }).click();
    book = notebook(page);
    assert.equal(await book.getByLabel('ملاحظة جديدة للحادثة').inputValue(), '');
    await book.getByLabel('ملاحظة جديدة للحادثة').fill('مسودة حادثة ثانية مستقلة');
    await switchTo(page, 'INC-2026-084');
    book = notebook(page);
    assert.equal(
      await book.getByLabel('ملاحظة جديدة للحادثة').inputValue(),
      'مسودة أولى تبقى في الذاكرة فقط',
    );
    assert.equal(await book.getByLabel('مهمة جديدة للحادثة').inputValue(), 'مسودة مهمة أولى');
    assert.equal(await book.getByLabel('نوع الملاحظة').inputValue(), 'hypothesis');
    assert.equal(await book.getByLabel('ربط الملاحظة بسجل').inputValue(), 'event|EVT-90481');
    assert.equal(await book.getByLabel('روابط مسودة الملاحظة').locator('span').count(), 1);
    assert.equal(await book.getByAltText('معاينة الصورة المختارة مؤقتًا').count(), 1);
    const restored = await drawer(page)
      .locator('.drawer-body')
      .evaluate(el => el.scrollTop);
    assert.ok(Math.abs(restored - before) < 25, `drawer scroll restored: ${before} -> ${restored}`);
    await book.getByRole('button', { name: 'إضافة مهمة' }).click();
    const move = book.getByRole('button', { name: 'نقل المهمة إلى أعلى: مسودة مهمة أولى' });
    for (let n = 0; n < 3; n++) await move.click();
    assert.match(await book.locator('.case-checklist li').first().innerText(), /مسودة مهمة أولى/);
    await book.getByRole('button', { name: 'إضافة ملاحظة' }).click();
    assert.equal(await book.locator('.case-notes li').count(), 1);
    assert.equal(
      await book
        .locator('.case-notes li')
        .first()
        .getByRole('button', { name: /فتح السجل المرتبط/ })
        .count(),
      2,
      'two explicitly selected references',
    );
    await book.getByLabel('البحث في ملاحظات الحادثة').fill('EVT-90481');
    assert.equal(await book.locator('.case-notes li').count(), 1);
    await book.getByLabel('البحث في ملاحظات الحادثة').fill('لا تطابق');
    assert.match(await book.innerText(), /لا توجد ملاحظات تطابق/);
    await book.getByLabel('البحث في ملاحظات الحادثة').fill('');
    await book
      .locator('.case-notes li')
      .first()
      .getByRole('button', { name: /فتح السجل المرتبط/ })
      .filter({ hasText: 'EVT-90481' })
      .click();
    assert.match(await drawer(page).getAttribute('aria-label'), /EVT-90481/);
    await switchTo(page, 'INC-2026-083');
    assert.equal(
      await notebook(page).getByLabel('ملاحظة جديدة للحادثة').inputValue(),
      'مسودة حادثة ثانية مستقلة',
    );
    await switchTo(page, 'INC-2026-084');
    assert.match(
      await drawer(page).getAttribute('aria-label'),
      /EVT-90481/,
      'tab preserves event breadcrumb',
    );
    await drawer(page).getByRole('button', { name: 'التنبيه المرتبط' }).click();
    let triage = drawer(page).locator('.triage-assistant');
    await triage.locator('summary').click();
    await triage.getByLabel('قرار مراجعة التنبيه', { exact: true }).selectOption('unknown');
    await triage.getByLabel('أولوية مراجعة التنبيه', { exact: true }).selectOption('p2');
    await triage.getByLabel('سبب قرار مراجعة التنبيه').fill('سبب مسودة غير مسجّلة');
    await triage.getByRole('button', { name: 'معاينة القرار' }).click();
    await switchTo(page, 'INC-2026-083');
    await switchTo(page, 'INC-2026-084');
    triage = drawer(page).locator('.triage-assistant');
    assert.match(await triage.locator('summary').innerText(), /مسودة غير مسجّلة/);
    await triage.locator('summary').click();
    assert.match(
      await triage.getByRole('region', { name: 'معاينة قرار المراجعة' }).innerText(),
      /سبب مسودة غير مسجّلة/,
    );
    assert.equal(
      await triage.locator('.triage-history li').count(),
      0,
      'preview is not automatically recorded',
    );
    await drawer(page).getByRole('button', { name: 'العودة للسجل السابق' }).click(); // event
    await drawer(page).getByRole('button', { name: 'العودة للسجل السابق' }).click(); // incident
    await drawer(page).getByRole('button', { name: 'نظرة عامة', exact: true }).click();
    await drawer(page).getByRole('button', { name: 'عرض الأصل', exact: true }).click();
    await drawer(page)
      .getByRole('button', { name: /واجهات الشبكة/ })
      .click();
    await switchTo(page, 'INC-2026-083');
    await switchTo(page, 'INC-2026-084');
    assert.match(await drawer(page).getAttribute('aria-label'), /AST-001/);
    assert.equal(
      await drawer(page)
        .getByRole('button', { name: /واجهات الشبكة/ })
        .getAttribute('aria-pressed'),
      'true',
      'nested asset section restored per case',
    );
    await drawer(page).getByRole('button', { name: 'العودة للسجل السابق' }).click();
    await drawer(page).getByRole('button', { name: 'مستكشف التحقيق', exact: true }).click();
    let graph = drawer(page).getByRole('region', { name: 'مستكشف التحقيق التفاعلي' });
    await graph.getByLabel('البحث في عقد التحقيق').fill('EVT-90481');
    const result = graph.getByRole('button', { name: /تحديد نتيجة حدث .*EVT-90481/ });
    await result.click();
    assert.match(await graph.locator('.analyst-inspector-head').innerText(), /EVT-90481/);
    assert.match(await graph.locator('.analyst-edges').innerText(), /السجل المرجعي/);
    await graph.getByRole('button', { name: 'تثبيت العقدة', exact: true }).click();
    await graph.getByLabel('بداية مستكشف التحقيق').selectOption('incident:INC-2026-083');
    assert.match(
      await graph.locator('.analyst-graph-status').innerText(),
      /الاحتفاظ بالعقد المثبّتة/,
    );
    const visible = (await graph.locator('.analyst-canvas').isVisible())
      ? graph.locator('.analyst-canvas')
      : graph.locator('.analyst-node-list');
    assert.equal(
      await visible.getByRole('button', { name: /EVT-90481 · مثبتة/ }).count(),
      1,
      'reset preserves pinned node',
    );
    await graph.locator('.graph-manage summary').click();
    assert.equal(
      await graph.getByLabel(/تحديد لإخفاء حدث .*EVT-90481/).isDisabled(),
      true,
      'pinned node protected',
    );
    const removable = graph.locator('.graph-manage-list input:not(:disabled)').first();
    assert.ok(await removable.count());
    await removable.check();
    await graph.getByRole('button', { name: /إخفاء المحدد/ }).click();
    assert.match(await graph.locator('.analyst-graph-status').innerText(), /لم تُحذف السجلات/);
    await switchTo(page, 'INC-2026-083');
    await switchTo(page, 'INC-2026-084');
    graph = drawer(page).getByRole('region', { name: 'مستكشف التحقيق التفاعلي' });
    assert.equal(
      await graph.getByLabel('البحث في عقد التحقيق').inputValue(),
      'EVT-90481',
      'case graph search state restored',
    );
    assert.equal(
      await graph.getByLabel('بداية مستكشف التحقيق').inputValue(),
      'incident:INC-2026-083',
      'case graph context restored',
    );
    await noOverflow(page, `${theme}/${width}/graph`);
    await bar(page).getByRole('button', { name: 'تثبيت تحقيق INC-2026-084', exact: true }).click();
    await bar(page)
      .getByRole('button', { name: 'إزالة تبويب تحقيق INC-2026-084', exact: true })
      .click();
    let confirm = page.getByRole('dialog', { name: 'إزالة تحقيق مثبّت؟' });
    assert.equal(await confirm.isVisible(), true);
    await confirm.getByRole('button', { name: 'الاحتفاظ بالتبويب' }).click();
    assert.equal(
      await bar(page).getByRole('button', { name: 'استعادة تحقيق INC-2026-084' }).count(),
      1,
    );
    await bar(page)
      .getByRole('button', { name: 'إزالة تبويب تحقيق INC-2026-084', exact: true })
      .click();
    confirm = page.getByRole('dialog', { name: 'إزالة تحقيق مثبّت؟' });
    await confirm.getByRole('button', { name: 'إزالة التبويب المثبّت' }).click();
    assert.match(await drawer(page).getAttribute('aria-label'), /INC-2026-083/);
    await drawer(page).getByRole('button', { name: 'إغلاق' }).click();
    await nav(page, 'مستكشف الأحداث');
    await nav(page, 'الحوادث');
    const shelf = page.getByRole('region', { name: 'استعادة تحقيقات الجلسة' });
    assert.equal(await shelf.isVisible(), true);
    await shelf.getByRole('button', { name: 'استعادة تحقيق INC-2026-083' }).click();
    assert.equal(
      await notebook(page).getByLabel('ملاحظة جديدة للحادثة').inputValue(),
      'مسودة حادثة ثانية مستقلة',
    );
    await addCase(page, 'INC-2026-084');
    await drawer(page).getByRole('button', { name: 'المهام والملاحظات' }).click();
    assert.equal(
      await notebook(page).locator('.case-notes li').count(),
      1,
      'removing tab did not delete session notebook',
    );
    const stored = await page.evaluate(() => Object.values(localStorage).join('|'));
    assert.equal(stored.includes('مسودة حادثة ثانية مستقلة'), false);
    assert.equal(stored.includes('سبب مسودة غير مسجّلة'), false);
    await noOverflow(page, `${theme}/${width}/notebook`);
    clean(run);
    console.log(
      `PASS ${theme}/${width}: tab isolation, pin confirmation, scroll/trail restoration, drafts, images, references, ordering, graph and session shelf`,
    );
  } finally {
    await run.context.close();
  }
}
for (const [name, engine] of [
  ['Chromium', chromium],
  ['Firefox', firefox],
  ['WebKit', webkit],
]) {
  const browser = await engine.launch({
    headless: true,
    ...(name === 'Chromium' ? { args: ['--no-sandbox'] } : {}),
  });
  try {
    await exercise(browser, { width: 1440, theme: 'dark' });
    await exercise(browser, { width: 320, theme: 'light' });
    console.log(`PASS 1.5 workflows · ${name}`);
  } finally {
    await browser.close();
  }
}
// Logout and reload must clear both persisted and unsubmitted analyst content.
{
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] }),
    run = await newPage(browser, {}),
    { page } = run;
  try {
    await login(page);
    await openCase(page);
    await drawer(page).getByRole('button', { name: 'المهام والملاحظات' }).click();
    await notebook(page).getByLabel('ملاحظة جديدة للحادثة').fill('مسودة يجب محوها');
    await drawer(page).getByRole('button', { name: 'إغلاق' }).click();
    await page.getByRole('button', { name: 'قائمة الحساب' }).click();
    await page.getByRole('button', { name: 'تسجيل الخروج التجريبي' }).click();
    await login(page);
    await nav(page, 'الحوادث');
    assert.equal(await page.getByRole('region', { name: 'استعادة تحقيقات الجلسة' }).count(), 0);
    await page.locator('table tbody tr').filter({ hasText: 'INC-2026-084' }).click();
    await drawer(page).getByRole('button', { name: 'المهام والملاحظات' }).click();
    assert.equal(await notebook(page).getByLabel('ملاحظة جديدة للحادثة').inputValue(), '');
    await notebook(page).getByLabel('ملاحظة جديدة للحادثة').fill('مسودة تختفي بالتحديث');
    await page.reload();
    await login(page);
    await openCase(page);
    await drawer(page).getByRole('button', { name: 'المهام والملاحظات' }).click();
    assert.equal(await notebook(page).getByLabel('ملاحظة جديدة للحادثة').inputValue(), '');
    clean(run);
    console.log('PASS logout/reload clear 1.5 drafts and tab registry');
  } finally {
    await run.context.close();
    await browser.close();
  }
}
// The in-app file viewer has an opaque origin and no network permission.
for (const [name, engine] of [
  ['Chromium', chromium],
  ['Firefox', firefox],
  ['WebKit', webkit],
]) {
  const browser = await engine.launch({
      headless: true,
      ...(name === 'Chromium' ? { args: ['--no-sandbox'] } : {}),
    }),
    context = await browser.newContext({ viewport: { width: 390, height: 844 } }),
    page = await context.newPage(),
    errors = [],
    requests = [];
  try {
    page.on('pageerror', e => errors.push(e.message));
    await context.route(/^https?:\/\//, route => {
      requests.push(route.request().url());
      return route.abort();
    });
    await page.setContent(
      '<iframe title="isolated" sandbox="allow-scripts" style="width:100%;height:820px;border:0"></iframe>',
    );
    await page.locator('iframe').evaluate(
      (el, html) => {
        el.srcdoc = html;
      },
      fs.readFileSync('dist/index.html', 'utf8'),
    );
    const frame = page.frameLocator('iframe');
    await login(frame);
    await openCase(frame);
    await drawer(frame).getByRole('button', { name: 'المهام والملاحظات' }).click();
    await notebook(frame).getByLabel('ملاحظة جديدة للحادثة').fill('مسودة في المعاينة');
    await addCase(frame, 'INC-2026-083');
    await switchTo(frame, 'INC-2026-084');
    assert.equal(
      await notebook(frame).getByLabel('ملاحظة جديدة للحادثة').inputValue(),
      'مسودة في المعاينة',
    );
    assert.deepEqual(errors, []);
    assert.deepEqual(requests, []);
    console.log(`PASS ${name} · opaque offline iframe workspace`);
  } finally {
    await context.close();
    await browser.close();
  }
}
console.log('PASS 1.5 UI-only workflows; no backend or human usability claim.');
