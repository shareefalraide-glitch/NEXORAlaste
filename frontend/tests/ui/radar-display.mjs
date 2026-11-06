// Decorative radar: verify actual rotation, pulsing dots, appearance, layout,
// offline embedding, and fallback cleanup. Not live telemetry or an accessibility audit.
import fs from 'node:fs';
import { chromium, firefox, webkit } from 'playwright';
import { assert, builtUrl, login, noOverflow } from '../support/helpers.mjs';

const html = fs.readFileSync('dist/index.html', 'utf8');
const engines = [
  ['Chromium', chromium],
  ['Firefox', firefox],
  ['WebKit', webkit],
];
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
async function sample(locator, duration = 900) {
  return locator.evaluate(async (root, duration) => {
    const sweep = root.querySelector('.radar-sweep'),
      pulses = [...root.querySelectorAll('.radar-signal-pulse')];
    const read = () => {
      const matrix = new DOMMatrixReadOnly(getComputedStyle(sweep).transform);
      return {
        angle: (Math.atan2(matrix.b, matrix.a) * 180) / Math.PI,
        pulses: pulses.map(el => {
          const s = getComputedStyle(el),
            m =
              s.transform === 'none' ? new DOMMatrixReadOnly() : new DOMMatrixReadOnly(s.transform);
          return { scale: m.a, opacity: Number(s.opacity) };
        }),
      };
    };
    const values = [read()],
      start = performance.now();
    await new Promise(resolve => {
      const id = setInterval(() => {
        values.push(read());
        if (performance.now() - start >= duration) {
          clearInterval(id);
          resolve();
        }
      }, 55);
    });
    const span = arr => Math.max(...arr) - Math.min(...arr);
    const rotation = values
      .slice(1)
      .reduce((sum, value, i) => sum + (((value.angle - values[i].angle + 540) % 360) - 180), 0);
    return {
      motion: root.dataset.motion,
      engine: root.dataset.engine,
      rotation,
      unique: new Set(values.map(v => v.angle.toFixed(1))).size,
      pulses: pulses.map((_, i) => ({
        scale: span(values.map(v => v.pulses[i].scale)),
        opacity: span(values.map(v => v.pulses[i].opacity)),
      })),
    };
  }, duration);
}
async function assertMoves(
  locator,
  where,
  { engine, minChanges = 5, duration = 900, pixels = true } = {},
) {
  const image = pixels ? await locator.screenshot({ animations: 'allow' }) : null;
  const result = await sample(locator, duration);
  assert.equal(result.motion, 'animated', `${where}: sweep starts automatically`);
  if (engine)
    assert.equal(
      result.engine,
      engine,
      `${where}: expected animation path ${JSON.stringify(result)}`,
    );
  assert.ok(
    result.rotation > 30,
    `${where}: radar visibly rotates clockwise ${JSON.stringify(result)}`,
  );
  assert.ok(
    result.unique >= minChanges,
    `${where}: radar changes over time ${JSON.stringify(result)}`,
  );
  assert.ok(
    result.pulses.some(x => x.scale > 0.12 && x.opacity > 0.06),
    `${where}: signal rings visibly pulse ${JSON.stringify(result)}`,
  );
  if (image)
    assert.ok(
      !image.equals(await locator.screenshot({ animations: 'allow' })),
      `${where}: rendered pixels change`,
    );
}
async function previewSimulation(context, mode) {
  await context.addInitScript(mode => {
    const scheduled = new Set(),
      later = window.setTimeout.bind(window),
      clear = window.clearTimeout.bind(window);
    window.setTimeout = (cb, delay, ...args) => {
      const track =
        Boolean(document.querySelector('[data-testid="overview-radar"]')) &&
        (delay === 33 || delay === 500);
      const actual = mode === 'clamped' && delay === 33 ? 1000 : delay;
      let id;
      id = later(
        (...a) => {
          scheduled.delete(id);
          cb(...a);
        },
        actual,
        ...args,
      );
      if (track) scheduled.add(id);
      return id;
    };
    window.clearTimeout = id => {
      scheduled.delete(id);
      clear(id);
    };
    window.__radarTimers = () => scheduled.size;
    window.requestAnimationFrame = () => 2147480000;
    window.cancelAnimationFrame = () => {};
    if (mode === 'unavailable' || mode === 'clamped') Element.prototype.animate = undefined;
    if (mode === 'frozen') {
      const native = Element.prototype.animate;
      Element.prototype.animate = function (...args) {
        const a = native.apply(this, args);
        if (this.matches('.radar-sweep')) {
          a.pause();
          a.play = () => {};
        }
        return a;
      };
    }
  }, mode);
}
function contrast(hex1, hex2) {
  const lum = h => {
    const rgb = [1, 3, 5]
      .map(i => parseInt(h.slice(i, i + 2), 16) / 255)
      .map(x => (x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4));
    return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
  };
  const a = lum(hex1),
    b = lum(hex2);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}
