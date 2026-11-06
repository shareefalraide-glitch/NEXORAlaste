import assert from 'node:assert/strict';
import { chromium, firefox, webkit } from 'playwright';
import { newPage, login, nav, noOverflow, clean } from '../../support/helpers.mjs';
import {
  events,
  initialAlerts,
  initialIncidents,
} from '../../../src/data/fixtures/demo-records.js';
import {
  inPeriod,
  recordTime,
  relativeSampleTime,
  SAMPLE_END_UTC,
} from '../../../src/shared/lib/time-scope.js';
import { networkView, previousNetworkView } from '../../../src/features/network/network-data.js';
import { overviewSeries, seriesTotal } from '../../../src/shared/charts/visual-data.js';

assert.equal(SAMPLE_END_UTC, Date.parse('2026-10-29T07:00:00Z'));
assert.equal(events.filter(x => inPeriod(x, 'event', '1h')).length, 2);
assert.equal(initialAlerts.filter(x => inPeriod(x, 'alert', '1h')).length, 2);
assert.equal(initialIncidents.filter(x => inPeriod(x, 'incident', '1h')).length, 2);
assert.equal(relativeSampleTime(initialIncidents[0], 'incident'), 'منذ ٢٣ دقيقة في العينة');
assert.equal(recordTime({ id: 'custom', time: '09:00' }, 'incident'), null);
assert.equal(inPeriod({ id: 'unknown' }, 'incident', '1h'), true);
assert.equal(inPeriod({ id: 'unknown' }, 'incident', '1h', { includeUndated: false }), false);
assert.equal(seriesTotal(overviewSeries['1h'].points, 'events'), 1173);
assert.equal(seriesTotal(overviewSeries['24h'].points, 'events'), 24856);
assert.equal(previousNetworkView('7d'), null);
assert.ok(previousNetworkView('1h').mbps > 0);
assert.equal(networkView('1h').buckets.length, 12);
console.log('PASS sample clock, time boundaries, unknown records and prior-window availability');

const panel = page => page.locator('.detail-layer-active .drawer');
const details = async (page, text) =>
  page
    .locator('details')
    .filter({ has: page.getByText(text, { exact: true }) })
    .first()
    .locator('summary')
    .first()
    .click();
