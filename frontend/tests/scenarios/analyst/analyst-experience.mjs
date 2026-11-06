// 1.4.0 analyst UX: this tests local, fabricated UI behavior, not SOC services.
import fs from 'node:fs';
import { chromium, firefox, webkit } from 'playwright';
import {
  assert,
  builtUrl,
  newPage,
  login,
  nav,
  noOverflow,
  clean,
} from '../../support/helpers.mjs';
import {
  initialAlerts,
  initialIncidents,
  initialAssets,
  sourceCards,
  events,
} from '../../../src/data/fixtures/demo-records.js';
import {
  buildAnalystGraph,
  graphNeighbors,
  graphLayers,
} from '../../../src/features/investigations/graph/analyst-graph.js';
import {
  NETWORK_ASSET_TIME_FIXTURE,
  networkView,
  networkHeatmap,
} from '../../../src/features/network/network-data.js';

const graph = buildAnalystGraph(
  {
    alerts: initialAlerts,
    incidents: initialIncidents,
    assets: initialAssets,
    sources: sourceCards,
  },
  events,
  '24h',
);
assert.ok(graph.nodes.length >= 40 && graph.edges.length >= 50);
assert.ok(
  graph.edges.every(edge => edge.evidence.length > 0),
  'every edge has actual fixture provenance',
);
const edge = (a, b) => graph.edges.find(e => (e.a === a && e.b === b) || (e.a === b && e.b === a));
assert.equal(edge('incident:INC-2026-084', 'alert:ALT-1284').evidence[0].id, 'ALT-1284');
assert.equal(edge('event:EVT-90481', 'alert:ALT-1284').evidence[0].id, 'EVT-90481');
assert.ok(edge('event:EVT-90481', 'asset:AST-001'));
assert.ok(graphNeighbors(graph, 'event:EVT-90481').some(x => x.node.kind === 'user'));
assert.ok(
  graphLayers('incident:INC-2026-084', ['incident:INC-2026-084', 'alert:ALT-1284'], graph.edges)
    .length === 2,
);
for (const period of ['1h', '24h', '7d']) {
  const inside = networkHeatmap(networkView(period, 'in')),
    outside = networkHeatmap(networkView(period, 'out'));
  const all = networkHeatmap(networkView(period, 'both'));
  assert.deepEqual(
    all,
    networkHeatmap(networkView(period, 'both', 'spike')),
    'independent fixture, not a calculation from spike aggregate',
  );
  for (let i = 0; i < all.length; i++)
    for (let j = 0; j < all[i].cells.length; j++)
      assert.equal(all[i].cells[j].count, inside[i].cells[j].count + outside[i].cells[j].count);
}
for (const row of networkHeatmap(networkView('1h', 'in'))) {
  const explicit = NETWORK_ASSET_TIME_FIXTURE.find(x => x.id === row.id)
    .samples.slice(-12)
    .reduce((sum, x) => sum + x.incoming, 0);
  assert.equal(
    row.cells.reduce((sum, x) => sum + x.count, 0),
    explicit,
    '1h aggregation comes from explicit per-asset/time data',
  );
}
console.log(
  `PASS graph provenance ${graph.nodes.length} nodes/${graph.edges.length} relationships; independent asset/time fixture`,
);

