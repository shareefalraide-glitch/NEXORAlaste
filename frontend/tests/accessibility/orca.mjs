// Optional targeted Orca + Firefox speech-output checks, run in fresh Xvfb
// sessions per scenario. Logs are deleted; no human listening is implied.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import { firefox } from 'playwright';
import { assert, builtUrl, nav } from '../support/helpers.mjs';
const scenario = process.argv[2] || 'search';
if (
  !['search', 'settings', 'layout', 'group', 'incident', 'asset', 'map', 'import'].includes(
    scenario,
  )
)
  throw Error('Unknown Orca scenario');
let incompleteAnnouncements = 0;
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'nexora-orca-')),
  log = path.join(scratch, 'orca.log');
const wm = spawn('openbox', [], { stdio: 'ignore' }),
  orca = spawn('orca', ['--replace', '--disable', 'braille', '--debug-file', log], {
    stdio: 'ignore',
  });
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
function contents() {
  try {
    return fs.readFileSync(log, 'utf8');
  } catch {
    return '';
  }
}
async function heard(fragment, start = 0) {
  const deadline = Date.now() + 12000;
  while (Date.now() < deadline) {
    const text = contents()
      .slice(start)
      .split('\n')
      .filter(line => line.includes('SPEECH OUTPUT:'))
      .join('\n');
    if ((Array.isArray(fragment) ? fragment : [fragment]).some(value => text.includes(value)))
      return;
    if (orca.exitCode !== null) throw Error(`Orca exited: ${orca.exitCode}`);
    await wait(120);
  }
  throw Error(
    `Orca did not announce ${JSON.stringify(fragment)}. Recent speech: ${contents()
      .split('\n')
      .filter(line => line.includes('SPEECH OUTPUT:'))
      .slice(-6)
      .join('\n')}`,
  );
}
async function step(label, action, fragment) {
  const start = contents().length;
  await action();
  await heard(fragment, start);
  await wait(350);
  console.log(`PASS Orca announcement · ${label}`);
}
async function optionalStep(label, action, fragment) {
  const start = contents().length;
  await action();
  try {
    await heard(fragment, start);
    await wait(350);
    console.log(`PASS Orca announcement · ${label}`);
  } catch (error) {
    if (!error.message.startsWith('Orca did not announce')) throw error;
    incompleteAnnouncements++;
    console.log(`INCOMPLETE Orca announcement · ${label}; human review required`);
  }
}
let browser;
try {
  await heard('Screen reader on.');
  browser = await firefox.launch({
    headless: false,
    env: { ...process.env, MOZ_ACCESSIBILITY_FORCE_ENABLED: '1', GTK_MODULES: 'atk-bridge' },
  });
  const context = await browser.newContext({
    viewport: { width: 1200, height: 900 },
    reducedMotion: 'reduce',
  });
  const page = await context.newPage();
  await page.goto(builtUrl, { waitUntil: 'load' });
  await page.getByText('استخدام بيانات تجريبية', { exact: true }).click();
  await page.getByText('المتابعة إلى التحقق', { exact: true }).click();
  await page.getByText('ملء الرمز', { exact: true }).click();
  await page.getByText('التحقق والدخول', { exact: true }).click();
  await page.locator('#primary-navigation').waitFor({ state: 'attached' });
  await page.bringToFront();
  await wait(400);
  const windows = execFileSync('xdotool', ['search', '--onlyvisible', '--name', 'NEXORA'], {
    timeout: 5000,
  })
    .toString()
    .trim()
    .split('\n');
  execFileSync('xdotool', ['windowactivate', '--sync', windows.at(-1)], { timeout: 5000 });
  await wait(600);
  if (scenario === 'search') {
    await step(
      'search field',
      () => page.getByRole('button', { name: 'البحث في المنصة' }).click(),
      'ابحث عن حادثة، تنبيه، أصل، مصدر بيانات أو عنوان IP أو MAC',
    );
    await step(
      'search severity filter',
      () => page.getByLabel('خطورة البحث').focus(),
      'خطورة البحث',
    );
    await page.keyboard.press('Escape');
  }
  if (scenario === 'settings') {
    await nav(page, 'الإعدادات');
    await step(
      'shortcuts section',
      () => page.getByRole('button', { name: /اختصارات لوحة المفاتيح/ }).click(),
      'اختصارات لوحة المفاتيح',
    );
    await step(
      'shortcut customization',
      () => page.getByRole('button', { name: 'تغيير اختصار فتح البحث العام' }).focus(),
      'تغيير اختصار فتح البحث العام',
    );
    await step(
      'shortcut capture',
      () => page.keyboard.press('Enter'),
      'إدخال اختصار فتح البحث العام',
    );
    await page.keyboard.press('Escape');
  }
  if (scenario === 'layout') {
    await nav(page, 'الإعدادات');
    await step(
      'layout section',
      () => page.getByRole('button', { name: /تخصيص الواجهة/ }).click(),
      'تخصيص الواجهة',
    );
    await step('density option', () => page.getByLabel('مضغوطة').focus(), 'مضغوطة');
  }
  if (scenario === 'group') {
    await nav(page, 'التنبيهات');
    await page.getByLabel('تجميع التنبيهات').selectOption('asset');
    await wait(500);
    const group = page.locator('tbody[aria-label="الأصل WS-FIN-024"]'),
      toggle = group.getByRole('button', { name: /الأصل: WS-FIN-024/ });
    await step('group label and expanded state', () => toggle.focus(), 'WS-FIN-024');
    assert.equal(await toggle.getAttribute('aria-expanded'), 'true');
    await toggle.click();
    assert.equal(await toggle.getAttribute('aria-expanded'), 'false');
    console.log('PASS group collapsed DOM state (Orca announcement requires manual review)');
  }
  if (scenario === 'incident') {
    await nav(page, 'الحوادث');
    await page.locator('table tbody tr').filter({ hasText: 'INC-2026-084' }).click();
    const panel = page.locator('.detail-layer-active .drawer');
    await wait(700);
    const tab = panel.getByRole('button', { name: 'المهام والملاحظات' });
    await step('incident workspace tab', () => tab.focus(), 'المهام والملاحظات');
    await step('workspace selected', () => page.keyboard.press('Enter'), 'pressed');
    assert.equal(await tab.getAttribute('aria-pressed'), 'true');
  }
  if (scenario === 'asset') {
    await nav(page, 'الأصول');
    await page.locator('table tbody tr').filter({ hasText: 'AST-001' }).click();
    const panel = page.locator('.detail-layer-active .drawer');
    await wait(700);
    const tab = panel.getByRole('button', { name: /واجهات الشبكة/ });
    await step('asset interfaces tab', () => tab.focus(), 'واجهات الشبكة');
    await tab.click();
    const add = panel.getByRole('button', { name: 'إضافة واجهة' });
    await optionalStep(
      'add interface',
      async () => {
        await add.focus();
        assert.equal(await add.evaluate(el => el === document.activeElement), true);
      },
      'إضافة واجهة',
    );
    await add.click();
    const form = page.getByRole('dialog', { name: 'إضافة واجهة شبكة' });
    await optionalStep(
      'interface IP field',
      async () => {
        await form.getByLabel('عنوان IP للواجهة').focus();
        assert.equal(
          await form.getByLabel('عنوان IP للواجهة').evaluate(el => el === document.activeElement),
          true,
        );
      },
      'عنوان IP للواجهة',
    );
    await form.getByLabel('اسم واجهة الشبكة').fill('eth2');
    await form.getByLabel('عنوان IP للواجهة').fill('bad');
    await form.getByRole('button', { name: 'إضافة الواجهة' }).click();
    assert.equal(await form.getByLabel('عنوان IP للواجهة').getAttribute('aria-invalid'), 'true');
    console.log('PASS invalid interface DOM state (announcement requires human review)');
  }
  if (scenario === 'map') {
    await nav(page, 'خريطة العلاقات');
    const node = page.getByRole('button', { name: 'مصدر مستشعر حدود الشبكة SRC-002' });
    await step('relationship node label', () => node.focus(), 'مستشعر حدود الشبكة');
    await page.keyboard.press('Enter');
    assert.equal(await node.getAttribute('aria-pressed'), 'true');
    console.log('PASS map selected DOM state (announcement requires human review)');
  }
  if (scenario === 'import') {
    await nav(page, 'الأصول');
    await page.getByRole('button', { name: 'استيراد CSV' }).click();
    const form = page.getByRole('dialog', { name: 'استيراد أصول CSV' });
    await step('CSV text field', () => form.getByLabel('نص CSV للأصول').focus(), 'نص CSV للأصول');
    await form.getByRole('button', { name: 'استخدام مثال تجريبي' }).click();
    await form.getByRole('button', { name: 'معاينة والتحقق' }).click();
    await wait(500);
    const duplicate = form.getByLabel('اختيار الصف 2: AD-SRV-01');
    await optionalStep(
      'duplicate row checkbox label',
      async () => {
        await duplicate.focus();
        assert.equal(await duplicate.evaluate(el => el === document.activeElement), true);
      },
      'AD-SRV-01',
    );
    assert.equal(await duplicate.isChecked(), false);
    console.log('PASS duplicate unselected DOM state (announcement requires human review)');
  }
  await context.close();
  console.log(
    `${incompleteAnnouncements ? 'INCOMPLETE' : 'PASS'} targeted Orca/Firefox ${scenario} speech-output smoke (${incompleteAnnouncements} unresolved announcements); no human pronunciation assessment.`,
  );
  if (incompleteAnnouncements) process.exitCode = 2;
} finally {
  await browser?.close();
  orca.kill('SIGKILL');
  wm.kill('SIGKILL');
  await wait(100);
  fs.rmSync(scratch, { recursive: true, force: true });
}