async function experience(browser, { width = 1440, theme = 'dark' } = {}) {
  const t = await newPage(browser, { width, height: 900, theme });
  const { page } = t;
  try {
    await login(page);
    const global = page.getByLabel('الفترة العامة للعينة');
    await global.selectOption('1h');
    assert.equal(await page.getByLabel('الفترة الزمنية', { exact: true }).inputValue(), '1h');
    await nav(page, 'مستكشف الأحداث');
    assert.equal(await page.locator('.data-panel tbody tr').count(), 2);
    await details(page, 'مساحة صيد التهديدات');
    await noOverflow(page, `hunt-${width}`);
    assert.match(await page.locator('.hunt-result-head').innerText(), /٢ نتيجة/);
    await page.getByLabel('قيمة الشرط ٢').fill('svc-auth');
    assert.equal(await page.locator('.hunt-results button').count(), 1);
    await page.getByRole('button', { name: 'حفظ مؤقت' }).click();
    await page.getByLabel('قيمة الشرط ٢').fill('no-such-user');
    assert.equal(await page.locator('.hunt-results button').count(), 0);
    await page.getByRole('button', { name: 'استعادة', exact: true }).click();
    assert.equal(await page.locator('.hunt-results button').count(), 1);
    await page.locator('.hunt-results button').first().click();
    let drawer = panel(page);
    assert.match(await drawer.innerText(), /EVT-90481/);
    await drawer.getByRole('button', { name: 'استكشاف عنوان IP 198.51.100.23' }).click();
    drawer = panel(page);
    assert.match(await drawer.innerText(), /أحداث مرتبطة/);
    assert.match(await drawer.innerText(), /EVT-90481/);
    await drawer.getByRole('button', { name: 'العودة للسجل السابق' }).click();
    assert.match(await panel(page).innerText(), /EVT-90481/);
    await panel(page).getByRole('button', { name: 'إغلاق' }).click();
    await nav(page, 'الحوادث');
    assert.equal(await page.locator('.data-panel tbody tr').count(), 2);
    await page.locator('.data-panel tbody tr').filter({ hasText: 'INC-2026-084' }).click();
    drawer = panel(page);
    await drawer.getByRole('button', { name: 'الخط الزمني', exact: true }).click();
    assert.match(await drawer.innerText(), /الخط الزمني الموحّد/);
    assert.match(await drawer.innerText(), /EVT-90481/);
    await drawer.getByRole('button', { name: 'المهام والملاحظات' }).click();
    await drawer.getByLabel('ملاحظة جديدة للحادثة').fill('ملاحظة محلية غير حساسة');
    await drawer.getByRole('button', { name: 'إضافة ملاحظة' }).click();
    await drawer.getByRole('button', { name: 'الخط الزمني', exact: true }).click();
    assert.match(await drawer.innerText(), /خارج زمن العينة/);
    assert.match(await drawer.innerText(), /ملاحظة محلية غير حساسة/);
    await drawer.getByRole('button', { name: 'مراجع الأدلة', exact: true }).click();
    await drawer.getByLabel('عنوان المرجع التجريبي').fill('مرجع محلي');
    await drawer.getByRole('button', { name: 'إضافة مرجع' }).click();
    await drawer.getByRole('button', { name: 'قوالب الاستجابة', exact: true }).click();
    await drawer.getByRole('checkbox', { name: /راجع التنبيه والأصل/ }).check();
    await drawer.getByRole('button', { name: 'مراجع الأدلة', exact: true }).click();
    assert.match(await drawer.innerText(), /مرجع محلي/);
    await drawer.getByRole('button', { name: 'المهام والملاحظات' }).click();
    assert.match(await drawer.innerText(), /ملاحظة محلية غير حساسة/);
    await drawer.getByRole('button', { name: 'إغلاق' }).click();
    await nav(page, 'تغطية MITRE');
    let cell = page.locator('.mitre-cell').filter({ hasText: 'T1078' });
    assert.match(await cell.innerText(), /معطّلة/);
    await cell.click();
    let dialog = page.getByRole('dialog', { name: 'تفاصيل التقنية' });
    assert.match(await dialog.innerText(), /RULE-005/);
    assert.match(await dialog.innerText(), /غير مختبرة فعليًا/);
    await dialog.getByRole('button', { name: /RULE-005/ }).click();
    drawer = panel(page);
    await drawer.getByRole('button', { name: 'اختبار على عينة' }).click();
    dialog = page.getByRole('dialog', { name: 'اختبار قاعدة كشف' });
    await dialog.getByRole('button', { name: 'تشغيل المعاينة' }).click();
    assert.match(await dialog.innerText(), /غير مختبرة فعليًا/);
    await dialog.getByRole('button', { name: 'إغلاق' }).click();
    await drawer.getByRole('button', { name: 'تفعيل القاعدة' }).click();
    await drawer.getByRole('button', { name: 'إغلاق' }).click();
    assert.match(await cell.innerText(), /قاعدة مفعّلة/);
    await global.selectOption('24h');
    await nav(page, 'تحليل الشبكة');
    assert.equal(await page.getByLabel('الفترة الزمنية لتحليل الشبكة').inputValue(), '24h');
    await details(page, 'مقارنة بالفترة السابقة');
    assert.match(await page.locator('.comparison-cards').innerText(), /الفترة السابقة/);
    await global.selectOption('7d');
    assert.match(await page.locator('.network-extra[open]').first().innerText(), /غير متاحة/);
    await global.selectOption('1h');
    await details(page, 'إعادة عرض فواصل العينة');
    const slider = page.getByLabel('موضع إعادة عرض عينة الشبكة');
    await slider.fill('3');
    assert.equal(await slider.inputValue(), '3');
    await page.getByRole('button', { name: 'تشغيل الفواصل' }).click();
    await page.waitForTimeout(1100);
    assert.ok(Number(await slider.inputValue()) > 3);
    await page.getByRole('button', { name: 'إيقاف مؤقت' }).click();
    await details(page, 'طوبولوجيا افتراضية');
    await page.locator('.topology-branches button').filter({ hasText: 'AD-SRV-01' }).click();
    assert.match(await panel(page).innerText(), /AST-001/);
    await panel(page).getByRole('button', { name: 'إغلاق' }).click();
    await noOverflow(page, `network-extras-${width}`);
    await nav(page, 'خريطة العلاقات');
    assert.match(await page.locator('.attack-path-panel').innerText(), /لا دليل على انتقال/);
    await page.getByLabel('إظهار الخطوة الافتراضية').uncheck();
    assert.equal(await page.locator('.attack-node.hypothetical').count(), 0);
    await noOverflow(page, `paths-${width}`);
    await nav(page, 'الأصول');
    await details(page, 'سطح التعرّض');
    assert.match(await page.locator('.experience-module[open]').innerText(), /غير مقيّم/);
    await nav(page, 'مصادر البيانات');
    await details(page, 'صحة المصادر والمستشعرات');
    assert.match(await page.locator('.sensor-grid').innerText(), /غير متوفرة/);
    assert.match(await page.locator('.sensor-grid').innerText(), /CPU/);
    await nav(page, 'نموذج الشذوذ');
    await details(page, 'خط أساس سلوكي للأصول');
    await page.getByLabel('أصل خط الأساس السلوكي').selectOption('AST-006');
    assert.match(await page.locator('.experience-module[open]').innerText(), /قيد التأسيس/);
    await nav(page, 'الحوادث');
    await details(page, 'تسليم المناوبة والمواعيد');
    assert.match(await page.locator('.experience-module[open]').innerText(), /تجاوز افتراضي/);
    await page.getByLabel('ملاحظة تسليم غير حساسة').fill('تسليم تجريبي');
    await nav(page, 'المستخدمون والأدوار');
    await page.getByRole('button', { name: 'الأدوار والصلاحيات' }).click();
    await details(page, 'مقارنة دورين');
    await page.getByLabel('الدور الأول للمقارنة').selectOption({ label: 'مدير النظام' });
    assert.match(await page.locator('.role-compare-grid').innerText(), /مدير النظام/);
    assert.match(await page.locator('.role-compare-grid').innerText(), /غير مقترحة/);
    await noOverflow(page, `roles-${width}`);
    await nav(page, 'التقارير');
    await details(page, 'مصمم تقرير مبسّط');
    assert.match(await page.locator('.designer-preview').innerText(), /٢ حادثة/);
    await page.getByLabel('عنوان التقرير المخصص').fill('تقرير تجريبي');
    assert.match(await page.locator('.designer-preview').innerText(), /تقرير تجريبي/);
    await nav(page, 'الإعدادات');
    await page.getByRole('button', { name: /الكشف والربط/ }).click();
    await details(page, 'ماذا لو؟ · محاكي الأوزان');
    assert.match(await page.locator('.whatif-results').innerText(), /0.943/);
    await page.getByLabel('وزن شدّة القاعدة في المحاكاة').fill('0.50');
    assert.match(await page.locator('.whatif-total').innerText(), /يجب أن يكون/);
    await page.getByRole('button', { name: 'الأوزان الافتراضية' }).click();
    assert.match(await page.locator('.whatif-total').innerText(), /صالح للمقارنة/);
    await page.getByRole('button', { name: 'المساعد التجريبي' }).click();
    dialog = page.getByRole('dialog', { name: 'المساعد التجريبي' });
    assert.match(await dialog.innerText(), /لا يوجد نموذج ذكاء اصطناعي/);
    await dialog.getByRole('button', { name: 'ابدأ التحقيق' }).click();
    assert.match(await dialog.innerText(), /INC-2026-084/);
    await dialog.getByRole('button', { name: 'إغلاق' }).click();
    await page.getByRole('button', { name: 'الإشعارات التجريبية' }).click();
    await page.getByRole('button', { name: 'ترتيب حسب خطورة السجل' }).click();
    assert.equal(
      await page
        .getByRole('button', { name: 'ترتيب حسب خطورة السجل' })
        .getAttribute('aria-pressed'),
      'true',
    );
    await page.keyboard.press('Escape');
    await nav(page, 'نظرة عامة');
    await details(page, 'تخصيص بطاقات ملخص النشاط لهذا الدور');
    await page.getByRole('checkbox', { name: 'الأحداث المحلَّلة' }).uncheck();
    assert.equal(await page.locator('.stats-grid .stat-card').count(), 3);
    await page.getByRole('button', { name: 'إظهار الجميع' }).click();
    assert.equal(await page.locator('.stats-grid .stat-card').count(), 4);
    await noOverflow(page, `overview-${width}`);
    clean(t);
    console.log(`PASS integrated experience ${theme}/${width}`);
  } finally {
    await t.context.close();
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
    await experience(browser, { width: 1440, theme: 'dark' });
    await experience(browser, { width: 320, theme: 'light' });
    console.log(`PASS integrated flows · ${name}`);
  } finally {
    await browser.close();
  }
}
console.log('PASS all integrated UI checks. The prototype has no backend, real telemetry or AI.');
