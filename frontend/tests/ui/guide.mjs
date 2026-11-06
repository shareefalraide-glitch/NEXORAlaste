// Read-only tutorial: all steps, safe navigation, progress, focus, responsive
// placement, motion preference and opaque iframe. No backend is tested.
import fs from 'node:fs';
import { chromium, firefox, webkit } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import { assert, builtUrl, login, nav, noOverflow } from '../support/helpers.mjs';
import { guideChapters, guideSteps } from '../../src/features/guide/guide-data.js';

const html = fs.readFileSync('dist/index.html', 'utf8');
const layer = root => root.locator('.tour-layer');
const dialog = root => root.locator('.tour-dialog');
const step = (root, id) =>
  root.locator(`.tour-layer[data-guide-step="${id}"][data-target-found="true"] .tour-spotlight`);
const drawer = root => root.locator('.detail-layer-active .drawer');
const progress = root => root.locator('.start-guide .guide-progress');
async function start(root) {
  await root.getByRole('button', { name: 'ابدأ الجولة' }).click();
  await step(root, 'welcome').waitFor();
}
async function next(root) {
  await dialog(root).getByRole('button', { name: 'التالي', exact: true }).click();
}
async function chapter(root, title) {
  await dialog(root).getByRole('button', { name: 'فهرس المحاور' }).click();
  await dialog(root)
    .getByRole('navigation', { name: 'فهرس محاور الجولة' })
    .getByRole('button', { name: new RegExp(title) })
    .click();
}
async function sidebar(root) {
  const menu = root.getByRole('button', { name: 'فتح القائمة' });
  if (await menu.isVisible()) await menu.click();
  await root.locator('.sidebar-guide').click();
}
async function introContinue(root) {
  await root
    .getByRole('dialog', { name: 'بدء الجولة التعليمية' })
    .getByRole('button', { name: 'متابعة الجولة' })
    .click();
}
async function waitFocus(page, selector) {
  await page.waitForFunction(sel => document.activeElement?.matches(sel), selector);
}
async function visited(page, count) {
  await page.waitForFunction(n => {
    try {
      return JSON.parse(localStorage.getItem('nexora-ui-guide') || '{}').visited?.length === n;
    } catch {
      return false;
    }
  }, count);
}
async function watch(page, context, origin = 'file:') {
  const errors = [],
    external = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await context.route(/^https?:\/\//, route => {
    if (origin !== 'file:' && route.request().url().startsWith(origin)) return route.continue();
    external.push(route.request().url());
    return route.abort();
  });
  return { errors, external };
}
async function inspectPlacement(root, where) {
  const info = await layer(root).evaluate(el => {
    const d = el.querySelector('.tour-dialog'),
      spot = el.querySelector('.tour-spotlight'),
      action = el.querySelector('.tour-actions'),
      a = d?.getBoundingClientRect(),
      b = spot?.getBoundingClientRect(),
      c = action?.getBoundingClientRect();
    const overlap =
      a && b
        ? Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) *
          Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top))
        : null;
    return {
      found: el.dataset.targetFound,
      step: el.dataset.guideStep,
      screen: [innerWidth, innerHeight],
      box: a && [a.left, a.top, a.right, a.bottom],
      spot: b && [b.left, b.top, b.right, b.bottom],
      action: c && [c.top, c.bottom],
      overlap,
      client: d?.clientWidth,
      scroll: d?.scrollWidth,
    };
  });
  assert.equal(info.found, 'true', `${where}: target found ${JSON.stringify(info)}`);
  assert.ok(
    info.box && info.spot,
    `${where}: spotlight and dialog visible ${JSON.stringify(info)}`,
  );
  assert.ok(
    info.box[0] >= -1 &&
      info.box[1] >= -1 &&
      info.box[2] <= info.screen[0] + 1 &&
      info.box[3] <= info.screen[1] + 1,
    `${where}: dialog in viewport ${JSON.stringify(info)}`,
  );
  assert.ok(
    info.scroll <= info.client + 1,
    `${where}: no dialog horizontal overflow ${JSON.stringify(info)}`,
  );
  assert.ok(
    info.overlap < 250,
    `${where}: spotlight not covered by the dialog ${JSON.stringify(info)}`,
  );
  assert.ok(
    info.action[0] >= info.box[1] && info.action[1] <= info.box[3] + 1,
    `${where}: navigation remains visible ${JSON.stringify(info)}`,
  );
}

