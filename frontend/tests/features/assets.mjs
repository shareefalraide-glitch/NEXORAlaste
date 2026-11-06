// Focused tests of UI-only asset profiles, interfaces, relationships and import.
import { assert, launch, newPage, login, nav, noOverflow, clean } from '../support/helpers.mjs';
import {
  validIp,
  validVlan,
  interfacesOf,
  primaryInterface,
  interfacePatch,
  primaryMacPatch,
  asciiDigits,
} from '../../src/features/assets/asset-model.js';
import AxeBuilder from '@axe-core/playwright';
import fs from 'node:fs';
import { relationshipGraph } from '../../src/features/relationships/relationship-model.js';
import { parseCsv, previewAssetCsv } from '../../src/features/assets/asset-import.js';
import {
  initialAssets,
  initialAlerts,
  initialIncidents,
  sourceCards,
  events,
} from '../../src/data/fixtures/demo-records.js';
for (const ip of ['', '192.0.2.1', '255.255.255.255', '2001:db8::1', '::1', '::ffff:192.0.2.1'])
  assert.equal(validIp(ip), true, ip);
for (const ip of ['300.1.1.1', '01.2.3.4', '1.2.3', 'abc', '2001:db8:::1', '192.0.2.1/24'])
  assert.equal(validIp(ip), false, ip);
for (const vlan of ['', '1', '4094', '١١٠']) assert.equal(validVlan(vlan), true, vlan);
for (const vlan of ['0', '4095', '-1', '1.5', 'abcd']) assert.equal(validVlan(vlan), false, vlan);
assert.equal(asciiDigits('١٢۳'), '123');
const graph = relationshipGraph(
  {
    assets: initialAssets,
    alerts: initialAlerts,
    incidents: initialIncidents,
    sources: sourceCards,
  },
  events,
);
assert.ok(graph.edges.some(e => e.a === 'source:SRC-002' && e.b === 'asset:AST-001'));
assert.ok(graph.edges.some(e => e.a === 'asset:AST-001' && e.b === 'incident:INC-2026-084'));
assert.ok(!graph.edges.some(e => e.a === 'source:SRC-004' && e.b === 'asset:AST-001'));
assert.deepEqual(parseCsv('a,b\r\n"x,y","say ""hi"""\r\n'), [
  ['a', 'b'],
  ['x,y', 'say "hi"'],
]);
assert.deepEqual(parseCsv('a,b\n"one\ntwo",ok'), [
  ['a', 'b'],
  ['one\ntwo', 'ok'],
]);
assert.throws(() => parseCsv('a,b\n"not closed,b'), /غير مغلق/);
assert.throws(() => parseCsv('a,b\nx"bad,y'), /الاقتباس/);
assert.throws(() => previewAssetCsv('عنوان IP\n192.0.2.1', initialAssets), /اسم الأصل/);
assert.throws(() => previewAssetCsv('اسم الأصل,name\nx,y', initialAssets), /مكرر/);
assert.throws(
  () => parseCsv('x\n' + Array.from({ length: 101 }, (_, i) => `item${i}`).join('\n')),
  /١٠٠ صف/,
);
assert.throws(() => parseCsv('x'.repeat(100001)), /١٠٠٬٠٠٠/);
assert.throws(() => parseCsv('م'.repeat(50001)), /١٠٠٬٠٠٠/);
assert.throws(() => parseCsv(Array(41).fill('x').join(',')), /٤٠ عمودًا/);
assert.equal(parseCsv(Array(40).fill('x').join(','))[0].length, 40);
assert.equal(
  parseCsv('x\n' + Array.from({ length: 100 }, (_, i) => `item${i}`).join('\n')).length,
  101,
);
const checked = previewAssetCsv(
  'اسم الأصل,عنوان IP,عنوان MAC,VLAN\nNEW,192.0.2.9,02-aa-bb-cc-dd-ee,١٠٠\nAD-SRV-01,10.20.11.12,02:20:00:01:10:01,101\nBAD,999.2.3.4,FF:FF:FF:FF:FF:FF,4095',
  initialAssets,
);
const malformed = previewAssetCsv(
  'اسم الأصل,عنوان IP,other\nNEW,192.0.2.20\nNEW,192.0.2.20,extra',
  [],
);
assert.match(malformed.records[0].errors.join(), /عدد القيم/);
assert.match(malformed.records[1].warnings.join(), /مكرر في الملف/);
assert.deepEqual(malformed.unknown, ['other']);
assert.equal(checked.records[0].values.mac, '02:AA:BB:CC:DD:EE');
assert.equal(checked.records[0].values.vlan, '100');
assert.equal(checked.records[0].errors.length, 0);
assert.equal(checked.records[1].warnings.length, 3);
assert.equal(checked.records[2].errors.length, 3);
assert.equal(
  previewAssetCsv('الأصل,عنوان IP,عنوان MAC\nNEW · AST-IMPORT-abc-1,—,—', []).records[0].values
    .name,
  'NEW',
);
assert.deepEqual(
  previewAssetCsv('اسم الأصل,عنوان IP,عنوان MAC\nNEW,—,—', []).records[0].errors,
  [],
);
assert.deepEqual(
  primaryMacPatch({ id: 'AST-X', interfaces: [], ip: '', mac: '' }, '').interfaces,
  [],
);
const browser = await launch(),
  drawer = page => page.locator('.detail-layer-active .drawer');
