// UI-only MAC address regression suite; addresses are fictional, not discovery.
import fs from 'node:fs';
import AxeBuilder from '@axe-core/playwright';
import { normalizeMac, matchesMac } from '../../src/shared/lib/mac.js';
import { assetForRecord, recordBelongsToAsset } from '../../src/features/assets/asset-relations.js';
import { assert, launch, newPage, login, nav, noOverflow, clean } from '../support/helpers.mjs';

for (const input of [
  '02:aa:bb:cc:dd:ee',
  '02-aa-bb-cc-dd-ee',
  '02aa.bbcc.ddee',
  '02aabbccddee',
  ' 02:AA:BB:CC:DD:EE ',
])
  assert.equal(normalizeMac(input), '02:AA:BB:CC:DD:EE');
for (const input of [
  'abc',
  '02:aa-bb:cc:dd:ee',
  '02:aa:gg:cc:dd:ee',
  '00:00:00:00:00:00',
  'FF:FF:FF:FF:FF:FF',
  '03:20:00:01:00:01',
])
  assert.equal(normalizeMac(input), null, input);
assert.equal(normalizeMac(''), '');
assert.equal(normalizeMac('  '), '');
for (const query of ['02-aa-bb-cc-dd-ee', '02AA.BBCC.DDEE', '02aabbccddeE', 'bb-cc'])
  assert.equal(matchesMac('02:AA:BB:CC:DD:EE', query), true, query);