// All unique steps, including the integrated modules, on desktop and narrow mobile.
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
    for (const [width, height, theme] of [
      [1440, 900, 'dark'],
      [320, 600, 'light'],
    ]) {
      const context = await browser.newContext({
          viewport: { width, height },
          reducedMotion: 'reduce',
        }),
        page = await context.newPage(),
        logs = await watch(page, context);
      try {
        await page.goto(builtUrl);
        await login(page);
        if (theme === 'light')
          await page.getByRole('button', { name: 'تفعيل المظهر الفاتح' }).click();
        await nav(page, 'سجل التدقيق');
        const auditBefore = await page.locator('.data-panel table tbody').innerText();
        await nav(page, 'التنبيهات');
        const alertsBefore = await page.locator('.data-panel table tbody').innerText();
        await nav(page, 'الأصول');
        const assetsBefore = await page.locator('.data-panel table tbody').innerText();
        await nav(page, 'نظرة عامة');
        const unreadBefore = await page.locator('#notification-unread-count').innerText();
        assert.equal(await progress(page).getAttribute('aria-valuenow'), '0');
        await start(page);
        for (let i = 0; i < guideSteps.length; i++) {
          const item = guideSteps[i],
            where = `${name}/${width}/${item.id}`;
          await step(page, item.id).waitFor({ timeout: 12000 });
          assert.equal(await dialog(page).getAttribute('aria-modal'), 'true', where);
          assert.equal(await dialog(page).locator('h2').innerText(), item.title, where);
          assert.equal(
            await dialog(page)
              .getByRole('progressbar', { name: 'موضعك في الجولة' })
              .getAttribute('aria-valuenow'),
            String(i + 1),
            where,
          );
          assert.equal(await page.locator('.sidebar').getAttribute('inert'), '', where);
          assert.equal(
            await page.locator('.main-shell').getAttribute('aria-hidden'),
            'true',
            where,
          );
          assert.equal(
            await page.locator('.sidebar-nav .nav-item.active').getAttribute('aria-current'),
            'page',
            where,
          );
          assert.equal(
            await page.evaluate(() =>
              document.querySelector('.tour-dialog')?.contains(document.activeElement),
            ),
            true,
            `${where}: focus stays in guide`,
          );
          if (item.detail)
            assert.equal(
              await page.locator('.detail-layer-active').getAttribute('inert'),
              '',
              `${where}: sample detail is inert`,
            );
          await inspectPlacement(page, where);
          if (item.id === 'notifications') {
            // The highlighted underlying control cannot be activated by the tour.
            const box = await page.locator('.tour-spotlight').boundingBox();
            await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
            assert.equal(
              await page.locator('.notification-popover').count(),
              0,
              `${where}: backdrop blocks actions`,
            );
            assert.equal(
              await page.locator('#notification-unread-count').innerText(),
              unreadBefore,
              `${where}: no notification marked read`,
            );
          }
          if (i < guideSteps.length - 1) await next(page);
        }
        await dialog(page).getByRole('button', { name: 'إنهاء الجولة' }).click();
        await layer(page).waitFor({ state: 'detached' });
        await visited(page, guideSteps.length);
        await nav(page, 'نظرة عامة');
        assert.equal(await progress(page).getAttribute('aria-valuenow'), String(guideSteps.length));
        assert.equal(await page.getByRole('button', { name: 'إعادة الجولة' }).count(), 1);
        assert.equal(await page.locator('.sidebar').getAttribute('inert'), null);
        assert.equal(await page.locator('.main-shell').getAttribute('aria-hidden'), null);
        assert.equal(await page.locator('#notification-unread-count').innerText(), unreadBefore);
        await nav(page, 'سجل التدقيق');
        assert.equal(
          await page.locator('.data-panel table tbody').innerText(),
          auditBefore,
          `${name}/${width}: tour does not create audit events`,
        );
        await nav(page, 'التنبيهات');
        assert.equal(
          await page.locator('.data-panel table tbody').innerText(),
          alertsBefore,
          `${name}/${width}: alerts unchanged`,
        );
        await nav(page, 'الأصول');
        assert.equal(
          await page.locator('.data-panel table tbody').innerText(),
          assetsBefore,
          `${name}/${width}: assets unchanged`,
        );
        await noOverflow(page, `${name}/${width}/guide`);
        assert.deepEqual(logs.errors, [], `${name}/${width} page errors`);
        assert.deepEqual(logs.external, [], `${name}/${width} external requests`);
        console.log(
          `PASS ${name} · ${theme} ${width}px · ${guideSteps.length} targets, read-only navigation and completion`,
        );
      } finally {
        await context.close();
      }
    }
    // The in-app preview uses an opaque-origin iframe with scripts but no forms.
    const context = await browser.newContext({
        viewport: { width: 390, height: 844 },
        reducedMotion: 'no-preference',
      }),
      page = await context.newPage(),
      logs = await watch(page, context);
    try {
      await page.setContent(
        '<iframe title="isolated demo" sandbox="allow-scripts" style="width:100%;height:820px;border:0"></iframe>',
      );
      await page.locator('iframe').evaluate((el, src) => {
        el.srcdoc = src;
      }, html);
      const frame = page.frameLocator('iframe');
      await login(frame);
      await start(frame);
      // Measure after the actual step change, not while Playwright is waiting to click.
      await page.waitForTimeout(350);
      const startX = await frame
        .locator('.tour-spotlight')
        .evaluate(el => el.getBoundingClientRect().left);
      await frame.locator('html').evaluate(() => {
        window.__guideFrameSamples = [];
        const layer = document.querySelector('.tour-layer');
        const observer = new MutationObserver(() => {
          if (layer.dataset.guideStep !== 'navigation') return;
          observer.disconnect();
          const start = performance.now();
          function sample(t) {
            const el = document.querySelector('.tour-spotlight');
            if (el) window.__guideFrameSamples.push(el.getBoundingClientRect().left);
            if (t - start < 480) requestAnimationFrame(sample);
          }
          requestAnimationFrame(sample);
        });
        observer.observe(layer, { attributes: true, attributeFilter: ['data-guide-step'] });
      });
      await next(frame);
      await step(frame, 'navigation').waitFor();
      await page.waitForTimeout(530);
      const motion = await frame.locator('html').evaluate(() => ({
        samples: window.__guideFrameSamples,
        end: document.querySelector('.tour-spotlight')?.getBoundingClientRect().left,
      }));
      assert.ok(
        Math.abs(motion.end - startX) > 60 &&
          motion.samples.some(x => Math.abs(x - startX) > 8 && Math.abs(motion.end - x) > 8),
        `${name} sandbox: spotlight visibly moves ${JSON.stringify({ startX, ...motion })}`,
      );
      await chapter(frame, 'التحقيق والاستجابة');
      await step(frame, 'alerts-filter').waitFor();
      await next(frame);
      await step(frame, 'table-views').waitFor();
      await next(frame);
      await step(frame, 'alerts-group').waitFor();
      await next(frame);
      await step(frame, 'alert-risk').waitFor();
      assert.equal(await frame.locator('.detail-layer-active').getAttribute('inert'), '');
      await dialog(frame).getByRole('button', { name: 'استكشف القسم' }).click();
      await layer(frame).waitFor({ state: 'detached' });
      await drawer(frame).waitFor();
      assert.match(await drawer(frame).innerText(), /لماذا هذه الدرجة/);
      await drawer(frame).getByRole('button', { name: 'إغلاق' }).click();
      await sidebar(frame);
      await introContinue(frame);
      await step(frame, 'alert-risk').waitFor();
      await dialog(frame).getByRole('button', { name: 'تخطي الجولة' }).click();
      assert.equal(await layer(frame).count(), 0);
      assert.deepEqual(logs.errors, [], `${name} sandbox errors`);
      assert.deepEqual(logs.external, [], `${name} sandbox external requests`);
      console.log(
        `PASS ${name} · opaque offline iframe · visible motion, chapters, details, pause and resume`,
      );
    } finally {
      await context.close();
    }
  } finally {
    await browser.close();
  }
}

