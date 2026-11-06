// Professional SOC experience: session context, named views, commands and demo-only workflows.
import fs from 'node:fs';
import { chromium, firefox, webkit } from 'playwright';
import { assert, builtUrl, login, nav, noOverflow } from '../../support/helpers.mjs';

const html = fs.readFileSync('dist/index.html', 'utf8');
const searchLabel = 'ابحث عن حادثة، تنبيه، أصل، مصدر بيانات أو عنوان IP أو MAC';
const drawer = root => root.locator('.detail-layer-active .drawer');
const center = root => root.getByRole('dialog', { name: 'البحث في المنصة' });
async function topbarCollisions(page) {
  return page.locator('.topbar').evaluate(el => {
    const buttons = [...el.querySelectorAll('button')]
        .filter(b => getComputedStyle(b).display !== 'none' && b.getClientRects().length)
        .map(b => ({
          name: b.getAttribute('aria-label') || b.className,
          box: b.getBoundingClientRect(),
        })),
      hits = [];
    for (let i = 0; i < buttons.length; i++)
      for (let j = i + 1; j < buttons.length; j++) {
        const a = buttons[i],
          b = buttons[j];
        if (
          Math.min(a.box.right, b.box.right) - Math.max(a.box.left, b.box.left) > 1 &&
          Math.min(a.box.bottom, b.box.bottom) - Math.max(a.box.top, b.box.top) > 1
        )
          hits.push([a.name, b.name]);
      }
    return hits;
  });
}
async function forceLogin(root) {
  for (const text of [
    'استخدام بيانات تجريبية',
    'المتابعة إلى التحقق',
    'ملء الرمز',
    'التحقق والدخول',
  ])
    await root.getByText(text, { exact: true }).click({ force: true });
  await root.locator('#primary-navigation').waitFor({ state: 'attached' });
}
async function testExperience(browser, name, theme, width) {
  const context = await browser.newContext({
      viewport: { width, height: width < 500 ? 780 : 900 },
      reducedMotion: 'reduce',
    }),
    errors = [],
    external = [];
  try {
    const page = await context.newPage();
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => {
      if (m.type() === 'error') errors.push(m.text());
    });
    await context.route(/^https?:\/\//, r => {
      external.push(r.request().url());
      return r.abort();
    });
    await page.goto(builtUrl);
    await login(page);
    if (theme === 'light') await page.getByRole('button', { name: 'تفعيل المظهر الفاتح' }).click();
    const customize = page.locator('.dashboard-customize');
    await customize.locator('summary').first().click();
    const editor = customize.locator('.dashboard-widgets-editor');
    await editor.getByRole('checkbox', { name: 'يحتاج انتباهك', exact: true }).uncheck();
    assert.equal(await page.locator('.attention-panel').count(), 0);
    await editor.getByRole('checkbox', { name: 'يحتاج انتباهك', exact: true }).check();
    const layoutViews = customize.locator('.named-views');
    await layoutViews.locator('summary').click();
    await layoutViews.getByLabel('اسم عرض اللوحة').fill('تخطيط فريقي');
    await layoutViews.getByRole('button', { name: 'حفظ العرض' }).click();
    assert.match(await layoutViews.locator('[role=status]').innerText(), /حُفظت/);
    await editor.getByRole('checkbox', { name: 'يحتاج انتباهك', exact: true }).uncheck();
    await layoutViews.getByLabel('العروض المحفوظة اللوحة').selectOption({ label: 'تخطيط فريقي' });
    await layoutViews.getByRole('button', { name: 'تطبيق', exact: true }).click();
    assert.equal(
      await editor.getByRole('checkbox', { name: 'يحتاج انتباهك', exact: true }).isChecked(),
      true,
    );
    await page.getByRole('button', { name: 'وضع العرض الكبير' }).click();
    assert.equal(
      await page.locator('.app-shell').evaluate(el => el.classList.contains('presentation-mode')),
      true,
    );
    await page.getByRole('button', { name: 'إنهاء العرض الكبير' }).click();
    await nav(page, 'الحوادث');
    assert.deepEqual(
      await topbarCollisions(page),
      [],
      `${name}/${theme}/${width}: topbar controls do not overlap`,
    );
    const compare = page.locator('.record-comparison');
    await compare.locator('summary').click();
    assert.ok((await compare.locator('.comparison-fields>div').count()) >= 5);
    assert.match(await compare.innerText(), /ليست تحليلًا آليًا/);
    await compare.getByLabel('السجل الثاني في مقارنة الحوادث').selectOption({ index: 0 });
    assert.match(await compare.locator('.comparison-actions').innerText(), /٠ حقول مختلفة/);
    const input = page.getByPlaceholder('بحث برقم الحادثة، الأصل، المسؤول...');
    await input.fill('INC-2026-084');
    await page.getByLabel('الخطورة', { exact: true }).selectOption('حرجة');
    await page.getByLabel('ترتيب الحوادث').selectOption('score');
    await page
      .getByRole('button', { name: /الأعمدة/ })
      .first()
      .click();
    const orderBefore = await page.locator('.data-panel thead th').allTextContents();
    await page.getByRole('button', { name: 'تقديم عمود الحالة' }).click();
    const orderAfter = await page.locator('.data-panel thead th').allTextContents();
    assert.notDeepEqual(orderAfter, orderBefore, 'column ordering updates the table');
    const named = page.locator('.data-panel .named-views');
    await named.locator('summary').click();
    await named.getByLabel('اسم عرض الحوادث').fill('فرز الأولويات');
    await named.getByRole('button', { name: 'حفظ العرض' }).click();
    const stored = await page.evaluate(() =>
      localStorage.getItem('nexora-ui-named-views-v1:incidents'),
    );
    assert.ok(stored);
    assert.doesNotMatch(
      stored,
      /INC-2026-084|198\.51\.100/,
      'free text and records must not be persisted',
    );
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2));
    const scrollBefore = await page.evaluate(() => window.scrollY);
    await nav(page, 'الأصول');
    await page.getByRole('button', { name: 'العودة للصفحة السابقة' }).click();
    assert.equal(
      await input.inputValue(),
      'INC-2026-084',
      'search survives page navigation in session',
    );
    assert.equal(await page.getByLabel('الخطورة', { exact: true }).inputValue(), 'حرجة');
    assert.equal(await page.getByLabel('ترتيب الحوادث').inputValue(), 'score');
    assert.deepEqual(await page.locator('.data-panel thead th').allTextContents(), orderAfter);
    await page.waitForTimeout(250);
    assert.ok(
      (await page.evaluate(() => window.scrollY)) > 0 || scrollBefore < 50,
      'back restores scroll position when possible',
    );
    await page.locator('.data-panel tbody tr').filter({ hasText: 'INC-2026-084' }).click();
    let detail = drawer(page);
    await detail.waitFor();
    assert.match(await detail.locator('.case-workspace-overview').innerText(), /لا تثبت انتقالًا/);
    if (width >= 761) {
      await detail.getByRole('button', { name: 'توسيع مساحة التحقيق' }).click();
      assert.ok(await detail.evaluate(el => el.classList.contains('drawer-expanded')));
      await detail.getByRole('button', { name: 'تصغير مساحة التحقيق' }).click();
    }
    // Open the command center while the drawer is active and follow a real linked record.
    await detail.locator('.drawer-header h2').focus();
    await page.keyboard.press('Alt+k');
    let dialog = center(page);
    await dialog.waitFor();
    assert.match(await dialog.innerText(), /سياق التحقيق/);
    await dialog
      .locator('.search-results')
      .getByRole('button', { name: /فتح الأصل المرتبط بالحادثة/ })
      .click();
    assert.match(await drawer(page).innerText(), /AST-001/);
    await drawer(page).getByRole('button', { name: 'العودة للسجل السابق' }).click();
    detail = drawer(page);
    await detail.getByRole('button', { name: 'الخط الزمني', exact: true }).click();
    const selected = detail.locator('.timeline-selected');
    await selected.waitFor();
    const first = await selected.innerText();
    const next = detail.getByRole('button', { name: 'التالي زمنيًا' });
    if (await next.isEnabled()) {
      await next.click();
      assert.notEqual(await selected.innerText(), first);
    }
    await detail.getByLabel('تكبير الخط الزمني').selectOption('focus');
    assert.match(await detail.innerText(), /الخط الزمني الموحّد/);
    await detail.getByRole('button', { name: 'إغلاق' }).click();
    await page.getByRole('button', { name: 'البحث في المنصة' }).click();
    dialog = center(page);
    const q = dialog.getByLabel(searchLabel);
    await q.fill('قواعد الكشف');
    await q.press('ArrowDown');
    assert.equal(
      await dialog.locator('[data-command-result]:focus').count(),
      1,
      'arrow keys focus results',
    );
    const pageResults = dialog.locator('.search-results section[aria-label="نتائج الصفحات"]');
    await pageResults.getByRole('button', { name: /قواعد الكشف/ }).click();
    assert.match(await page.locator('.page-heading h1').innerText(), /قواعد الكشف/);
    const studio = page.locator('.rule-studio');
    await studio.locator('summary').click();
    await studio.getByRole('button', { name: 'إضافة شرط وصفي' }).click();
    await studio.getByLabel('قيمة شرط القاعدة ١').fill('قيمة توضيحية');
    assert.match(await studio.innerText(), /لا تُنفّذ/);
    await nav(page, 'الأصول');
    const ac = page.locator('.record-comparison');
    await ac.locator('summary').click();
    assert.ok((await ac.locator('.comparison-fields>div').count()) > 0);
    await nav(page, 'التقارير');
    const report = page.locator('.report-designer');
    await report.locator('summary').click();
    const preview = report.locator('.designer-preview');
    assert.match(await preview.locator('section strong').first().innerText(), /الملخص/);
    await report.getByRole('button', { name: 'تقديم قسم الحوادث المفصّلة' }).click();
    assert.match(await preview.locator('section strong').first().innerText(), /الحوادث/);
    await report.getByRole('button', { name: 'تصدير بيانات المعاينة CSV' }).click();
    const exportDialog = page.getByRole('dialog', { name: 'معاينة تصدير CSV' });
    assert.match(
      await exportDialog
        .locator('.export-preview-scroll tbody tr')
        .first()
        .locator('td')
        .first()
        .innerText(),
      /حادثة/,
    );
    await exportDialog.getByRole('button', { name: 'إغلاق' }).click();
    await nav(page, 'خريطة العلاقات');
    const graph = page.locator('.relationship-map-grid');
    const nodesBefore = await graph.locator('.relationship-node').count();
    await graph.locator('.relationship-node').first().click();
    await page.getByLabel('إظهار العقدة المختارة وجيرانها المباشرين فقط').check();
    assert.ok((await graph.locator('.relationship-node').count()) <= nodesBefore);
    assert.match(await page.locator('.relationship-intro').innerText(), /ليست خريطة اتصال فعلية/);
    await page.getByRole('button', { name: 'الإشعارات التجريبية' }).click();
    const notifications = page.getByRole('region', { name: 'مركز الإشعارات التجريبي' });
    await notifications.getByLabel('تجميع الإشعارات').selectOption('incident');
    assert.ok((await notifications.locator('.notification-group-title').count()) > 0);
    await notifications
      .getByRole('button', { name: /تثبيت الإشعار:/ })
      .first()
      .click();
    await notifications.getByRole('button', { name: 'المثبتة', exact: true }).click();
    assert.equal(await notifications.locator('.notification-entry').count(), 1);
    await page.getByRole('button', { name: 'الإشعارات التجريبية' }).click();
    await nav(page, 'الإعدادات');
    const org = page.getByLabel('اسم المؤسسة');
    await org.fill('تعديل تجريبي غير محفوظ');
    await page.getByRole('button', { name: 'العودة للصفحة السابقة' }).click();
    let guard = page.getByRole('dialog', { name: 'إعدادات غير محفوظة' });
    await guard.waitFor();
    await guard.getByRole('button', { name: 'متابعة التعديل' }).click();
    assert.equal(await org.inputValue(), 'تعديل تجريبي غير محفوظ');
    await page.getByRole('button', { name: 'العودة للصفحة السابقة' }).click();
    guard = page.getByRole('dialog', { name: 'إعدادات غير محفوظة' });
    await guard.getByRole('button', { name: 'تجاهل التغييرات والمتابعة' }).click();
    assert.match(await page.locator('.page-heading h1').innerText(), /خريطة العلاقات/);
    await noOverflow(page, `${name}/${theme}/${width} professional`);
    if (name === 'Chromium' && theme === 'dark' && width === 1440) {
      await page.reload();
      await login(page);
      await nav(page, 'الحوادث');
      const restored = page.locator('.data-panel .named-views');
      await restored.locator('summary').click();
      await restored.getByLabel('العروض المحفوظة الحوادث').selectOption({ label: 'فرز الأولويات' });
      await restored.getByRole('button', { name: 'تطبيق', exact: true }).click();
      assert.equal(await page.getByLabel('الخطورة', { exact: true }).inputValue(), 'حرجة');
      assert.equal(await page.getByLabel('ترتيب الحوادث').inputValue(), 'score');
      assert.equal(
        await page.getByPlaceholder('بحث برقم الحادثة، الأصل، المسؤول...').inputValue(),
        '',
        'free-text search is not restored on reload',
      );
      await page.getByPlaceholder('بحث برقم الحادثة، الأصل، المسؤول...').fill('نص جلسة خاص');
      await page.getByRole('button', { name: 'قائمة الحساب' }).click();
      await page.getByRole('button', { name: 'تسجيل الخروج التجريبي' }).click();
      await login(page);
      await nav(page, 'الحوادث');
      assert.equal(
        await page.getByPlaceholder('بحث برقم الحادثة، الأصل، المسؤول...').inputValue(),
        '',
        'logout clears session search',
      );
    }
    assert.deepEqual(errors, []);
    assert.deepEqual(external, []);
    console.log(
      `PASS ${name}/${theme}/${width} · dashboard, session context, views, commands, investigation, comparison, rules, reports and notifications`,
    );
  } finally {
    await context.close();
  }
}
async function testMobileTopbar(browser, name) {
  const context = await browser.newContext({ viewport: { width: 320, height: 800 } });
  try {
    const page = await context.newPage();
    await page.goto(builtUrl);
    await login(page);
    await nav(page, 'الحوادث');
    assert.deepEqual(
      await topbarCollisions(page),
      [],
      `${name}/320: topbar actions do not overlap`,
    );
    await noOverflow(page, `${name}/320 topbar`);
    console.log(`PASS ${name} · 320px compact header controls remain separate`);
  } finally {
    await context.close();
  }
}
async function testSandbox(browser, name) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } }),
    errors = [],
    external = [];
  try {
    const page = await context.newPage();
    page.on('pageerror', e => errors.push(e.message));
    await context.route(/^https?:\/\//, r => {
      external.push(r.request().url());
      return r.abort();
    });
    await page.setContent(
      '<iframe title="offline" sandbox="allow-scripts" style="width:100%;height:850px;border:0"></iframe>',
    );
    await page.locator('iframe').evaluate((el, src) => {
      el.srcdoc = src;
    }, html);
    const frame = page.frameLocator('iframe');
    await forceLogin(frame);
    await frame
      .locator('#primary-navigation')
      .getByText('الحوادث', { exact: true })
      .click({ force: true });
    const named = frame.locator('.data-panel .named-views');
    await named.locator('summary').click({ force: true });
    await named.getByLabel('اسم عرض الحوادث').fill('عرض الجلسة');
    await named.getByRole('button', { name: 'حفظ العرض' }).click({ force: true });
    assert.match(await named.locator('[role=status]').innerText(), /التخزين غير متاح/);
    await frame
      .locator('#primary-navigation')
      .getByText('الأصول', { exact: true })
      .click({ force: true });
    await frame.getByRole('button', { name: 'العودة للصفحة السابقة' }).click({ force: true });
    const again = frame.locator('.data-panel .named-views');
    await again.locator('summary').click({ force: true });
    assert.equal(
      await again.getByLabel('العروض المحفوظة الحوادث').locator('option').count(),
      2,
      'fallback saved within session',
    );
    assert.deepEqual(errors, []);
    assert.deepEqual(external, []);
    console.log(`PASS ${name} · opaque iframe and blocked-storage in-memory fallback`);
  } finally {
    await context.close();
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
    await testExperience(browser, name, 'dark', 1440);
    if (name === 'Chromium') await testExperience(browser, name, 'light', 320);
    else await testMobileTopbar(browser, name);
    await testSandbox(browser, name);
  } finally {
    await browser.close();
  }
}
console.log('PASS professional SOC interface checks (fixture-only; no real backend or AI).');