const drawer = root => root.locator('.detail-layer-active .drawer');
const close = async root => drawer(root).getByRole('button', { name: 'إغلاق' }).click();
async function openAlert(root, id = 'ALT-1284') {
  await nav(root, 'التنبيهات');
  await root.locator('table tbody tr').filter({ hasText: id }).click();
}
async function openCase(root, id = 'INC-2026-084') {
  await nav(root, 'الحوادث');
  await root.locator('table tbody tr').filter({ hasText: id }).click();
}
async function recordTriage(d, reason) {
  const box = d.locator('.triage-assistant');
  await box.locator('summary').click();
  await box.getByLabel('قرار مراجعة التنبيه', { exact: true }).selectOption('unknown');
  await box.getByLabel('أولوية مراجعة التنبيه', { exact: true }).selectOption('p2');
  await box.getByLabel('سبب قرار مراجعة التنبيه').fill(reason);
  await box.getByRole('button', { name: 'معاينة القرار' }).click();
  const preview = box.getByRole('region', { name: 'معاينة قرار المراجعة' });
  assert.match(await preview.innerText(), /لم يُسجّل بعد/);
  await preview.getByRole('button', { name: 'تأكيد تسجيل القرار' }).click();
  return box;
}
const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRqkAAAAASUVORK5CYII=',
  'base64',
);
async function exercise(browser, { width, theme }) {
  const run = await newPage(browser, { width, height: 860, theme }),
    { page } = run;
  try {
    await login(page);
    await openAlert(page);
    let d = drawer(page),
      box = d.locator('.triage-assistant');
    const severityBefore = (await d.locator('.detail-badges').innerText()).split('\n')[0];
    await box.locator('summary').click();
    await box.getByRole('button', { name: 'معاينة القرار' }).click();
    assert.match(await box.getByRole('alert').innerText(), /اختر القرار/);
    await box.getByLabel('قرار مراجعة التنبيه', { exact: true }).selectOption('unknown');
    await box.getByLabel('أولوية مراجعة التنبيه', { exact: true }).selectOption('p2');
    await box.getByLabel('سبب قرار مراجعة التنبيه').fill('القرار غير محسوم حتى مراجعة السجل.');
    await box.getByRole('button', { name: 'معاينة القرار' }).click();
    assert.equal(await box.locator('.triage-history li').count(), 0, 'preview does not record');
    assert.match(await d.locator('.detail-badges').innerText(), /جديد/);
    await box
      .getByRole('region', { name: 'معاينة قرار المراجعة' })
      .getByRole('button', { name: 'تأكيد تسجيل القرار' })
      .click();
    assert.equal(await box.locator('.triage-history li').count(), 1);
    assert.equal(
      await page.locator('.undo-banner').count(),
      0,
      'undo does not obscure an open drawer',
    );
    assert.match(await d.locator('.detail-badges').innerText(), /تمت المراجعة/);
    assert.match(
      await d.locator('.detail-badges').innerText(),
      new RegExp(severityBefore),
      'triage must not change severity',
    );
    await close(page);
    await page.locator('.undo-banner').getByRole('button', { name: 'تراجع', exact: true }).click();
    await page.locator('table tbody tr').filter({ hasText: 'ALT-1284' }).click();
    d = drawer(page);
    box = d.locator('.triage-assistant');
    await box.locator('summary').click();
    assert.equal(await box.locator('.triage-history li').count(), 0);
    assert.match(
      await d.locator('.detail-badges').innerText(),
      /جديد/,
      'undo restores status and decision together',
    );
    await box.locator('summary').click();
    box = await recordTriage(d, 'المراجعة البشرية مطلوبة دون استنتاج نجاح.');
    assert.match(await box.innerText(), /وقت الجهاز/);
    await close(page);

    await openCase(page);
    d = drawer(page);
    const focus = d.getByRole('button', { name: 'وضع التركيز' });
    await focus.click();
    assert.equal(await d.locator('.risk-explanation').isVisible(), false);
    assert.equal(await d.getByRole('button', { name: 'إنهاء التركيز' }).isVisible(), true);
    await d.getByRole('button', { name: 'بدء تحقيق موجّه' }).click();
    let guide = d.getByRole('region', { name: 'التحقيق الموجّه للحادثة' });
    await page.waitForFunction(
      () => document.activeElement?.getAttribute('aria-label') === 'التحقيق الموجّه للحادثة',
    );
    assert.equal(await guide.getByRole('progressbar').getAttribute('value'), '1');
    await guide.getByRole('button', { name: 'إيقاف مؤقت' }).click();
    await page.waitForFunction(() =>
      document.activeElement?.matches(
        '.detail-layer-active .case-workspace-primary button:first-child',
      ),
    );
    await d.getByRole('button', { name: 'استئناف التحقيق الموجّه' }).click();
    guide = d.getByRole('region', { name: 'التحقيق الموجّه للحادثة' });
    assert.equal(await guide.getByRole('progressbar').getAttribute('value'), '1');
    await guide.getByRole('button', { name: 'التالي', exact: true }).click();
    await guide.getByRole('button', { name: 'فتح مستكشف التحقيق' }).click();
    let explorer = d.getByRole('region', { name: 'مستكشف التحقيق التفاعلي' });
    await page.waitForFunction(
      () => document.activeElement?.getAttribute('aria-label') === 'مستكشف التحقيق التفاعلي',
    );
    assert.match(
      await explorer.locator('.analyst-inspector-head').innerText(),
      /الحادثة المفتوحة حاليًا/,
    );
    assert.equal(
      await explorer
        .getByRole('button', { name: 'فتح السجل المرجعي INC-2026-084', exact: true })
        .count(),
      0,
      'the already-open incident is not a dead action',
    );
    const list = (await explorer.locator('.analyst-canvas').isVisible())
      ? explorer.locator('.analyst-canvas')
      : explorer.locator('.analyst-node-list');
    await list
      .getByRole('button', { name: 'تنبيه محاولات مصادقة فاشلة متكررة ALT-1284', exact: true })
      .click();
    await explorer.getByRole('button', { name: /توسيع العلاقات/ }).click();
    assert.match(await explorer.locator('.analyst-inspector').innerText(), /EVT-90481/);
    await explorer
      .getByRole('button', { name: 'فتح السجل المرجعي EVT-90481', exact: true })
      .click();
    assert.match(await drawer(page).innerText(), /EVT-90481/);
    await drawer(page).getByRole('button', { name: 'العودة للسجل السابق' }).click();
    d = drawer(page);
    explorer = d.getByRole('region', { name: 'مستكشف التحقيق التفاعلي' });
    assert.match(
      await explorer.locator('.analyst-inspector-head').innerText(),
      /ALT-1284/,
      'selected graph context survives nested detail',
    );
    await d.getByRole('button', { name: 'إغلاق المستكشف' }).click();
    await page.waitForFunction(() =>
      document.activeElement?.matches(
        '.detail-layer-active .case-workspace-primary button:last-child',
      ),
    );
    await d.getByRole('button', { name: 'مستكشف التحقيق', exact: true }).click();
    explorer = d.getByRole('region', { name: 'مستكشف التحقيق التفاعلي' });
    assert.match(
      await explorer.locator('.analyst-inspector-head').innerText(),
      /ALT-1284/,
      'case graph selection is restored after closing it',
    );
    await d.getByRole('button', { name: 'استئناف التحقيق الموجّه' }).click();
    guide = d.getByRole('region', { name: 'التحقيق الموجّه للحادثة' });
    assert.equal(await guide.getByRole('progressbar').getAttribute('value'), '2');
    await guide.getByRole('button', { name: 'التالي', exact: true }).click();
    await guide.getByRole('button', { name: 'فتح دفتر الحادثة' }).click();
    let notebook = d.getByRole('region', { name: 'قائمة مهام وملاحظات الحادثة' });
    await notebook.getByLabel('نوع الملاحظة').selectOption('hypothesis');
    await notebook.getByLabel('ربط الملاحظة بسجل').selectOption('event|EVT-90481');
    await notebook.getByLabel('ملاحظة جديدة للحادثة').fill('قد يكون النشاط آليًا؛ يلزم التحقق.');
    await notebook.getByRole('button', { name: 'إضافة ملاحظة' }).click();
    await notebook.getByLabel('نوع الملاحظة').selectOption('question');
    await notebook.getByLabel('ربط الملاحظة بسجل').selectOption('incident|INC-2026-084');
    await notebook.getByLabel('ملاحظة جديدة للحادثة').fill('هل يوجد حدث نجاح مرتبط؟');
    await notebook
      .getByLabel('اختيار صورة توضيحية للملاحظة')
      .setInputFiles({ name: 'invalid.txt', mimeType: 'text/plain', buffer: Buffer.from('x') });
    assert.match(await notebook.getByRole('alert').innerText(), /PNG أو JPEG أو WebP/);
    await notebook.getByLabel('اختيار صورة توضيحية للملاحظة').setInputFiles({
      name: 'large.png',
      mimeType: 'image/png',
      buffer: Buffer.alloc(1024 * 1024 + 1),
    });
    assert.match(await notebook.getByRole('alert').innerText(), /الحد الأقصى/);
    await notebook
      .getByLabel('اختيار صورة توضيحية للملاحظة')
      .setInputFiles({ name: 'local.png', mimeType: 'image/png', buffer: png });
    await notebook.getByAltText('معاينة الصورة المختارة مؤقتًا').waitFor();
    await notebook.getByRole('button', { name: 'إضافة ملاحظة' }).click();
    assert.equal(await notebook.locator('.case-notes li').count(), 2);
    assert.equal(await notebook.locator('.analyst-note-image img').count(), 1);
    await notebook.getByRole('button', { name: 'تثبيت الملاحظة ٢' }).click();
    assert.match(await notebook.locator('.case-notes').innerText(), /مرجعية/);
    await notebook.getByRole('button', { name: 'تعليم السؤال كمجاب' }).click();
    assert.match(await notebook.innerText(), /أجاب المحلل/);
    await notebook.getByRole('button', { name: 'إعادة فتح السؤال' }).click();
    await notebook
      .locator('.case-notes li')
      .nth(1)
      .getByRole('button', { name: /فتح السجل المرتبط/ })
      .click();
    await page.waitForFunction(() =>
      document.activeElement?.matches('.detail-layer-active .analyst-case-title h3'),
    );
    await d.getByRole('button', { name: 'المهام والملاحظات' }).click();
    notebook = d.getByRole('region', { name: 'قائمة مهام وملاحظات الحادثة' });
    await notebook
      .locator('.case-notes li')
      .first()
      .getByRole('button', { name: /فتح السجل المرتبط/ })
      .click();
    assert.match(await drawer(page).innerText(), /EVT-90481/);
    await drawer(page).getByRole('button', { name: 'العودة للسجل السابق' }).click();
    d = drawer(page);
    assert.equal(await d.locator('.case-notes li').count(), 2);
    await d.getByRole('button', { name: 'الخط الزمني', exact: true }).click();
    await d.getByRole('button', { name: 'قصة التحقيق' }).click();
    const story = d.getByRole('region', { name: 'قصة التحقيق التجريبية' });
    const storyText = await story.innerText();
    assert.match(storyText, /EVT-90481/);
    assert.match(storyText, /النتيجة: فشل/);
    assert.match(storyText, /قد يكون النشاط آليًا/);
    assert.match(storyText, /هل يوجد حدث نجاح/);
    assert.match(storyText, /المراجعة البشرية مطلوبة دون استنتاج نجاح/);
    assert.match(storyText, /لا يثبت تسلسل هجوم/);
    await noOverflow(page, `${theme}/${width}/case`);
    await story
      .locator('.story-card.unknown')
      .getByRole('button', { name: 'فتح السجل المرتبط' })
      .click();
    await page.waitForFunction(() =>
      document.activeElement?.matches('.detail-layer-active .analyst-case-title h3'),
    );
    await close(page);
    await openCase(page);
    d = drawer(page);
    assert.equal(
      await d.getByRole('button', { name: 'إنهاء التركيز' }).isVisible(),
      true,
      'case focus saved in memory',
    );
    await d.getByRole('button', { name: 'المهام والملاحظات' }).click();
    assert.equal(await d.locator('.case-notes li').count(), 2);
    await close(page);
    await openCase(page, 'INC-2026-083');
    d = drawer(page);
    await d.getByRole('button', { name: 'المهام والملاحظات' }).click();
    assert.equal(await d.locator('.case-notes li').count(), 0, 'notes isolated by incident');
    await close(page);

    await nav(page, 'خريطة العلاقات');
    await page.getByRole('button', { name: 'مستكشف التحقيق', exact: true }).click();
    explorer = page.getByRole('region', { name: 'مستكشف التحقيق التفاعلي' });
    assert.match(await explorer.innerText(), /ليست طوبولوجيا/);
    assert.match(await page.locator('.relationship-stats').innerText(), /٥٢/);
    assert.match(await page.locator('.relationship-stats').innerText(), /٦٦/);
    await explorer.getByLabel('بداية مستكشف التحقيق').selectOption('event:EVT-90481');
    assert.match(await explorer.locator('.analyst-inspector').innerText(), /EVT-90481/);
    await noOverflow(page, `${theme}/${width}/graph`);

    await nav(page, 'تحليل الشبكة');
    const heat = page.getByRole('region', { name: 'خريطة محاولات الشبكة الحرارية' });
    assert.match(await heat.innerText(), /مستقلة عن إجماليات الشبكة/);
    if (width > 760) {
      const current = heat.locator('.heatmap-cell[tabindex="0"]'),
        before = await current.getAttribute('aria-label');
      await current.focus();
      await current.press('ArrowRight');
      assert.notEqual(
        await heat.locator('.heatmap-cell[tabindex="0"]').getAttribute('aria-label'),
        before,
      );
    } else {
      await heat.getByLabel('أصل الخريطة الحرارية').selectOption({ index: 1 });
      await heat.locator('.heatmap-mobile-cells button').nth(2).click();
      assert.equal(
        await heat.locator('.heatmap-mobile-cells button').nth(2).getAttribute('aria-pressed'),
        'true',
      );
    }
    await heat.getByRole('button', { name: 'فتح الأصل' }).click();
    assert.equal(await drawer(page).isVisible(), true);
    await close(page);
    await page.getByLabel('الفترة الزمنية لتحليل الشبكة').selectOption('7d');
    await page.getByLabel('اتجاه حركة الشبكة').selectOption('out');
    const protocol = page.locator('.network-protocols-panel');
    await protocol
      .locator('.network-distribution-group')
      .first()
      .getByRole('button', { name: /TCP/ })
      .click();
    assert.match(await protocol.locator('.protocol-explorer').innerText(), /8443/);
    await protocol
      .locator('.network-distribution-group')
      .first()
      .getByRole('button', { name: /UDP/ })
      .click();
    assert.match(
      await protocol.locator('.protocol-explorer').innerText(),
      /لا توجد في العينة تفاصيل/,
    );
    await noOverflow(page, `${theme}/${width}/heatmap`);
    const privateStored = await page.evaluate(() =>
      Object.values(localStorage).some(
        x =>
          String(x).includes('قد يكون النشاط آليًا') ||
          String(x).includes('المراجعة البشرية مطلوبة دون استنتاج نجاح'),
      ),
    );
    assert.equal(privateStored, false, 'notes and reasons are not written to localStorage');
    await nav(page, 'الإعدادات');
    await page.getByRole('switch', { name: 'محاكاة انقطاع الاتصال' }).click();
    await openCase(page);
    d = drawer(page);
    await d.getByRole('button', { name: 'المهام والملاحظات' }).click();
    notebook = d.getByRole('region', { name: 'قائمة مهام وملاحظات الحادثة' });
    assert.equal(await notebook.locator('.case-notes li').count(), 2);
    assert.equal(await notebook.getByLabel('ملاحظة جديدة للحادثة').isDisabled(), true);
    await close(page);
    await openAlert(page);
    d = drawer(page);
    await d.locator('.triage-assistant summary').click();
    assert.equal(await d.locator('.triage-history li').count(), 1);
    assert.equal(await d.getByLabel('سبب قرار مراجعة التنبيه').isDisabled(), true);
    await close(page);
    await page.getByRole('button', { name: 'إنهاء المحاكاة' }).click();
    // New analyst content is cleared by reload, not persisted in app storage.
    await page.reload();
    await login(page);
    await openCase(page);
    d = drawer(page);
    await d.getByRole('button', { name: 'المهام والملاحظات' }).click();
    assert.equal(await d.locator('.case-notes li').count(), 0);
    await close(page);
    await openAlert(page);
    d = drawer(page);
    await d.locator('.triage-assistant summary').click();
    assert.equal(await d.locator('.triage-history li').count(), 0);
    await close(page);
    clean(run);
    console.log(
      `PASS ${theme}/${width}: guided, graph, notebook, storyboard, triage/undo, focus, heatmap/protocol, offline and reload`,
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
    console.log(`PASS analyst interactions · ${name}`);
  } finally {
    await browser.close();
  }
}

// Verify logout clears both investigations and triage, without assuming reload.
{
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] }),
    run = await newPage(browser, {}),
    { page } = run;
  try {
    await login(page);
    await openAlert(page);
    await recordTriage(drawer(page), 'سبب مؤقت للخروج.');
    await close(page);
    await openCase(page);
    let d = drawer(page);
    await d.getByRole('button', { name: 'المهام والملاحظات' }).click();
    await d.getByLabel('ملاحظة جديدة للحادثة').fill('ملاحظة مؤقتة للخروج.');
    await d.getByRole('button', { name: 'إضافة ملاحظة' }).click();
    await close(page);
    await page.getByRole('button', { name: 'قائمة الحساب' }).click();
    await page.getByRole('button', { name: 'تسجيل الخروج التجريبي' }).click();
    await login(page);
    await openAlert(page);
    d = drawer(page);
    await d.locator('.triage-assistant summary').click();
    assert.equal(await d.locator('.triage-history li').count(), 0);
    assert.match(await d.locator('.detail-badges').innerText(), /جديد/);
    await close(page);
    await openCase(page);
    d = drawer(page);
    await d.getByRole('button', { name: 'المهام والملاحظات' }).click();
    assert.equal(await d.locator('.case-notes li').count(), 0);
    clean(run);
    console.log('PASS logout clears local triage and notebook');
  } finally {
    await run.context.close();
    await browser.close();
  }
}