for (const [name, engine] of engines) {
  const browser = await engine.launch({
    headless: true,
    ...(name === 'Chromium' ? { args: ['--no-sandbox'] } : {}),
  });
  try {
    for (const theme of ['dark', 'light'])
      for (const motion of ['no-preference', 'reduce']) {
        const context = await browser.newContext({
            viewport: { width: 1440, height: 900 },
            reducedMotion: motion,
          }),
          errors = [],
          network = [];
        try {
          const page = await context.newPage();
          page.on('pageerror', e => errors.push(e.message));
          await context.route(/^https?:\/\//, r => {
            network.push(r.request().url());
            return r.abort();
          });
          await page.goto(builtUrl);
          await login(page);
          if (theme === 'light')
            await page.getByRole('button', { name: 'تفعيل المظهر الفاتح' }).click();
          const radar = page.getByTestId('overview-radar');
          await radar.waitFor();
          await radar.scrollIntoViewIfNeeded();
          await page.waitForTimeout(180);
          assert.equal(await radar.getAttribute('role'), 'img');
          assert.match(await radar.getAttribute('aria-label'), /توضيحي.*شكلية وليست رصدًا حيًا/);
          assert.equal(await radar.locator('.radar-scope').getAttribute('aria-hidden'), 'true');
          assert.equal(await radar.locator('.radar-signal').count(), 3);
          assert.equal(await radar.locator('.radar-signal-pulse').count(), 3);
          assert.equal(await radar.locator('button').count(), 0);
          assert.equal(await page.locator('.radar-caption').count(), 0);
          assert.equal(
            await radar
              .locator(
                '.radar-screen-header,.radar-readout,.radar-readout-label,.radar-screen-footer',
              )
              .count(),
            0,
            'no rectangular dashboard, readout or footer',
          );
          const minimal = await radar.evaluate(el => {
            const scope = el.querySelector('.radar-scope'),
              root = el.getBoundingClientRect(),
              circle = scope.getBoundingClientRect(),
              style = getComputedStyle(el);
            return {
              children: el.children.length,
              background: style.backgroundColor,
              border: style.borderTopWidth,
              text: el.textContent.trim().replace(/\s+/g, ''),
              root: [root.width, root.height],
              circle: [circle.width, circle.height],
            };
          });
          assert.equal(minimal.children, 1, 'only the circle remains');
          assert.equal(minimal.background, 'rgba(0, 0, 0, 0)', 'transparent root');
          assert.equal(minimal.border, '0px', 'no rectangular frame');
          assert.equal(minimal.text, 'NS', 'only compass markings within the circle');
          assert.ok(
            Math.abs(minimal.root[0] - minimal.root[1]) < 0.5 &&
              Math.abs(minimal.root[0] - minimal.circle[0]) < 0.5 &&
              Math.abs(minimal.root[1] - minimal.circle[1]) < 0.5,
            `square root fits circle: ${JSON.stringify(minimal)}`,
          );
          assert.equal(await page.getByRole('button', { name: 'استكشف رحلة التحقيق' }).count(), 1);
          await assertMoves(radar, `${name}/${theme}/${motion}`, { engine: 'native' });
          const colors = await radar.evaluate(el => {
            const s = getComputedStyle(el);
            return ['--rd-cyan', '--rd-blue', '--rd-amber', '--rd-surface-inner'].map(x =>
              s.getPropertyValue(x).trim(),
            );
          });
          for (const color of colors.slice(0, 3))
            assert.ok(
              contrast(color, colors[3]) >= 3,
              `${name}/${theme}: signal contrast ${color} on ${colors[3]}`,
            );
          await noOverflow(page, `${name}/${theme} radar`);
          assert.deepEqual(errors, []);
          assert.deepEqual(network, []);
          if (name === 'Chromium' && theme === 'dark' && motion === 'reduce') {
            await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
            await page.waitForFunction(
              () =>
                document.querySelector('[data-testid="overview-radar"]')?.dataset.motion ===
                'offscreen',
            );
            const first = await radar
              .locator('.radar-sweep')
              .evaluate(el => getComputedStyle(el).transform);
            await page.waitForTimeout(450);
            assert.equal(
              await radar.locator('.radar-sweep').evaluate(el => getComputedStyle(el).transform),
              first,
              'offscreen animation pauses',
            );
            await page.evaluate(() => window.scrollTo(0, 0));
            await page.waitForFunction(
              () =>
                document.querySelector('[data-testid="overview-radar"]')?.dataset.motion ===
                'animated',
            );
            await assertMoves(radar, 'after returning to banner', {
              engine: 'native',
              pixels: false,
            });
          }
          console.log(
            `PASS ${name} ${theme}/${motion} · rotating radar, pulsing signals and readable colors`,
          );
        } finally {
          await context.close();
        }
      }
    const embedded = await browser.newContext({
        viewport: { width: 1280, height: 900 },
        reducedMotion: 'reduce',
      }),
      errors = [],
      external = [];
    try {
      await previewSimulation(embedded, 'native');
      const page = await embedded.newPage();
      page.on('pageerror', e => errors.push(e.message));
      await embedded.route(/^https?:\/\//, r => {
        external.push(r.request().url());
        return r.abort();
      });
      await page.setContent(
        '<iframe title="offline preview" sandbox="allow-scripts" style="width:100%;height:850px;border:0"></iframe>',
      );
      await page.locator('iframe').evaluate((el, src) => {
        el.srcdoc = src;
      }, html);
      const frame = page.frameLocator('iframe');
      await forceLogin(frame);
      const radar = frame.getByTestId('overview-radar');
      await radar.waitFor();
      await assertMoves(radar, `${name} offline sandbox`, { engine: 'native' });
      const animation = await radar
        .locator('.radar-sweep')
        .evaluateHandle(el => el.getAnimations()[0]);
      await frame
        .locator('#primary-navigation')
        .getByText('التنبيهات', { exact: true })
        .click({ force: true });
      const frameObject = await (await page.locator('iframe').elementHandle()).contentFrame();
      await frameObject.waitForFunction(() => window.__radarTimers() === 0, null, {
        timeout: 8000,
        polling: 100,
      });
      assert.equal(await animation.evaluate(a => a.playState), 'idle');
      assert.deepEqual(errors, []);
      assert.deepEqual(external, []);
      console.log(`PASS ${name} · sandbox without RAF and cleanup`);
    } finally {
      await embedded.close();
    }
    for (const mode of ['unavailable', 'frozen', 'clamped']) {
      const context = await browser.newContext({
          viewport: { width: 1280, height: 900 },
          reducedMotion: 'reduce',
        }),
        errors = [];
      try {
        await previewSimulation(context, mode);
        const page = await context.newPage();
        page.on('pageerror', e => errors.push(e.message));
        await page.goto(builtUrl);
        await forceLogin(page);
        const radar = page.getByTestId('overview-radar');
        await radar.waitFor();
        await page.waitForFunction(
          () =>
            document.querySelector('[data-testid="overview-radar"]')?.dataset.engine === 'manual',
          null,
          { timeout: 8000, polling: 100 },
        );
        await assertMoves(radar, `${name}/${mode} fallback`, {
          engine: 'manual',
          ...(mode === 'clamped' ? { duration: 2250, minChanges: 3 } : {}),
        });
        const handle = await radar.elementHandle();
        await page
          .locator('#primary-navigation')
          .getByText('التنبيهات', { exact: true })
          .click({ force: true });
        await page.waitForFunction(() => window.__radarTimers() === 0, null, {
          timeout: 8000,
          polling: 100,
        });
        const value = await handle.evaluate(el => el.querySelector('.radar-sweep').style.transform);
        await page.waitForTimeout(150);
        assert.equal(
          await handle.evaluate(el => el.querySelector('.radar-sweep').style.transform),
          value,
        );
        assert.deepEqual(errors, []);
        console.log(`PASS ${name} · ${mode} timed fallback and cleanup`);
      } finally {
        await context.close();
      }
    }
  } finally {
    await browser.close();
  }
}
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
try {
  for (const width of [
    320, 360, 390, 420, 480, 600, 601, 700, 760, 761, 780, 850, 880, 881, 900, 1000, 1100, 1440,
  ]) {
    const context = await browser.newContext({
      viewport: { width, height: 900 },
      reducedMotion: 'reduce',
    });
    try {
      const page = await context.newPage();
      await page.goto(builtUrl);
      await login(page);
      await page.evaluate(() => document.fonts.ready);
      await noOverflow(page, `${width}px radar display`);
      const layout = await page.evaluate(() => {
        const a = document.querySelector('.overview-hero').getBoundingClientRect(),
          b = document.querySelector('.hero-copy').getBoundingClientRect(),
          c = document.querySelector('.radar-display').getBoundingClientRect(),
          d = document.querySelector('.radar-scope').getBoundingClientRect();
        const overlap =
          Math.max(0, Math.min(b.right, c.right) - Math.max(b.left, c.left)) *
          Math.max(0, Math.min(b.bottom, c.bottom) - Math.max(b.top, c.top));
        return {
          hero: [a.left, a.top, a.right, a.bottom],
          art: [c.left, c.top, c.right, c.bottom],
          root: [c.width, c.height],
          circle: [d.width, d.height],
          overlap,
        };
      });
      assert.ok(
        layout.art[0] >= layout.hero[0] - 1 &&
          layout.art[2] <= layout.hero[2] + 1 &&
          layout.art[1] >= layout.hero[1] - 1 &&
          layout.art[3] <= layout.hero[3] + 1,
        `${width}px radar within banner ${JSON.stringify(layout)}`,
      );
      assert.ok(
        layout.overlap < 1,
        `${width}px radar does not cover copy ${JSON.stringify(layout)}`,
      );
      assert.ok(
        Math.abs(layout.root[0] - layout.root[1]) < 0.5 &&
          Math.abs(layout.root[0] - layout.circle[0]) < 0.5 &&
          Math.abs(layout.root[1] - layout.circle[1]) < 0.5,
        `${width}px circle fills root ${JSON.stringify(layout)}`,
      );
    } finally {
      await context.close();
    }
  }
} finally {
  await browser.close();
}
console.log(
  'PASS standalone radar circle across themes, engines, sandbox and responsive sizes; no live monitoring.',
);