const tags = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'];
async function axe(page, where) {
  const r = await new AxeBuilder({ page }).withTags(tags).analyze();
  assert.deepEqual(
    r.violations.map(v => ({ id: v.id, targets: v.nodes.map(n => n.target) })),
    [],
    `axe ${where}`,
  );
}
async function run(name, options, fn) {
  const x = await newPage(browser, options);
  try {
    await login(x.page);
    await fn(x.page);
    clean(x);
    console.log(`PASS ${name}`);
  } finally {
    await x.context.close();
  }
}
try {
  await run('dialog does not steal focus after the user starts typing', {}, async page => {
    await nav(page, 'الأصول');
    await page.evaluate(() => {
      const original = window.requestAnimationFrame.bind(window);
      window.requestAnimationFrame = callback =>
        original(time => window.setTimeout(() => callback(time), 500));
    });
    await page.getByRole('button', { name: 'إضافة أصل' }).click();
    const modal = page.getByRole('dialog', { name: 'إضافة أصل' }),
      field = modal.getByLabel('اسم الأصل');
    await field.fill('FOCUS-SAFE');
    await page.waitForTimeout(650);
    assert.equal(
      await field.evaluate(el => el === document.activeElement),
      true,
      'delayed dialog autofocus must not move focus away from an edited field',
    );
    assert.equal(await field.inputValue(), 'FOCUS-SAFE');
  });
  await run(
    'asset profile, multiple interfaces, search, primary and local history',
    {},
    async page => {
      await nav(page, 'الأصول');
      const row = page.locator('table tbody tr').filter({ hasText: 'AST-001' });
      assert.match(await row.innerText(), /02:20:00:01:00:01/);
      await row.click();
      let panel = drawer(page);
      assert.match(await panel.locator('.detail-grid').innerText(), /Aster Systems/);
      assert.match(await panel.locator('.detail-grid').innerText(), /مركز البيانات/);
      await panel.getByRole('button', { name: /واجهات الشبكة/ }).click();
      assert.equal(await panel.locator('.interface-card').count(), 2);
      assert.match(await panel.innerText(), /10.20.11.12/);
      await panel.getByRole('button', { name: 'إضافة واجهة' }).click();
      let modal = page.getByRole('dialog', { name: 'إضافة واجهة شبكة' });
      await modal.getByLabel('اسم واجهة الشبكة').fill('eth2');
      await modal.getByLabel('عنوان IP للواجهة').fill('bad-ip');
      await modal.getByLabel('VLAN').fill('5000');
      await modal.getByRole('button', { name: 'إضافة الواجهة' }).click();
      assert.equal(await modal.getByLabel('عنوان IP للواجهة').getAttribute('aria-invalid'), 'true');
      await axe(page, 'interface invalid');
      await modal.getByLabel('عنوان IP للواجهة').fill('2001:db8::10');
      await modal.getByRole('button', { name: 'إضافة الواجهة' }).click();
      assert.equal(await modal.getByLabel('VLAN').getAttribute('aria-invalid'), 'true');
      await modal.getByLabel('VLAN').fill('٢٠٠');
      await modal.getByLabel('عنوان MAC', { exact: true }).fill('02-aa-bb-cc-dd-77');
      await modal.getByRole('button', { name: 'إضافة الواجهة' }).click();
      const eth2 = panel.locator('.interface-card').filter({ hasText: 'eth2' });
      assert.match(await eth2.innerText(), /2001:db8::10/);
      assert.match(await eth2.innerText(), /02:AA:BB:CC:DD:77/);
      assert.match(await eth2.innerText(), /200/);
      await eth2.getByRole('button', { name: 'جعل الواجهة eth2 رئيسية' }).click();
      assert.match(await eth2.innerText(), /الرئيسية/);
      await panel.getByRole('button', { name: 'الملف والسجلات' }).click();
      assert.match(await panel.locator('.detail-grid').innerText(), /2001:db8::10/);
      await panel.getByRole('button', { name: 'سجل التغييرات' }).click();
      assert.match(await panel.innerText(), /إضافة واجهة شبكة/);
      assert.match(await panel.innerText(), /تغيير الواجهة الرئيسية/);
      await panel.getByRole('button', { name: /واجهات الشبكة/ }).click();
      await eth2.getByRole('button', { name: 'حذف الواجهة eth2' }).click();
      modal = page.getByRole('dialog', { name: 'حذف واجهة الشبكة' });
      await modal.getByRole('checkbox').check();
      await modal.getByRole('button', { name: 'حذف الواجهة' }).click();
      await page.waitForFunction(() => document.activeElement?.textContent.includes('إضافة واجهة'));
      assert.equal(await panel.locator('.interface-card').count(), 2);
      await panel.getByRole('button', { name: 'تعديل الأصل' }).click();
      modal = page.getByRole('dialog', { name: 'تعديل الأصل' });
      await modal.locator('summary').click();
      await modal.getByLabel('الشركة المصنّعة').fill('شركة اختبار');
      await modal.getByLabel('الموقع', { exact: true }).fill('مختبر');
      await modal.getByRole('button', { name: 'حفظ تجريبي' }).click();
      await panel.getByRole('button', { name: 'الملف والسجلات' }).click();
      assert.match(await panel.locator('.detail-grid').innerText(), /شركة اختبار/);
      await panel.getByRole('button', { name: 'سجل التغييرات' }).click();
      assert.match(await panel.innerText(), /تعديل ملف الأصل/);
      await panel.getByRole('button', { name: 'إغلاق' }).click();
      const search = page.getByPlaceholder('بحث باسم الأصل أو عنوان IP أو MAC أو المالك');
      await search.fill('02-20-00-01-10-01');
      assert.equal(await page.locator('table tbody tr').count(), 1);
      await search.fill('');
      await page.getByRole('button', { name: 'البحث في المنصة' }).click();
      modal = page.getByRole('dialog', { name: 'البحث في المنصة' });
      await modal
        .getByLabel('ابحث عن حادثة، تنبيه، أصل، مصدر بيانات أو عنوان IP أو MAC')
        .fill('02-20-00-01-10-01');
      assert.match(
        await modal.locator('section[aria-label="نتائج الأصول"]').innerText(),
        /02:20:00:01:10:01/,
      );
      assert.equal(await modal.locator('section[aria-label="نتائج الحوادث"]').count(), 1);
      await page.keyboard.press('Escape');
      await page.reload();
      await login(page);
      await nav(page, 'الأصول');
      await page.locator('table tbody tr').filter({ hasText: 'AST-001' }).click();
      panel = drawer(page);
      assert.match(await panel.locator('.detail-grid').innerText(), /Aster Systems/);
      await panel.getByRole('button', { name: /واجهات الشبكة/ }).click();
      assert.equal(await panel.locator('.interface-card').count(), 2);
    },
  );
  await run(
    'relationship map selection, relationships and linked details',
    { width: 320, theme: 'light' },
    async page => {
      await nav(page, 'خريطة العلاقات');
      await noOverflow(page, 'relationship map mobile');
      assert.match(await page.locator('.relationship-intro').innerText(), /ليست خريطة اتصال فعلية/);
      await page.getByRole('button', { name: 'مصدر مستشعر حدود الشبكة SRC-002' }).click();
      assert.match(await page.locator('.relationship-selection').innerText(), /AD-SRV-01/);
      assert.match(await page.locator('.relationship-selection').innerText(), /سجلات مشتركة/);
      await axe(page, 'relationship selected');
      await page
        .locator('.relationship-selection')
        .getByRole('button', { name: /أصل AD-SRV-01/ })
        .click();
      assert.match(await page.locator('.relationship-selection').innerText(), /INC-2026-084/);
      await page
        .locator('.relationship-selection')
        .getByRole('button', { name: 'فتح التفاصيل' })
        .click();
      assert.match(await drawer(page).innerText(), /AST-001/);
      await drawer(page).getByRole('button', { name: 'إغلاق' }).click();
      await page
        .getByPlaceholder('بحث باسم الجهاز أو الأصل أو الحادثة أو المعرّف')
        .fill('AD-SRV-01');
      assert.equal(await page.locator('.relationship-asset .relationship-node').count(), 1);
      assert.equal(await page.locator('.relationship-incident .relationship-node').count(), 1);
      assert.ok((await page.locator('.relationship-source .relationship-node').count()) >= 1);
      await page
        .getByPlaceholder('بحث باسم الجهاز أو الأصل أو الحادثة أو المعرّف')
        .fill('NO-SUCH-RECORD');
      assert.match(await page.locator('.relationship-no-results').innerText(), /لا توجد نتائج/);
    },
  );
  await run(
    'CSV import preview, duplicates, local file, validation and reset',
    { width: 320, theme: 'light' },
    async page => {
      await nav(page, 'الأصول');
      const trigger = page.getByRole('button', { name: 'استيراد CSV' });
      await trigger.click();
      let modal = page.getByRole('dialog', { name: 'استيراد أصول CSV' });
      await modal.getByRole('button', { name: 'استخدام مثال تجريبي' }).click();
      assert.equal(
        await page.evaluate(() => {
          const e = new Event('beforeunload', { cancelable: true });
          window.dispatchEvent(e);
          return e.defaultPrevented;
        }),
        true,
      );
      await modal.getByRole('button', { name: 'معاينة والتحقق' }).click();
      const preview = modal.locator('.import-preview');
      assert.match(await preview.innerText(), /٢ صف · ١ محدد/);
      assert.equal(await modal.getByLabel('اختيار الصف 1: LAB-DEMO-01').isChecked(), true);
      assert.equal(await modal.getByLabel('اختيار الصف 2: AD-SRV-01').isChecked(), false);
      assert.match(await preview.innerText(), /مكرر مع سجل حالي/);
      await modal.getByLabel('تفاصيل الصف 1: LAB-DEMO-01').click();
      assert.match(await modal.locator('.import-row-details[open]').innerText(), /eth0/);
      assert.match(await modal.locator('.import-row-details[open]').innerText(), /100/);
      await axe(page, 'CSV preview mobile');
      await noOverflow(page, 'CSV import mobile');
      await modal.getByLabel('اختيار الصف 2: AD-SRV-01').check();
      assert.match(await preview.innerText(), /٢ محدد/);
      await modal.getByRole('button', { name: 'إضافة المحدد للعينة' }).click();
      assert.equal(
        await page.locator('table tbody tr').filter({ hasText: 'AD-SRV-01' }).count(),
        2,
      );
      const newRow = page.locator('table tbody tr').filter({ hasText: 'LAB-DEMO-01' });
      assert.match(await newRow.innerText(), /02:AC:00:00:00:70/);
      await newRow.click();
      let panel = drawer(page);
      assert.match(await panel.innerText(), /المختبر/);
      await panel.getByRole('button', { name: /واجهات الشبكة/ }).click();
      assert.match(await panel.innerText(), /100/);
      await panel.getByRole('button', { name: 'سجل التغييرات' }).click();
      assert.match(await panel.innerText(), /استيراد أصل من CSV/);
      await panel.getByRole('button', { name: 'إغلاق' }).click();
      await page
        .getByPlaceholder('بحث باسم الأصل أو عنوان IP أو MAC أو المالك')
        .fill('LAB-DEMO-01');
      await page.getByRole('button', { name: 'تصدير', exact: true }).click();
      let exportDialog = page.getByRole('dialog', { name: 'معاينة تصدير CSV' });
      const [download] = await Promise.all([
        page.waitForEvent('download'),
        exportDialog.getByRole('button', { name: 'تنزيل CSV' }).click(),
      ]);
      const roundtrip = previewAssetCsv(
        fs.readFileSync(await download.path(), 'utf8'),
        initialAssets,
      );
      assert.equal(roundtrip.records[0].values.name, 'LAB-DEMO-01');
      assert.equal(roundtrip.records[0].values.ip, '192.0.2.70');
      assert.equal(roundtrip.records[0].values.mac, '02:AC:00:00:00:70');
      assert.deepEqual(roundtrip.records[0].errors, []);
      await page.getByPlaceholder('بحث باسم الأصل أو عنوان IP أو MAC أو المالك').fill('');
      await trigger.click();
      modal = page.getByRole('dialog', { name: 'استيراد أصول CSV' });
      const csv =
        'اسم الأصل,عنوان IP,عنوان MAC,VLAN\nOK,192.0.2.80,02:AB:CD:00:00:01,10\nINVALID,999.2.3.4,invalid,0';
      await modal
        .getByLabel('اختيار ملف CSV للأصول')
        .setInputFiles({ name: 'fixtures.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) });
      await modal.getByRole('button', { name: 'معاينة والتحقق' }).click();
      assert.equal(await modal.getByLabel('اختيار الصف 1: OK').isChecked(), true);
      assert.equal(await modal.getByLabel('اختيار الصف 2: INVALID').isDisabled(), true);
      assert.match(await modal.innerText(), /عنوان IP غير صالح/);
      await modal
        .getByLabel('نص CSV للأصول')
        .fill('اسم الأصل\n' + Array.from({ length: 11 }, (_, i) => `ROW-${i}`).join('\n'));
      await modal.getByRole('button', { name: 'معاينة والتحقق' }).click();
      assert.match(await modal.locator('.import-pagination').innerText(), /صفحة ١ من ٢/);
      await modal.locator('.import-pagination').getByRole('button', { name: 'التالي' }).click();
      assert.equal(await modal.getByLabel('اختيار الصف 11: ROW-10').isChecked(), true);
      await modal.getByLabel('اختيار ملف CSV للأصول').setInputFiles({
        name: 'large.csv',
        mimeType: 'text/csv',
        buffer: Buffer.alloc(100001, 65),
      });
      assert.match(await modal.getByRole('alert').innerText(), /أكبر من/);
      assert.equal(
        await modal.getByRole('button', { name: 'إضافة المحدد للعينة' }).isDisabled(),
        true,
      );
      await page.keyboard.press('Escape');
      const confirm = page.getByRole('dialog', { name: 'تغييرات غير محفوظة' });
      await confirm.getByRole('button', { name: 'تجاهل التغييرات' }).click();
      await page.waitForFunction(() => document.activeElement?.textContent.includes('استيراد CSV'));
      await page.reload();
      await login(page);
      await nav(page, 'الأصول');
      assert.equal(
        await page.locator('table tbody tr').filter({ hasText: 'LAB-DEMO-01' }).count(),
        0,
      );
    },
  );
  await run('offline simulation blocks interface edits and import', { width: 1440 }, async page => {
    await nav(page, 'الإعدادات');
    await page.getByRole('switch', { name: 'محاكاة انقطاع الاتصال' }).click();
    await nav(page, 'الأصول');
    await page.getByRole('button', { name: 'استيراد CSV' }).click();
    assert.equal(await page.getByRole('dialog', { name: 'استيراد أصول CSV' }).count(), 0);
    assert.match(await page.locator('.toast').innerText(), /للقراءة فقط/);
    await page.locator('table tbody tr').filter({ hasText: 'AD-SRV-01' }).click();
    const panel = drawer(page);
    await panel.getByRole('button', { name: /واجهات الشبكة/ }).click();
    assert.equal(await panel.getByRole('button', { name: 'إضافة واجهة' }).isDisabled(), true);
    assert.equal(await page.getByRole('dialog', { name: 'إضافة واجهة شبكة' }).count(), 0);
  });
} finally {
  await browser.close();
}
console.log('PASS asset-interface UI checks; no real network changes.');