assert.equal(matchesMac('02:AA:BB:CC:DD:EE', 'user'), false);
const duplicates = [
  { id: 'one', name: 'DUP' },
  { id: 'two', name: 'DUP' },
];
assert.equal(assetForRecord(duplicates, { asset: 'DUP' }), undefined);
assert.equal(assetForRecord(duplicates, { asset: 'DUP', assetId: 'one' }).id, 'one');
assert.equal(assetForRecord(duplicates, { asset: 'DUP', assetId: 'missing' }), undefined);
assert.equal(
  recordBelongsToAsset(duplicates, { asset: 'DUP', assetId: 'two' }, duplicates[0]),
  false,
);
console.log('PASS MAC EUI-48 normalization, optional value, input guards and flexible search');
const browser = await launch();
const drawer = page => page.locator('.detail-layer-active .drawer');
async function run(name, options, fn) {
  const run = await newPage(browser, options);
  try {
    await login(run.page);
    await fn(run.page);
    clean(run);
    console.log(`PASS ${name}`);
  } finally {
    await run.context.close();
  }
}
const axeTags = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'];
async function axe(page, where) {
  const result = await new AxeBuilder({ page }).withTags(axeTags).analyze();
  assert.deepEqual(
    result.violations.map(v => ({
      id: v.id,
      impact: v.impact,
      targets: v.nodes.map(n => n.target),
    })),
    [],
    `axe ${where}`,
  );
}
const globalLabel = 'ابحث عن حادثة، تنبيه، أصل، مصدر بيانات أو عنوان IP أو MAC';
try {
  await run('asset MAC in list/search, connected contexts and source cards', {}, async page => {
    await nav(page, 'الأصول');
    assert.equal(await page.getByRole('columnheader', { name: 'عنوان MAC' }).count(), 1);
    let search = page.getByPlaceholder('بحث باسم الأصل أو عنوان IP أو MAC أو المالك');
    await search.fill('02-20-00-01-00-01');
    assert.equal(await page.locator('table tbody tr').count(), 1);
    assert.match(
      await page.locator('table tbody tr').first().innerText(),
      /AD-SRV-01.*02:20:00:01:00:01/s,
    );
    await search.fill('022000010001');
    assert.equal(await page.locator('table tbody tr').count(), 1);
    await page.locator('table tbody tr').first().click();
    let panel = drawer(page);
    assert.match(
      await panel.locator('.detail-grid').innerText(),
      /عنوان MAC للواجهة.*02:20:00:01:00:01/s,
    );
    await panel.getByRole('button', { name: 'إغلاق' }).click();
    await nav(page, 'الحوادث');
    await page.locator('table tbody tr').filter({ hasText: 'INC-2026-084' }).click();
    panel = drawer(page);
    assert.match(
      await panel.locator('.detail-grid').innerText(),
      /MAC الأصل في السجل.*02:20:00:01:00:01/s,
    );
    assert.match(await panel.innerText(), /وليس دليلًا على عنوان مصدر أو وجهة مرصود/);
    await panel.getByRole('button', { name: 'إغلاق' }).click();
    await nav(page, 'التنبيهات');
    await page.locator('table tbody tr').filter({ hasText: 'ALT-1284' }).click();
    panel = drawer(page);
    assert.match(await panel.locator('.detail-grid').innerText(), /02:20:00:01:00:01/);
    await panel.getByRole('button', { name: 'إغلاق' }).click();
    await nav(page, 'مستكشف الأحداث');
    await page.locator('table tbody tr').filter({ hasText: 'EVT-90481' }).click();
    panel = drawer(page);
    assert.match(await panel.locator('.detail-grid').innerText(), /02:20:00:01:00:01/);
    assert.match(await panel.innerText(), /وليس حقل MAC للمصدر أو الوجهة/);
    assert.doesNotMatch(
      await panel.locator('.code-block').innerText(),
      /host\.mac|source\.mac|destination\.mac/,
    );
    await panel.getByRole('button', { name: 'إغلاق' }).click();
    await nav(page, 'مصادر البيانات');
    assert.match(
      await page.locator('.source-card').first().locator('.source-address').innerText(),
      /02:20:00:02:00:01/,
    );
    await page.getByRole('button', { name: 'البحث في المنصة' }).click();
    const dialog = page.getByRole('dialog', { name: 'البحث في المنصة' });
    await dialog.getByLabel(globalLabel).fill('02-20-00-01-00-01');
    for (const label of ['الحوادث', 'التنبيهات', 'الأحداث', 'الأصول'])
      assert.equal(await dialog.locator(`section[aria-label="نتائج ${label}"]`).count(), 1);
    assert.match(
      await dialog.locator('section[aria-label="نتائج الأحداث"]').innerText(),
      /MAC الأصل.*02:20:00:01:00:01/s,
    );
    await dialog.getByLabel(globalLabel).fill('02-20-00-02-00-01');
    assert.match(
      await dialog.locator('section[aria-label="نتائج المصادر"]').innerText(),
      /SRC-001.*02:20:00:02:00:01/s,
    );
    await dialog.locator('section[aria-label="نتائج المصادر"] button').click();
    panel = drawer(page);
    assert.match(await panel.innerText(), /02:20:00:02:00:01/);
    await panel.getByRole('button', { name: 'إغلاق' }).click();
    await noOverflow(page, 'source MAC cards desktop');
  });
  await run('add/edit/clear asset MAC with validation, CSV and session reset', {}, async page => {
    await nav(page, 'الأصول');
    await page.getByRole('button', { name: 'إضافة أصل' }).click();
    let modal = page.getByRole('dialog', { name: 'إضافة أصل' });
    await modal.getByLabel('اسم الأصل').fill('MAC-TEST-01');
    await modal.getByLabel('عنوان IP').fill('192.0.2.10');
    await modal.getByLabel('المالك').fill('فريق العرض');
    const mac = modal.getByLabel('عنوان MAC', { exact: true });
    await mac.fill('not-a-mac');
    await modal.getByRole('button', { name: 'إضافة الأصل' }).click();
    assert.equal(await mac.getAttribute('aria-invalid'), 'true');
    assert.match(await modal.locator('.mac-error').innerText(), /أحادي البث/);
    assert.equal(await mac.evaluate(el => el === document.activeElement), true);
    const described = await mac.evaluate(el =>
      (el.getAttribute('aria-describedby') || '')
        .split(/\s+/)
        .map(id => document.getElementById(id)?.textContent || '')
        .join(' '),
    );
    assert.match(described, /عنوان واجهة واحدة.*أدخل عنوانًا/s);
    await axe(page, 'asset form invalid MAC');
    await mac.fill('03:20:00:01:00:01');
    await modal.getByRole('button', { name: 'إضافة الأصل' }).click();
    assert.equal(await mac.getAttribute('aria-invalid'), 'true');
    await mac.fill('02-aa-bb-cc-dd-ee');
    await modal.getByRole('button', { name: 'إضافة الأصل' }).click();
    await modal.waitFor({ state: 'detached' });
    const row = page.locator('table tbody tr').filter({ hasText: 'MAC-TEST-01' });
    assert.match(await row.innerText(), /02:AA:BB:CC:DD:EE/);
    await page.getByRole('button', { name: 'تصدير', exact: true }).click();
    modal = page.getByRole('dialog', { name: 'معاينة تصدير CSV' });
    assert.equal(await modal.getByLabel('عنوان MAC').isChecked(), true);
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      modal.getByRole('button', { name: 'تنزيل CSV' }).click(),
    ]);
    const csv = fs.readFileSync(await download.path(), 'utf8');
    assert.match(csv, /عنوان MAC/);
    assert.match(csv, /02:AA:BB:CC:DD:EE/);
    await row.click();
    let panel = drawer(page);
    await panel.getByRole('button', { name: 'تعديل الأصل' }).click();
    modal = page.getByRole('dialog', { name: 'تعديل الأصل' });
    await modal.getByLabel('عنوان MAC', { exact: true }).fill('02ab.cdef.1234');
    await modal.getByRole('button', { name: 'حفظ تجريبي' }).click();
    await modal.waitFor({ state: 'hidden' });
    assert.match(await panel.locator('.detail-grid').innerText(), /02:AB:CD:EF:12:34/);
    await panel.getByRole('button', { name: 'تعديل الأصل' }).click();
    modal = page.getByRole('dialog', { name: 'تعديل الأصل' });
    await modal.getByLabel('عنوان MAC', { exact: true }).fill('');
    await modal.getByRole('button', { name: 'حفظ تجريبي' }).click();
    await modal.waitFor({ state: 'hidden' });
    assert.match(await panel.locator('.detail-grid').innerText(), /عنوان MAC للواجهة\s*—/);
    await panel.getByRole('button', { name: 'إغلاق' }).click();
    assert.match(await row.innerText(), /—/);
    await page.reload();
    await login(page);
    await nav(page, 'الأصول');
    assert.equal(
      await page.locator('table tbody tr').filter({ hasText: 'MAC-TEST-01' }).count(),
      0,
    );
  });
  await run('asset MAC associations remain ID-based when names collide', {}, async page => {
    await nav(page, 'الأصول');
    await page.getByRole('button', { name: 'إضافة أصل' }).click();
    let modal = page.getByRole('dialog', { name: 'إضافة أصل' });
    await modal.getByLabel('اسم الأصل').fill('AD-SRV-01');
    await modal.getByLabel('عنوان IP').fill('192.0.2.77');
    await modal.getByLabel('المالك').fill('مالك آخر');
    await modal.getByLabel('عنوان MAC', { exact: true }).fill('02:AB:CD:EF:11:22');
    await modal.getByRole('button', { name: 'إضافة الأصل' }).click();
    await page.locator('table tbody tr').filter({ hasText: '192.0.2.77' }).click();
    let panel = drawer(page);
    assert.match(await panel.innerText(), /لا توجد حوادث مرتبطة/);
    assert.match(await panel.innerText(), /02:AB:CD:EF:11:22/);
    await panel.getByRole('button', { name: 'إغلاق' }).click();
    await nav(page, 'الحوادث');
    await page.locator('table tbody tr').filter({ hasText: 'INC-2026-084' }).click();
    panel = drawer(page);
    assert.match(await panel.locator('.detail-grid').innerText(), /02:20:00:01:00:01/);
    assert.doesNotMatch(await panel.locator('.detail-grid').innerText(), /02:AB:CD:EF:11:22/);
    await panel.getByRole('button', { name: 'إغلاق' }).click();
    await page.getByRole('button', { name: 'البحث في المنصة' }).click();
    modal = page.getByRole('dialog', { name: 'البحث في المنصة' });
    await modal.getByLabel(globalLabel).fill('02-ab-cd-ef-11-22');
    assert.equal(await modal.locator('section[aria-label="نتائج الأصول"]').count(), 1);
    assert.equal(await modal.locator('section[aria-label="نتائج الحوادث"]').count(), 0);
    assert.equal(await modal.locator('section[aria-label="نتائج التنبيهات"]').count(), 0);
    await page.keyboard.press('Escape');
    await nav(page, 'التنبيهات');
    await page.locator('table tbody tr').filter({ hasText: 'ALT-1279' }).click();
    panel = drawer(page);
    await panel.getByRole('button', { name: 'إنشاء حادثة يدويًا' }).click();
    modal = page.getByRole('dialog', { name: 'إنشاء حادثة من تنبيه' });
    await modal.getByLabel('سبب الإنشاء اليدوي').fill('اختبار الارتباط في العينة');
    await modal.getByRole('button', { name: 'إنشاء حادثة تجريبية' }).click();
    panel = drawer(page);
    assert.match(
      await panel.locator('.detail-grid').innerText(),
      /MAC الأصل في السجل.*02:20:00:01:00:04/s,
    );
  });
  await run(
    'add/edit source MAC, review, offline guard and reset',
    { width: 320, theme: 'light' },
    async page => {
      await nav(page, 'مصادر البيانات');
      await noOverflow(page, 'sources mobile');
      await page
        .locator('.source-card')
        .first()
        .getByRole('button', { name: 'تفاصيل المصدر' })
        .click();
      let panel = drawer(page);
      await axe(page, 'source detail mobile');
      await panel.getByRole('button', { name: 'تعديل عنوان MAC' }).click();
      let modal = page.getByRole('dialog', { name: 'تعديل عنوان MAC للمصدر' });
      let mac = modal.getByLabel('عنوان MAC', { exact: true });
      await mac.fill('00:00:00:00:00:00');
      await modal.getByRole('button', { name: 'حفظ تجريبي' }).click();
      assert.equal(await mac.getAttribute('aria-invalid'), 'true');
      await axe(page, 'source MAC edit invalid mobile');
      await noOverflow(page, 'source MAC modal mobile');
      await mac.fill('02ff.eedd.ccbb');
      await modal.getByRole('button', { name: 'حفظ تجريبي' }).click();
      await modal.waitFor({ state: 'hidden' });
      assert.match(await panel.innerText(), /02:FF:EE:DD:CC:BB/);
      await panel.getByRole('button', { name: 'تعديل عنوان MAC' }).click();
      modal = page.getByRole('dialog', { name: 'تعديل عنوان MAC للمصدر' });
      await modal.getByLabel('عنوان MAC', { exact: true }).fill('');
      await modal.getByRole('button', { name: 'حفظ تجريبي' }).click();
      await modal.waitFor({ state: 'hidden' });
      assert.match(await panel.locator('.detail-grid').innerText(), /عنوان MAC للواجهة\s*—/);
      await panel.getByRole('button', { name: 'تعديل عنوان MAC' }).click();
      modal = page.getByRole('dialog', { name: 'تعديل عنوان MAC للمصدر' });
      await modal.getByLabel('عنوان MAC', { exact: true }).fill('02:FF:EE:DD:CC:BB');
      await modal.getByRole('button', { name: 'حفظ تجريبي' }).click();
      await modal.waitFor({ state: 'hidden' });
      await panel.getByRole('button', { name: 'إغلاق' }).click();
      assert.match(await page.locator('.source-card').first().innerText(), /02:FF:EE:DD:CC:BB/);
      await page.getByRole('button', { name: 'إضافة مصدر' }).click();
      modal = page.getByRole('dialog', { name: 'إضافة مصدر بيانات' });
      await modal.getByLabel('اسم المصدر').fill('مستشعر MAC تجريبي');
      mac = modal.getByLabel('عنوان MAC', { exact: true });
      await mac.fill('bad');
      await modal.getByRole('button', { name: 'التالي' }).click();
      assert.equal(await mac.getAttribute('aria-invalid'), 'true');
      assert.match(await modal.innerText(), /الخطوة ١ من ٣/);
      await mac.fill('02-12-34-56-78-9a');
      await modal.getByRole('button', { name: 'التالي' }).click();
      await modal.getByRole('button', { name: 'التالي' }).click();
      assert.match(await modal.locator('.wizard-review').innerText(), /02:12:34:56:78:9A/);
      await modal.getByRole('button', { name: 'إضافة إلى العينة' }).click();
      assert.match(
        await page.locator('.source-card').first().innerText(),
        /مستشعر MAC تجريبي.*02:12:34:56:78:9A/s,
      );
      await page.getByRole('button', { name: 'البحث في المنصة' }).click();
      modal = page.getByRole('dialog', { name: 'البحث في المنصة' });
      await modal.getByLabel(globalLabel).fill('02123456789a');
      assert.match(
        await modal.locator('section[aria-label="نتائج المصادر"]').innerText(),
        /مستشعر MAC تجريبي/,
      );
      await page.keyboard.press('Escape');
      await nav(page, 'الإعدادات');
      await page.getByRole('switch', { name: 'محاكاة انقطاع الاتصال' }).click();
      await nav(page, 'مصادر البيانات');
      await page
        .locator('.source-card')
        .first()
        .getByRole('button', { name: 'تفاصيل المصدر' })
        .click();
      panel = drawer(page);
      assert.equal(await panel.getByRole('button', { name: 'تعديل عنوان MAC' }).isDisabled(), true);
      await panel.getByRole('button', { name: 'إغلاق' }).click();
      await page.reload();
      await login(page);
      await nav(page, 'مصادر البيانات');
      assert.equal(
        await page.locator('.source-card').filter({ hasText: 'مستشعر MAC تجريبي' }).count(),
        0,
      );
      assert.match(await page.locator('.source-card').first().innerText(), /02:20:00:02:00:01/);
    },
  );
} finally {
  await browser.close();
}
console.log(
  'PASS MAC interface-only regressions; no real device discovery, connection or identity verification.',
);