const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
try {
  // Progress is unique visits, with backward navigation, chapters, resume,
  // explicit skip, reload persistence, completion and restart.
  const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      reducedMotion: 'reduce',
    }),
    page = await context.newPage(),
    logs = await watch(page, context);
  try {
    await page.goto(builtUrl);
    await login(page);
    await start(page);
    await next(page);
    await next(page);
    assert.equal(await progress(page).getAttribute('aria-valuenow'), '3');
    await dialog(page).getByRole('button', { name: 'السابق' }).click();
    assert.equal(await layer(page).getAttribute('data-guide-step'), 'navigation');
    assert.equal(await progress(page).getAttribute('aria-valuenow'), '3');
    await page.keyboard.press('Escape');
    await layer(page).waitFor({ state: 'detached' });
    await waitFocus(page, '.start-guide .btn');
    assert.equal(await page.getByRole('button', { name: 'استئناف الجولة' }).count(), 1);
    await sidebar(page);
    await introContinue(page);
    await step(page, 'navigation').waitFor();
    await chapter(page, 'الأصول والارتباطات');
    await step(page, 'assets').waitFor();
    await visited(page, 4);
    await dialog(page).getByRole('button', { name: 'السابق' }).click();
    await step(page, 'events').waitFor();
    await visited(page, 5);
    await next(page);
    await step(page, 'assets').waitFor();
    await visited(page, 5);
    await chapter(page, 'التحقيق والاستجابة');
    await step(page, 'alerts-filter').waitFor();
    await next(page);
    await step(page, 'table-views').waitFor();
    await next(page);
    await step(page, 'alerts-group').waitFor();
    await next(page);
    await step(page, 'alert-risk').waitFor();
    await dialog(page).getByRole('button', { name: 'استكشف القسم' }).click();
    await layer(page).waitFor({ state: 'detached' });
    await drawer(page).waitFor();
    await waitFocus(page, '.drawer [data-dialog-autofocus]');
    await drawer(page).getByRole('button', { name: 'إغلاق' }).click();
    await sidebar(page);
    await introContinue(page);
    await step(page, 'alert-risk').waitFor();
    await dialog(page).getByRole('button', { name: 'تخطي الجولة' }).click();
    await drawer(page).getByRole('button', { name: 'إغلاق' }).click();
    await nav(page, 'نظرة عامة');
    assert.equal(await page.locator('.start-guide').count(), 0);
    await page.reload();
    await login(page);
    assert.equal(await page.locator('.start-guide').count(), 0);
    await page.getByRole('button', { name: 'دليل البدء' }).click();
    await step(page, 'alert-risk').waitFor();
    await dialog(page).getByRole('button', { name: 'استكشف القسم' }).click();
    await drawer(page).getByRole('button', { name: 'إغلاق' }).click();
    await nav(page, 'نظرة عامة');
    assert.ok(Number(await progress(page).getAttribute('aria-valuenow')) > 5);
    await page.getByRole('button', { name: 'ابدأ من جديد' }).click();
    await step(page, 'welcome').waitFor();
    assert.equal(await progress(page).getAttribute('aria-valuenow'), '1');
    await chapter(page, 'الإدارة والتخصيص');
    await step(page, 'reports').waitFor();
    const managementCount =
      guideSteps.findIndex(x => x.id === 'finish') -
      guideSteps.findIndex(x => x.id === 'reports') +
      1;
    for (let i = 1; i < managementCount; i++) await next(page);
    await step(page, 'finish').waitFor();
    const uniqueVisits = 1 + managementCount;
    await visited(page, uniqueVisits); // plus the restarted welcome step
    await dialog(page).getByRole('button', { name: 'إنهاء الجولة' }).click();
    await layer(page).waitFor({ state: 'detached' });
    await nav(page, 'نظرة عامة');
    assert.equal(
      await progress(page).getAttribute('aria-valuenow'),
      String(uniqueVisits),
      'chapter jumps count only visited steps',
    );
    await page.getByRole('button', { name: 'إعادة الجولة' }).click();
    await step(page, 'welcome').waitFor();
    assert.equal(await progress(page).getAttribute('aria-valuenow'), '1');
    assert.deepEqual(logs.errors, []);
    assert.deepEqual(logs.external, []);
    console.log(
      'PASS unique visited progress, chapters, back, pause/resume, skip, reload and restart',
    );
  } finally {
    await context.close();
  }

  // Settings guard and the preflight keep user-entered changes safe.
  for (const width of [1440, 320]) {
    const context = await browser.newContext({
        viewport: { width, height: 700 },
        reducedMotion: 'reduce',
      }),
      page = await context.newPage(),
      logs = await watch(page, context);
    try {
      await page.goto(builtUrl);
      await login(page);
      await nav(page, 'الإعدادات');
      const org = page.getByLabel('اسم المؤسسة');
      await org.fill('تعديلات مهمة');
      await sidebar(page);
      let confirm = page.getByRole('dialog', { name: 'إعدادات غير محفوظة' });
      await confirm.waitFor();
      await confirm.getByRole('button', { name: 'متابعة التعديل' }).click();
      assert.equal(await org.inputValue(), 'تعديلات مهمة');
      assert.equal(await layer(page).count(), 0);
      if (width === 320) await waitFocus(page, '.mobile-menu');
      await sidebar(page);
      confirm = page.getByRole('dialog', { name: 'إعدادات غير محفوظة' });
      await confirm.getByRole('button', { name: 'تجاهل التغييرات والمتابعة' }).click();
      await step(page, 'welcome').waitFor();
      await page.keyboard.press('Escape');
      await layer(page).waitFor({ state: 'detached' });
      await nav(page, 'التنبيهات');
      const filter = page.getByPlaceholder('بحث بالمعرّف أو الأصل أو عنوان IP');
      await filter.fill('ALT-1284');
      await sidebar(page);
      const intro = page.getByRole('dialog', { name: 'بدء الجولة التعليمية' });
      await intro.waitFor();
      assert.match(await intro.innerText(), /قد تُصفّر مرشحات/);
      await intro.getByRole('button', { name: 'إلغاء' }).click();
      assert.equal(await filter.inputValue(), 'ALT-1284');
      if (width === 320) await waitFocus(page, '.mobile-menu');
      await sidebar(page);
      await introContinue(page);
      await step(page, 'welcome').waitFor();
      assert.deepEqual(logs.errors, []);
      assert.deepEqual(logs.external, []);
      console.log(`PASS ${width}px · dirty settings confirmation, cancel and filter preflight`);
    } finally {
      await context.close();
    }
  }

  // Keyboard trap, browser shortcuts, missing-target fallback, short screens,
  // orientation changes, and focused automated checks (not a WCAG audit).
  for (const [width, height, theme] of [
    [1440, 900, 'dark'],
    [320, 480, 'light'],
  ]) {
    const context = await browser.newContext({
        viewport: { width, height },
        reducedMotion: 'reduce',
      }),
      page = await context.newPage(),
      logs = await watch(page, context);
    try {
      await page.goto(builtUrl);
      await login(page);
      if (theme === 'light')
        await page.getByRole('button', { name: 'تفعيل المظهر الفاتح' }).click();
      await start(page);
      const report = await new AxeBuilder({ page }).include('.tour-dialog').analyze();
      assert.deepEqual(
        report.violations,
        [],
        `${width}/${theme}: confirmed axe violations in tour`,
      );
      assert.equal(
        await page
          .locator('.tour-spotlight > i')
          .evaluate(el => getComputedStyle(el).animationName),
        'none',
      );
      const transitions = await page
        .locator('.tour-spotlight')
        .evaluate(el => getComputedStyle(el).transitionDuration);
      assert.ok(transitions.split(',').every(v => parseFloat(v) < 0.01));
      for (let i = 0; i < 12; i++) {
        await page.keyboard.press(i % 3 === 0 ? 'Shift+Tab' : 'Tab');
        assert.equal(
          await page.evaluate(() =>
            document.querySelector('.tour-dialog').contains(document.activeElement),
          ),
          true,
          'focus trap',
        );
      }
      const ctrlPrevented = await page.evaluate(() => {
        const e = new KeyboardEvent('keydown', {
          key: 'k',
          code: 'KeyK',
          ctrlKey: true,
          bubbles: true,
          cancelable: true,
        });
        document.activeElement.dispatchEvent(e);
        return e.defaultPrevented;
      });
      assert.equal(ctrlPrevented, false, 'Ctrl+K not intercepted');
      await page.keyboard.press('Alt+k');
      assert.equal(
        await page.getByRole('dialog', { name: 'البحث في المنصة' }).count(),
        0,
        'app shortcut does not escape tour',
      );
      if (width === 320) {
        assert.equal(
          await page.locator('.tour-scroll-hint').isVisible(),
          true,
          'short viewport indicates scrollable explanation',
        );
        await inspectPlacement(page, 'short viewport');
        await next(page);
        await step(page, 'navigation').waitFor();
        await page.setViewportSize({ width: 900, height: 700 });
        await page.waitForFunction(() => {
          const a = document.querySelector('.tour-spotlight')?.getBoundingClientRect(),
            b = document.querySelector('.sidebar-nav .nav-item.active')?.getBoundingClientRect();
          return a && b && Math.abs(a.left - (b.left - 6)) < 3;
        });
        await page.setViewportSize({ width: 320, height: 480 });
        await page.waitForFunction(() => {
          const a = document.querySelector('.tour-spotlight')?.getBoundingClientRect(),
            b = document.querySelector('.mobile-menu')?.getBoundingClientRect();
          return a && b && Math.abs(a.left - (b.left - 6)) < 3;
        });
        await inspectPlacement(page, 'mobile after resize');
      }
      await chapter(page, 'التحقيق والاستجابة');
      await next(page);
      await step(page, 'table-views').waitFor();
      await next(page);
      await step(page, 'alerts-group').waitFor();
      await next(page);
      await step(page, 'alert-risk').waitFor();
      await page.locator('.risk-explanation .detail-section-title').evaluate(el => {
        el.style.display = 'none';
      });
      await page.setViewportSize({ width: width + 1, height });
      await page.waitForFunction(
        () =>
          document.querySelector('.tour-layer')?.dataset.targetFound === 'false' &&
          !!document.querySelector('.tour-missing'),
      );
      assert.match(await dialog(page).innerText(), /العنصر المحدد غير متاح/);
      await page.locator('.risk-explanation .detail-section-title').evaluate(el => {
        el.style.display = '';
      });
      await page.setViewportSize({ width, height });
      await step(page, 'alert-risk').waitFor();
      await page.keyboard.press('Escape');
      await layer(page).waitFor({ state: 'detached' });
      await waitFocus(page, '.drawer [data-dialog-autofocus]');
      assert.deepEqual(logs.errors, []);
      assert.deepEqual(logs.external, []);
      console.log(
        `PASS ${width}/${theme} · keyboard, reduced motion, axe, resize and missing target fallback`,
      );
    } finally {
      await context.close();
    }
  }

  // Motion is genuinely observable between targets, not a static border.
  {
    const context = await browser.newContext({
        viewport: { width: 1440, height: 900 },
        reducedMotion: 'no-preference',
      }),
      page = await context.newPage(),
      logs = await watch(page, context);
    try {
      await page.goto(builtUrl);
      await login(page);
      await start(page);
      await page.waitForTimeout(350);
      const startX = await page
        .locator('.tour-spotlight')
        .evaluate(el => el.getBoundingClientRect().left);
      await page.evaluate(() => {
        window.__guideSamples = [];
        const start = performance.now();
        function sample(t) {
          const el = document.querySelector('.tour-spotlight');
          if (el) window.__guideSamples.push(el.getBoundingClientRect().left);
          if (t - start < 500) requestAnimationFrame(sample);
        }
        requestAnimationFrame(sample);
      });
      await next(page);
      await step(page, 'navigation').waitFor();
      await page.waitForTimeout(550);
      const samples = await page.evaluate(() => window.__guideSamples),
        end = await page.locator('.tour-spotlight').evaluate(el => el.getBoundingClientRect().left);
      const between = samples.some(x => Math.abs(x - startX) > 20 && Math.abs(end - x) > 20);
      assert.ok(
        Math.abs(end - startX) > 100 && between,
        `spotlight should visibly travel: ${JSON.stringify({ startX, end, samples })}`,
      );
      assert.deepEqual(logs.errors, []);
      assert.deepEqual(logs.external, []);
      console.log('PASS animated spotlight changes position over time when motion is allowed');
    } finally {
      await context.close();
    }
  }
} finally {
  await browser.close();
}
console.log(
  `PASS interactive guide · ${guideChapters.length} chapters · ${guideSteps.length} steps · no backend or WCAG certification claimed.`,
);
