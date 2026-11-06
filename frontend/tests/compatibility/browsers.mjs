// Browser-engine smoke tests use Playwright Chromium, Firefox and WebKit; they are
// not a substitute for retail Chrome, Firefox, Safari or real assistive technologies.
import fs from 'node:fs';
import http from 'node:http';
import { chromium, firefox, webkit } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import { assert, builtUrl, newPage, login, nav, noOverflow, clean } from '../support/helpers.mjs';

const html = fs.readFileSync('dist/index.html');
const favicon =
  'data:image/png;base64,' + fs.readFileSync('src/assets/nexora-icon.png').toString('base64');
const logos = {
  dark: fs.readFileSync('src/assets/nexora-logo-dark.png'),
  light: fs.readFileSync('src/assets/nexora-logo-light.png'),
};
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
const server = http.createServer((req, res) => {
  if (req.url === '/demo') {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(html);
  } else {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(
      '<!doctype html><html><body style="margin:0"><iframe title="preview" sandbox="allow-scripts" src="/demo" style="width:100%;height:100vh;border:0"></iframe></body></html>',
    );
  }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
try {
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
      for (const [theme, width] of [
        ['dark', 1440],
        ['light', 320],
      ]) {
        const run = await newPage(browser, { theme, width }),
          { page } = run;
        try {
          const mesh = page.getByTestId('neural-mesh');
          await page.locator('[data-testid="neural-mesh"][data-motion="animated"]').waitFor();
          assert.equal(await mesh.getAttribute('aria-hidden'), 'true');
          assert.equal(await mesh.isVisible(), true);
          assert.ok(
            await mesh.evaluate(
              c =>
                c.width > 0 &&
                c.height > 0 &&
                c
                  .getContext('2d')
                  .getImageData(Math.floor(c.width / 2), Math.floor(c.height * 0.44), 1, 1)
                  .data[3] > 0,
            ),
            `${name}/${theme}/${width} painted globe`,
          );
          assert.equal(await page.getByRole('button', { name: 'حركة الكرة' }).count(), 0);
          assert.equal(await page.locator('.auth-motion-hint').count(), 0);
          await noOverflow(page, `${name}/${theme}/${width} login`);
          await axe(page, `${name}/${theme}/${width} login`);
          const logoSrc = await page.locator('.auth-aside-logo').getAttribute('src');
          assert.ok(
            logoSrc.startsWith('data:image/png;base64,') &&
              Buffer.from(logoSrc.split(',')[1], 'base64').equals(logos[theme]),
            `${name}/${theme} retains its theme-specific wordmark`,
          );
          assert.equal(
            await page.locator('link[rel="icon"]').getAttribute('href'),
            favicon,
            `${name}/${theme} project favicon is self-contained`,
          );
          assert.equal(
            await page
              .locator('body img')
              .evaluateAll(
                (imgs, src) => imgs.some(img => img.getAttribute('src') === src),
                favicon,
              ),
            false,
            `${name}/${theme} no icon in login`,
          );
          await login(page);
          assert.equal(
            await page.locator('.brand-logo').getAttribute('src'),
            logoSrc,
            `${name}/${theme} same theme wordmark on sidebar`,
          );
          assert.equal(
            await page
              .locator('body img')
              .evaluateAll(
                (imgs, src) => imgs.some(img => img.getAttribute('src') === src),
                favicon,
              ),
            false,
            `${name}/${theme} no icon inside platform`,
          );
          assert.equal(await mesh.count(), 0, `${name} mesh removed after login`);
          const search = page.getByRole('button', { name: 'البحث في المنصة' });
          await search.focus();
          await page.keyboard.press('Alt+k');
          const modal = page.getByRole('dialog', { name: 'البحث في المنصة' });
          await modal.waitFor();
          const field = modal.getByLabel(
            'ابحث عن حادثة، تنبيه، أصل، مصدر بيانات أو عنوان IP أو MAC',
          );
          await field.fill('10.20.4.24');
          assert.match(await modal.locator('.search-results').innerText(), /ALT-1282/);
          await modal.getByLabel('خطورة البحث').selectOption({ label: 'عالية' });
          assert.doesNotMatch(await modal.locator('.search-results').innerText(), /ALT-1279/);
          await modal.getByRole('button', { name: 'إعادة ضبط' }).click();
          await field.fill('02-20-00-01-00-01');
          assert.match(
            await modal.locator('section[aria-label="نتائج الأصول"]').innerText(),
            /AD-SRV-01/,
          );
          await field.fill('022000020001');
          assert.match(
            await modal.locator('section[aria-label="نتائج المصادر"]').innerText(),
            /SRC-001/,
          );
          await axe(page, `${name}/${theme}/${width} search`);
          await page.keyboard.press('Escape');
          assert.equal(await search.evaluate(el => el === document.activeElement), true);
          await nav(page, 'التنبيهات');
          await page.getByLabel('تجميع التنبيهات').selectOption('asset');
          const group = page.locator('tbody[aria-label="الأصل WS-FIN-024"]');
          assert.equal(await group.locator('tr.clickable-row').count(), 3);
          await group.getByRole('button', { name: /الأصل: WS-FIN-024/ }).click();
          assert.equal(await group.locator('tr.clickable-row').count(), 0);
          await axe(page, `${name}/${theme}/${width} groups`);
          await noOverflow(page, `${name}/${theme}/${width} grouped alerts`);
          await nav(page, 'الحوادث');
          await page.locator('table tbody tr').filter({ hasText: 'INC-2026-084' }).click();
          const panel = page.locator('.detail-layer-active .drawer');
          await panel.getByRole('button', { name: 'المهام والملاحظات' }).click();
          await panel.getByLabel('ملاحظة جديدة للحادثة').fill('نص اختبار غير حساس');
          await panel.getByRole('button', { name: 'إضافة ملاحظة' }).click();
          assert.match(await panel.locator('.case-notes').innerText(), /نص اختبار غير حساس/);
          await axe(page, `${name}/${theme}/${width} workspace`);
          await panel.getByRole('button', { name: 'إغلاق' }).click();
          await nav(page, 'الأصول');
          await page.getByRole('button', { name: 'إضافة أصل' }).click();
          const assetForm = page.getByRole('dialog', { name: 'إضافة أصل' });
          await assetForm.getByLabel('اسم الأصل').fill('BROWSER-MAC');
          await assetForm.getByLabel('عنوان IP').fill('192.0.2.50');
          await assetForm.getByLabel('المالك').fill('فريق العرض');
          await assetForm.getByLabel('عنوان MAC', { exact: true }).fill('wrong');
          await assetForm.getByRole('button', { name: 'إضافة الأصل' }).click();
          assert.equal(
            await assetForm.getByLabel('عنوان MAC', { exact: true }).getAttribute('aria-invalid'),
            'true',
          );
          await assetForm.getByLabel('عنوان MAC', { exact: true }).fill('02-12-34-56-78-9a');
          await assetForm.getByLabel('عنوان MAC', { exact: true }).press('Enter');
          assert.match(
            await page.locator('table tbody tr').filter({ hasText: 'BROWSER-MAC' }).innerText(),
            /02:12:34:56:78:9A/,
          );
          await noOverflow(page, `${name}/${theme}/${width} MAC asset`);
          await page.locator('table tbody tr').filter({ hasText: 'BROWSER-MAC' }).click();
          const assetPanel = page.locator('.detail-layer-active .drawer');
          await assetPanel.getByRole('button', { name: /واجهات الشبكة/ }).click();
          await assetPanel.getByRole('button', { name: 'إضافة واجهة' }).click();
          let networkForm = page.getByRole('dialog', { name: 'إضافة واجهة شبكة' });
          await networkForm.getByLabel('اسم واجهة الشبكة').fill('eth1');
          await networkForm.getByLabel('عنوان IP للواجهة').fill('192.0.2.51');
          await networkForm.getByLabel('VLAN').fill('100');
          assert.equal(await networkForm.getByLabel('عنوان IP للواجهة').inputValue(), '192.0.2.51');
          await networkForm.getByRole('button', { name: 'إضافة الواجهة' }).click();
          await networkForm.waitFor({ state: 'detached' });
          assert.match(await assetPanel.innerText(), /192.0.2.51/);
          await assetPanel.getByRole('button', { name: 'إغلاق' }).click();
          await nav(page, 'خريطة العلاقات');
          await page
            .getByPlaceholder('بحث باسم الجهاز أو الأصل أو الحادثة أو المعرّف')
            .fill('BROWSER-MAC');
          const node = page.locator('.relationship-asset .relationship-node');
          await node.focus();
          await page.keyboard.press('Enter');
          assert.equal(await node.getAttribute('aria-pressed'), 'true');
          assert.match(
            await page.locator('.relationship-selection').innerText(),
            /لا توجد علاقة مباشرة/,
          );
          await axe(page, `${name}/${theme}/${width} map selection`);
          await noOverflow(page, `${name}/${theme}/${width} relationships`);
          await nav(page, 'الأصول');
          await page.getByRole('button', { name: 'استيراد CSV' }).click();
          const csvForm = page.getByRole('dialog', { name: 'استيراد أصول CSV' });
          await csvForm.getByRole('button', { name: 'استخدام مثال تجريبي' }).click();
          await csvForm.getByRole('button', { name: 'معاينة والتحقق' }).click();
          assert.equal(await csvForm.getByLabel('اختيار الصف 2: AD-SRV-01').isChecked(), false);
          await axe(page, `${name}/${theme}/${width} import preview`);
          await noOverflow(page, `${name}/${theme}/${width} CSV preview`);
          await csvForm.getByRole('button', { name: 'إضافة المحدد للعينة' }).click();
          assert.match(
            await page.locator('table tbody tr').filter({ hasText: 'LAB-DEMO-01' }).innerText(),
            /192.0.2.70/,
          );
          await nav(page, 'الإعدادات');
          await page.getByRole('button', { name: /تخصيص الواجهة/ }).click();
          await page.getByLabel('مضغوطة').check();
          assert.equal(await page.locator('.app-shell').getAttribute('data-density'), 'compact');
          await noOverflow(page, `${name}/${theme}/${width} personalization`);
          await page.getByRole('button', { name: /اختصارات لوحة المفاتيح/ }).click();
          await page.getByRole('button', { name: 'تغيير اختصار فتح البحث العام' }).click();
          await page.keyboard.press('Alt+j');
          await page.waitForFunction(
            () =>
              document.querySelector('.top-search')?.getAttribute('aria-keyshortcuts') === 'Alt+J',
          );
          await page.keyboard.press('Alt+j');
          await modal.waitFor();
          await page.keyboard.press('Escape');
          await page.reload();
          await login(page);
          assert.equal(await page.locator('.app-shell').getAttribute('data-density'), 'compact');
          assert.equal(
            await page
              .getByRole('button', { name: 'البحث في المنصة' })
              .getAttribute('aria-keyshortcuts'),
            'Alt+J',
          );
          clean(run);
          console.log(
            `PASS ${name} · ${theme} · ${width}px · standalone globe/login/assets/relationships/CSV/keyboard/preferences and axe`,
          );
        } finally {
          await run.context.close();
        }
      }
      const motionContext = await browser.newContext({
        viewport: { width: 900, height: 700 },
        reducedMotion: 'no-preference',
      });
      try {
        const motionPage = await motionContext.newPage();
        await motionPage.goto(builtUrl);
        await motionPage.bringToFront();
        const globe = motionPage.getByTestId('neural-mesh');
        await motionPage.locator('[data-testid="neural-mesh"][data-motion="animated"]').waitFor();
        const bounds = await globe.boundingBox();
        await motionPage.mouse.move(
          bounds.x + bounds.width * 0.325,
          bounds.y + bounds.height * 0.5,
        );
        let angle = await globe.evaluate(c => c.__nexoraRotation);
        await motionPage.waitForFunction(
          a =>
            Math.abs(document.querySelector('[data-testid="neural-mesh"]').__nexoraRotation - a) >
            0.05,
          angle,
          { timeout: 10000, polling: 250 },
        );
        const hero = await motionPage.locator('.auth-aside').boundingBox();
        await motionPage.mouse.move(hero.x + hero.width * 0.1, hero.y + hero.height * 0.1);
        await motionPage.waitForFunction(
          () => document.querySelector('[data-testid="neural-mesh"]').__nexoraTilt < -0.25,
          null,
          { timeout: 10000, polling: 100 },
        );
        angle = await globe.evaluate(c => c.__nexoraRotation);
        await motionPage.waitForFunction(
          a => document.querySelector('[data-testid="neural-mesh"]').__nexoraRotation < a - 0.1,
          angle,
          { timeout: 10000, polling: 100 },
        );
        await motionPage.mouse.move(hero.x + hero.width * 0.9, hero.y + hero.height * 0.9);
        await motionPage.waitForFunction(
          () => document.querySelector('[data-testid="neural-mesh"]').__nexoraTilt > -0.1,
          null,
          { timeout: 10000, polling: 100 },
        );
        angle = await globe.evaluate(c => c.__nexoraRotation);
        await motionPage.waitForFunction(
          a => document.querySelector('[data-testid="neural-mesh"]').__nexoraRotation > a + 0.1,
          angle,
          { timeout: 10000, polling: 100 },
        );
        // Autoplay is deliberately requested for this demo despite the OS setting.
        await motionPage.emulateMedia({ reducedMotion: 'reduce' });
        assert.equal(await globe.getAttribute('data-motion'), 'animated');
        assert.equal(await motionPage.getByRole('button', { name: 'حركة الكرة' }).count(), 0);
        assert.equal(await motionPage.locator('.auth-motion-hint').count(), 0);
        angle = await globe.evaluate(c => c.__nexoraRotation);
        await motionPage.waitForFunction(
          a =>
            Math.abs(document.querySelector('[data-testid="neural-mesh"]').__nexoraRotation - a) >
            0.05,
          angle,
          { timeout: 10000, polling: 250 },
        );
        await motionPage.emulateMedia({ reducedMotion: 'no-preference' });
        assert.equal(await globe.getAttribute('data-motion'), 'animated');
        angle = await globe.evaluate(c => c.__nexoraRotation);
        await motionPage.waitForFunction(
          a =>
            Math.abs(document.querySelector('[data-testid="neural-mesh"]').__nexoraRotation - a) >
            0.05,
          angle,
          { timeout: 10000, polling: 250 },
        );
        console.log(`PASS ${name} · autoplay with pointer direction and no motion control`);
      } finally {
        await motionContext.close();
      }
      const context = await browser.newContext({
          viewport: { width: 1280, height: 900 },
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
        await context.route('**/*', route => {
          if (!route.request().url().startsWith(origin)) {
            external.push(route.request().url());
            return route.abort();
          }
          return route.continue();
        });
        await page.goto(origin);
        const frame = page.frameLocator('iframe');
        const frameMesh = frame.getByTestId('neural-mesh');
        await frame.locator('[data-testid="neural-mesh"][data-motion="animated"]').waitFor();
        assert.equal(await frameMesh.isVisible(), true);
        assert.equal(await frame.getByRole('button', { name: 'حركة الكرة' }).count(), 0);
        assert.equal(await frame.locator('.auth-motion-hint').count(), 0);
        assert.equal(
          await frame.locator('link[rel="icon"]').getAttribute('href'),
          favicon,
          `${name} iframe contains project favicon`,
        );
        assert.equal(
          await frame
            .locator('body img')
            .evaluateAll((imgs, src) => imgs.some(img => img.getAttribute('src') === src), favicon),
          false,
          `${name} no icon in iframe body`,
        );
        const frameAngle = await frameMesh.evaluate(c => c.__nexoraRotation);
        await page
          .frame({ url: `${origin}/demo` })
          .waitForFunction(
            a =>
              Math.abs(document.querySelector('[data-testid="neural-mesh"]').__nexoraRotation - a) >
              0.05,
            frameAngle,
            { timeout: 10000, polling: 250 },
          );
        await frame.getByRole('button', { name: 'تفعيل المظهر الفاتح' }).click();
        assert.equal(await frame.locator('html').getAttribute('data-theme'), 'light');
        await frame.getByRole('button', { name: 'تفعيل المظهر الداكن' }).click();
        assert.equal(await frame.locator('html').getAttribute('data-theme'), 'dark');
        await login(frame);
        assert.equal(await frameMesh.count(), 0);
        await frame.getByRole('button', { name: 'NEXORA الصفحة الرئيسية' }).focus();
        await page.keyboard.press('Alt+k');
        const modal = frame.getByRole('dialog', { name: 'البحث في المنصة' });
        await modal.waitFor();
        await modal
          .getByLabel('ابحث عن حادثة، تنبيه، أصل، مصدر بيانات أو عنوان IP أو MAC')
          .fill('ALT-1284');
        assert.match(await modal.locator('.search-results').innerText(), /ALT-1284/);
        await page.keyboard.press('Escape');
        await frame
          .locator('#primary-navigation')
          .getByText('مصادر البيانات', { exact: true })
          .click();
        await frame.getByRole('button', { name: 'إضافة مصدر' }).click();
        const sourceForm = frame.getByRole('dialog', { name: 'إضافة مصدر بيانات' });
        await sourceForm.getByLabel('اسم المصدر').fill('مصدر MAC تجريبي');
        await sourceForm.getByLabel('عنوان MAC', { exact: true }).fill('02-12-34-56-78-9a');
        await sourceForm.getByLabel('عنوان MAC', { exact: true }).press('Enter');
        await sourceForm.getByRole('button', { name: 'التالي' }).click();
        await sourceForm.getByRole('button', { name: 'إضافة إلى العينة' }).click();
        assert.match(await frame.locator('.source-card').first().innerText(), /02:12:34:56:78:9A/);
        await frame.locator('#primary-navigation').getByText('الأصول', { exact: true }).click();
        await frame.getByRole('button', { name: 'استيراد CSV' }).click();
        const importForm = frame.getByRole('dialog', { name: 'استيراد أصول CSV' });
        await importForm.getByLabel('اختيار ملف CSV للأصول').setInputFiles({
          name: 'sample.csv',
          mimeType: 'text/csv',
          buffer: Buffer.from('اسم الأصل,عنوان IP\nIFRAME-ASSET,192.0.2.88'),
        });
        await importForm.getByRole('button', { name: 'معاينة والتحقق' }).click();
        await importForm.getByRole('button', { name: 'إضافة المحدد للعينة' }).click();
        assert.match(
          await frame.locator('table tbody tr').filter({ hasText: 'IFRAME-ASSET' }).innerText(),
          /192.0.2.88/,
        );
        await frame
          .locator('#primary-navigation')
          .getByText('خريطة العلاقات', { exact: true })
          .click();
        await frame
          .getByPlaceholder('بحث باسم الجهاز أو الأصل أو الحادثة أو المعرّف')
          .fill('IFRAME-ASSET');
        await frame.locator('.relationship-asset .relationship-node').click();
        assert.match(await frame.locator('.relationship-selection').innerText(), /IFRAME-ASSET/);
        await frame.locator('#primary-navigation').getByText('الإعدادات', { exact: true }).click();
        await frame.getByRole('button', { name: /تخصيص الواجهة/ }).click();
        await frame.getByLabel('مضغوطة').check();
        assert.equal(await frame.locator('.app-shell').getAttribute('data-density'), 'compact');
        await frame.getByRole('button', { name: /اختصارات لوحة المفاتيح/ }).click();
        await frame.getByRole('button', { name: 'تغيير اختصار فتح البحث العام' }).click();
        await page.keyboard.press('Alt+j');
        await page
          .frame({ url: `${origin}/demo` })
          .waitForFunction(
            () =>
              document.querySelector('.top-search')?.getAttribute('aria-keyshortcuts') === 'Alt+J',
          );
        await page.keyboard.press('Alt+j');
        await modal.waitFor();
        await page.keyboard.press('Escape');
        await frame.locator('#primary-navigation').getByText('الحوادث', { exact: true }).click();
        await frame.locator('table tbody tr').filter({ hasText: 'INC-2026-084' }).click();
        const panel = frame.locator('.detail-layer-active .drawer');
        await panel.getByRole('button', { name: 'المهام والملاحظات' }).click();
        await panel.getByLabel('ملاحظة جديدة للحادثة').fill('عينة');
        await panel.getByRole('button', { name: 'إضافة ملاحظة' }).click();
        assert.match(await panel.innerText(), /عينة/);
        await page.reload();
        await login(frame);
        assert.equal(await frame.locator('.app-shell').getAttribute('data-density'), 'comfortable');
        assert.equal(
          await frame
            .getByRole('button', { name: 'البحث في المنصة' })
            .getAttribute('aria-keyshortcuts'),
          'Alt+K',
        );
        assert.deepEqual(errors, []);
        assert.deepEqual(external, []);
        console.log(
          `PASS ${name} · sandboxed iframe · globe/theme/assets/CSV/map/keyboard and localStorage fallback`,
        );
      } finally {
        await context.close();
      }
    } finally {
      await browser.close();
    }
  }
} finally {
  await new Promise(resolve => server.close(resolve));
}
console.log('PASS focused browser-engine checks; no backend or real network operations.');