// User's in-app preview: opaque-origin sandbox, no network or external resources.
for (const [name, engine] of [
  ['Chromium', chromium],
  ['Firefox', firefox],
  ['WebKit', webkit],
]) {
  const browser = await engine.launch({
      headless: true,
      ...(name === 'Chromium' ? { args: ['--no-sandbox'] } : {}),
    }),
    context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      reducedMotion: 'reduce',
    }),
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
    let d = drawer(frame);
    await d.getByRole('button', { name: 'بدء تحقيق موجّه' }).click();
    let g = d.getByRole('region', { name: 'التحقيق الموجّه للحادثة' });
    await g.getByRole('button', { name: 'التالي', exact: true }).click();
    await g.getByRole('button', { name: 'فتح مستكشف التحقيق' }).click();
    assert.equal(
      await d.getByRole('region', { name: 'مستكشف التحقيق التفاعلي' }).isVisible(),
      true,
    );
    await d.getByRole('button', { name: 'المهام والملاحظات' }).click();
    await d.getByLabel('ملاحظة جديدة للحادثة').fill('ملاحظة في معاينة معزولة.');
    await d.getByRole('button', { name: 'إضافة ملاحظة' }).click();
    assert.match(await d.innerText(), /ملاحظة في معاينة معزولة/);
    await close(frame);
    await openAlert(frame);
    d = drawer(frame);
    await recordTriage(d, 'سبب المراجعة في المعاينة.');
    assert.equal(await d.locator('.triage-history li').count(), 1);
    assert.deepEqual(errors, []);
    assert.deepEqual(requests, []);
    console.log(`PASS ${name} · opaque offline iframe new controls`);
  } finally {
    await context.close();
    await browser.close();
  }
}
console.log(
  'PASS analyst-experience demo tests; no operational or accessibility certification claimed.',
);
