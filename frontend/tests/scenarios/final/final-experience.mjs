// End-to-end checks of the final, local-only UI additions. No real SOC service,
// AI, policy enforcement, file evidence, connector or platform backup is tested.
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

const drawer = page => page.locator('.detail-layer-active .drawer');
const copilot = page => page.getByRole('dialog', { name: 'المساعد التجريبي' });
async function run(browser, { width, theme }) {
  const run = await newPage(browser, { width, height: 900, theme }),
    { page } = run;
  try {
    await login(page);
    await page.getByLabel('الفترة العامة للعينة').selectOption('1h');
    const recent = page.locator('.recent-panel');
    assert.equal(await recent.locator('tbody tr').count(), 2);
    assert.match(await recent.innerText(), /INC-2026-084/);
    assert.match(await recent.innerText(), /INC-2026-083/);
    assert.doesNotMatch(await recent.innerText(), /INC-2026-082/);
    await page.locator('.global-session-help>summary').click();
    assert.match(
      await page.locator('.global-session-help').innerText(),
      /تُمسح عند تحديث الصفحة أو الخروج/,
    );
    await noOverflow(page, 'global session notice');
    await page.locator('.global-session-help>summary').click();
    await page.getByRole('button', { name: 'استكشف رحلة التحقيق' }).click();
    let d = drawer(page);
    assert.match(await d.innerText(), /INC-2026-084/);
    assert.match(await d.innerText(), /الحدث المفصّل المتاح يسجل محاولة فاشلة واحدة/);
    assert.match(await d.innerText(), /لا يثبت نجاح دخول أو انتقالًا لاحقًا/);
    await d.getByRole('button', { name: 'المتابعة وSLA' }).click();
    assert.equal(
      await d.getByRole('button', { name: 'المتابعة وSLA' }).getAttribute('aria-pressed'),
      'true',
    );
    assert.match(await d.locator('.sla-preview').innerText(), /لا يتوفر وقت إقرار موثوق/);
    assert.match(await d.locator('.sla-preview').innerText(), /متبقٍ افتراضي/);
    await d.getByLabel('سبب مقترح التصعيد').fill('مراجعة بشرية تجريبية');
    await d.getByRole('button', { name: 'تسجيل مقترح محلي' }).click();
    assert.match(await d.locator('.escalation-saved').innerText(), /لم يُرسل إلى أحد/);
    await d.getByRole('button', { name: 'اسأل المساعد عن الحادثة' }).click();
    let a = copilot(page);
    assert.equal(await a.getByLabel('حادثة سياق المساعد').inputValue(), 'INC-2026-084');
    await a.getByLabel('سؤال للمساعد التجريبي').fill('ما السجلات المرتبطة؟');
    await a.getByRole('button', { name: 'عرض الرد التجريبي' }).click();
    let reply = a.locator('.copilot-reply').last();
    assert.match(await reply.innerText(), /EVT-90481/);
    assert.match(await reply.innerText(), /فشل/);
    assert.match(await reply.innerText(), /ليست دليلًا على اختراق/);
    assert.match(await reply.innerText(), /المتاح في العينة/);
    await a.getByLabel('حادثة سياق المساعد').selectOption('INC-2026-082');
    assert.match(await a.innerText(), /الحادثة المختارة خارج الفترة/);
    await a.getByLabel('سؤال للمساعد التجريبي').fill('ما الخطوة التالية؟');
    await a.getByRole('button', { name: 'عرض الرد التجريبي' }).click();
    assert.match(await a.locator('.copilot-exchange').last().innerText(), /INC-2026-082/);
    assert.match(await a.locator('.copilot-exchange').last().innerText(), /خارج الفترة/);
    await a.getByLabel('سؤال للمساعد التجريبي').fill('سؤال غير معروف تمامًا');
    await a.getByRole('button', { name: 'عرض الرد التجريبي' }).click();
    assert.match(await a.locator('.copilot-reply').last().innerText(), /قالب غير متاح/);
    await a.getByRole('button', { name: 'إغلاق' }).click();
    await d.getByRole('button', { name: 'اسأل المساعد عن الحادثة' }).click();
    a = copilot(page);
    assert.equal(
      await a.locator('.copilot-exchange').count(),
      3,
      'history persists in memory across modal openings',
    );
    await a.getByRole('button', { name: 'إغلاق' }).click();
    await d.getByRole('button', { name: 'مراجع الأدلة', exact: true }).click();
    await d.getByLabel('عنوان المرجع التجريبي').fill('مرجع توضيحي');
    await d.getByLabel('مصدر المرجع التجريبي').fill('سجل عينة');
    await d.getByLabel('بصمة المرجع المدخلة').fill('123');
    assert.equal(await d.getByRole('button', { name: 'إضافة مرجع' }).isDisabled(), true);
    assert.equal(await d.getByLabel('بصمة المرجع المدخلة').getAttribute('aria-invalid'), 'true');
    await d.getByLabel('بصمة المرجع المدخلة').fill('a'.repeat(64));
    await d.getByRole('button', { name: 'إضافة مرجع' }).click();
    let evidence = d.locator('.evidence-record');
    await evidence.locator('summary').click();
    assert.match(await evidence.innerText(), /غير متحقق منها/);
    assert.match(await evidence.innerText(), /غير موثوقة/);
    await evidence.getByLabel('اسم حيازة مرجع توضيحي').fill('باحث العينة');
    await evidence.getByRole('button', { name: 'إضافة إدخال وصفي' }).click();
    assert.match(await evidence.innerText(), /باحث العينة/);
    assert.match(await evidence.innerText(), /جلسة غير مؤرخة/);
    await d.getByRole('button', { name: 'قوالب الاستجابة', exact: true }).click();
    await d.locator('.workflow-designer>summary').click();
    await d.getByLabel('وصف خطوة الاستجابة').fill('مراجعة مخصصة');
    await d.getByRole('button', { name: 'إضافة خطوة' }).click();
    await d.getByRole('button', { name: 'نقل خطوة مراجعة مخصصة لأعلى' }).click();
    assert.match(await d.locator('.workflow-steps li').nth(2).innerText(), /مراجعة مخصصة/);
    assert.match(await d.locator('.workflow-designer').innerText(), /لا تشغيل آلي/);
    await noOverflow(page, 'case workspace');
    await d.getByRole('button', { name: 'إغلاق' }).click();

    await nav(page, 'الحوادث');
    await page.locator('.experience-module>summary').first().click();
    await page.getByLabel('المناوب المغادر').selectOption({ label: 'أحمد علي' });
    await page.getByLabel('المناوب المستلم').selectOption({ label: 'سارة أحمد' });
    await page.getByLabel('ملاحظة تسليم غير حساسة').fill('متابعة خلال المناوبة');
    await page.getByRole('button', { name: 'مراجعة المسودة محليًا' }).click();
    assert.match(await page.locator('.handover-review').innerText(), /لم يُرسل/);
    assert.match(await page.locator('.handover-scope').innerText(), /خارج الفترة/);
    assert.match(await page.locator('.experience-module[open]').innerText(), /تجاوز افتراضي/);
    await page.locator('.hunt-share>summary').click();
    assert.match(
      await page.getByLabel('ملخص التسليم التجريبي').inputValue(),
      /متابعة خلال المناوبة/,
    );
    await nav(page, 'مستكشف الأحداث');
    await page.locator('.hunt-workspace>summary').click();
    await page.getByRole('button', { name: 'مصادقة فاشلة' }).click();
    assert.match(await page.getByLabel('فرضية الصيد غير المثبتة').inputValue(), /قد/);
    assert.equal(await page.locator('.hunt-results button').count(), 1);
    await page.getByRole('button', { name: 'إضافة شرط' }).click();
    await page.getByRole('button', { name: 'إضافة شرط' }).click();
    assert.equal(await page.getByRole('button', { name: 'إضافة شرط' }).isDisabled(), true);
    await page.getByRole('button', { name: 'حذف الشرط ٣' }).click();
    assert.equal(await page.getByRole('button', { name: 'إضافة شرط' }).isDisabled(), false);
    await page.getByRole('button', { name: 'حفظ مؤقت' }).click();
    await page.getByLabel('فرضية الصيد غير المثبتة').fill('تعديل مؤقت');
    await page.getByRole('button', { name: 'استعادة', exact: true }).click();
    assert.match(await page.getByLabel('فرضية الصيد غير المثبتة').inputValue(), /المصادقة الفاشلة/);
    await page.locator('.hunt-share>summary').click();
    assert.match(await page.getByLabel('نص الاستعلام التجريبي').inputValue(), /فرضية غير مثبتة/);
    await noOverflow(page, 'hunting');

    await nav(page, 'قواعد الكشف');
    await page.locator('.rule-studio>summary').click();
    await page.getByLabel('اسم مسودة القاعدة').fill('قاعدة مقترحة غير منشورة');
    await page.getByLabel('وصف مسودة القاعدة').fill('وصف محلي جديد');
    await page.getByRole('button', { name: 'طلب مراجعة تجريبية' }).click();
    assert.match(await page.locator('.studio-status').innerText(), /بانتظار مراجعة شكلية/);
    await page.getByRole('button', { name: 'تسجيل مراجعة شكلية' }).click();
    assert.match(await page.locator('.studio-status').innerText(), /مراجعة شكلية للجلسة/);
    assert.doesNotMatch(
      await page.locator('.data-panel tbody').innerText(),
      /قاعدة مقترحة غير منشورة/,
    );
    await noOverflow(page, 'rule studio');
    await nav(page, 'مصادر البيانات');
    await page.locator('.integration-hub>summary').click();
    await page.locator('.integration-grid button').filter({ hasText: 'Syslog' }).click();
    assert.match(await page.locator('.integration-explainer').innerText(), /طريقة نقل سجلات/);
    assert.match(await page.locator('.integration-hub').innerText(), /لا يوجد اختبار اتصال/);
    await noOverflow(page, 'integration hub');
    await nav(page, 'الأصول');
    await page.locator('.vuln-module>summary').click();
    assert.match(await page.locator('.vuln-module').innerText(), /ليست اكتشافًا أو CVE/);
    await page.locator('.vuln-module .module-record-list button').first().click();
    d = drawer(page);
    await d.getByRole('button', { name: 'الخدمة والثغرات' }).click();
    assert.match(await d.innerText(), /خدمة المصادقة التجريبية/);
    assert.match(await d.innerText(), /غير متحقق/);
    await d.getByRole('button', { name: 'إغلاق' }).click();
    await nav(page, 'خريطة العلاقات');
    assert.match(
      await page.locator('.attack-path-panel').innerText(),
      /اقتران في السجل، لا انتقال/,
    );
    assert.match(await page.locator('.attack-path-panel').innerText(), /افتراض دون سجل انتقال/);
    await noOverflow(page, 'attack path');
    await nav(page, 'سجل التدقيق');
    assert.match(await page.locator('.data-panel thead').innerText(), /بصمة توضيحية/);
    await nav(page, 'الإعدادات');
    await page.getByRole('button', { name: /النسخ والاستعادة/ }).click();
    assert.match(
      await page.locator('.backup-recovery').innerText(),
      /منفصل عن النسخة الاحتياطية لملفات المشروع/,
    );
    assert.equal(await page.getByRole('button', { name: 'بدء نسخ فعلي' }).isDisabled(), true);
    assert.equal(await page.getByRole('button', { name: 'استعادة فعلية' }).isDisabled(), true);
    await page.getByRole('button', { name: 'خطة الاستعادة' }).click();
    assert.match(await page.locator('.backup-recovery').innerText(), /لم يُنفّذ أي إجراء/);
    await noOverflow(page, 'backup preview');
    await page.getByRole('button', { name: /الإعدادات العامة/ }).click();
    await page.getByRole('switch', { name: 'محاكاة انقطاع الاتصال' }).click();
    await nav(page, 'الحوادث');
    await page.locator('.data-panel tbody tr').filter({ hasText: 'INC-2026-084' }).click();
    d = drawer(page);
    await d.getByRole('button', { name: 'المتابعة وSLA' }).click();
    assert.equal(await d.getByLabel('سبب مقترح التصعيد').isDisabled(), true);
    assert.match(await d.locator('.escalation-saved').innerText(), /مراجعة بشرية تجريبية/);
    assert.equal(await d.getByRole('button', { name: 'حذف المقترح' }).isDisabled(), true);
    await d.getByRole('button', { name: 'مراجع الأدلة', exact: true }).click();
    assert.match(await d.innerText(), /مرجع توضيحي/);
    assert.equal(await d.getByLabel('عنوان المرجع التجريبي').isDisabled(), true);
    assert.equal(
      await d.getByRole('button', { name: 'حذف المرجع مرجع توضيحي' }).isDisabled(),
      true,
    );
    await d.getByRole('button', { name: 'قوالب الاستجابة', exact: true }).click();
    await d.locator('.workflow-designer>summary').click();
    assert.match(await d.innerText(), /مراجعة مخصصة/);
    assert.equal(await d.getByLabel('وصف خطوة الاستجابة').isDisabled(), true);
    await d.getByRole('button', { name: 'اسأل المساعد عن الحادثة' }).click();
    a = copilot(page);
    assert.equal(await a.getByLabel('سؤال للمساعد التجريبي').isDisabled(), true);
    await a.getByRole('button', { name: 'إغلاق' }).click();
    await d.getByRole('button', { name: 'إغلاق' }).click();
    await page.getByRole('button', { name: 'إنهاء المحاكاة' }).click();
    await nav(page, 'قواعد الكشف');
    await page.locator('.rule-studio>summary').click();
    assert.equal(
      await page.getByLabel('اسم مسودة القاعدة').inputValue(),
      'قاعدة مقترحة غير منشورة',
    );
    await nav(page, 'الحوادث');
    await page.locator('.experience-module>summary').first().click();
    assert.equal(
      await page.getByLabel('ملاحظة تسليم غير حساسة').inputValue(),
      'متابعة خلال المناوبة',
    );
    // References, custody and workflow drafts are isolated by incident ID.
    await page.locator('.data-panel tbody tr').filter({ hasText: 'INC-2026-083' }).click();
    d = drawer(page);
    await d.getByRole('button', { name: 'مراجع الأدلة', exact: true }).click();
    assert.doesNotMatch(await d.innerText(), /مرجع توضيحي/);
    await d.getByLabel('عنوان المرجع التجريبي').fill('مرجع الحادثة الثانية');
    await d.getByRole('button', { name: 'إضافة مرجع' }).click();
    let secondRef = d.locator('.evidence-record');
    await secondRef.locator('summary').click();
    await secondRef.getByLabel('اسم حيازة مرجع الحادثة الثانية').fill('مراجع الثانية');
    await secondRef.getByRole('button', { name: 'إضافة إدخال وصفي' }).click();
    await d.getByRole('button', { name: 'قوالب الاستجابة', exact: true }).click();
    await d.locator('.workflow-designer>summary').click();
    assert.doesNotMatch(await d.innerText(), /مراجعة مخصصة/);
    await d.getByLabel('وصف خطوة الاستجابة').fill('تدفق الحادثة الثانية');
    await d.getByRole('button', { name: 'إضافة خطوة' }).click();
    await d.getByRole('button', { name: 'إغلاق' }).click();
    await page.locator('.data-panel tbody tr').filter({ hasText: 'INC-2026-084' }).click();
    d = drawer(page);
    await d.getByRole('button', { name: 'مراجع الأدلة', exact: true }).click();
    assert.match(await d.innerText(), /مرجع توضيحي/);
    assert.doesNotMatch(await d.innerText(), /مرجع الحادثة الثانية|مراجع الثانية/);
    await d.getByRole('button', { name: 'قوالب الاستجابة', exact: true }).click();
    await d.locator('.workflow-designer>summary').click();
    assert.match(await d.innerText(), /مراجعة مخصصة/);
    assert.doesNotMatch(await d.innerText(), /تدفق الحادثة الثانية/);
    await d.getByRole('button', { name: 'إغلاق' }).click();
    await page.locator('.data-panel tbody tr').filter({ hasText: 'INC-2026-083' }).click();
    d = drawer(page);
    await d.getByRole('button', { name: 'مراجع الأدلة', exact: true }).click();
    assert.match(await d.innerText(), /مرجع الحادثة الثانية/);
    await d.locator('.evidence-record summary').click();
    assert.match(await d.innerText(), /مراجع الثانية/);
    assert.doesNotMatch(await d.innerText(), /مرجع توضيحي/);
    await d.getByRole('button', { name: 'قوالب الاستجابة', exact: true }).click();
    await d.locator('.workflow-designer>summary').click();
    assert.match(await d.innerText(), /تدفق الحادثة الثانية/);
    await d.getByRole('button', { name: 'إغلاق' }).click();

    await page.reload();
    await login(page);
    await nav(page, 'الحوادث');
    await page.locator('.data-panel tbody tr').filter({ hasText: 'INC-2026-084' }).click();
    d = drawer(page);
    await d.getByRole('button', { name: 'مراجع الأدلة', exact: true }).click();
    assert.doesNotMatch(await d.innerText(), /مرجع توضيحي/);
    await d.getByRole('button', { name: 'قوالب الاستجابة', exact: true }).click();
    await d.locator('.workflow-designer>summary').click();
    assert.doesNotMatch(await d.innerText(), /مراجعة مخصصة/);
    await d.getByRole('button', { name: 'اسأل المساعد عن الحادثة' }).click();
    a = copilot(page);
    assert.equal(await a.locator('.copilot-exchange').count(), 0);
    await a.getByRole('button', { name: 'إغلاق' }).click();
    await d.getByRole('button', { name: 'إغلاق' }).click();
    await page.locator('.experience-module>summary').first().click();
    assert.equal(await page.getByLabel('ملاحظة تسليم غير حساسة').inputValue(), '');
    await nav(page, 'قواعد الكشف');
    await page.locator('.rule-studio>summary').click();
    assert.notEqual(
      await page.getByLabel('اسم مسودة القاعدة').inputValue(),
      'قاعدة مقترحة غير منشورة',
    );
    clean(run);
    console.log(
      `PASS final UI ${theme}/${width} · scoped records, context, per-incident isolation, local edits and reset`,
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
    await run(browser, { width: 1440, theme: 'dark' });
    await run(browser, { width: 320, theme: 'light' });
    console.log(`PASS final experience · ${name}`);
  } finally {
    await browser.close();
  }
}

// Opaque-origin sandbox: the most important new controls work without a form
// submission, network or storage privileges.
const html = fs.readFileSync('dist/index.html', 'utf8');
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
    await page.locator('iframe').evaluate((el, src) => {
      el.srcdoc = src;
    }, html);
    const frame = page.frameLocator('iframe');
    await login(frame);
    await frame.getByRole('button', { name: 'استكشف رحلة التحقيق' }).click();
    const d = frame.locator('.detail-layer-active .drawer');
    await d.getByRole('button', { name: 'اسأل المساعد عن الحادثة' }).click();
    const a = frame.getByRole('dialog', { name: 'المساعد التجريبي' });
    await a.getByLabel('سؤال للمساعد التجريبي').fill('ما السجلات؟');
    await a.getByRole('button', { name: 'عرض الرد التجريبي' }).click();
    assert.match(await a.locator('.copilot-reply').innerText(), /EVT-90481/);
    await a.getByRole('button', { name: 'إغلاق' }).click();
    await d.getByRole('button', { name: 'مراجع الأدلة', exact: true }).click();
    await d.getByLabel('عنوان المرجع التجريبي').fill('مرجع معزول');
    await d.getByRole('button', { name: 'إضافة مرجع' }).click();
    assert.match(await d.innerText(), /مرجع معزول/);
    await d.getByRole('button', { name: 'قوالب الاستجابة', exact: true }).click();
    await d.locator('.workflow-designer>summary').click();
    await d.getByLabel('وصف خطوة الاستجابة').fill('خطوة معزولة');
    await d.getByRole('button', { name: 'إضافة خطوة' }).click();
    assert.match(await d.innerText(), /خطوة معزولة/);
    assert.deepEqual(errors, []);
    assert.deepEqual(requests, []);
    console.log(`PASS ${name} · opaque sandbox final controls`);
  } finally {
    await context.close();
    await browser.close();
  }
}
console.log('PASS final local experience. The UI does not execute SOC services or real AI.');
