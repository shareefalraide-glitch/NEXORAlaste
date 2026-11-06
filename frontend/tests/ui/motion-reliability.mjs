// Regression: actual pixels and sphere geometry must keep moving when frames
// are slow or missing, including within the sandboxed preview. Not a test of
// every browser, OS power-saving policy or a substitute for human observation.
import fs from 'node:fs';
import http from 'node:http';
import { chromium, firefox, webkit } from 'playwright';
import { assert, builtUrl } from '../support/helpers.mjs';

const html = fs.readFileSync('dist/index.html');
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

// Instrument just the synthetic environment. A real browser can still suspend
// both frames and timers (e.g. an inactive tab), which application JS cannot fix.
async function simulateFrames(context, mode) {
  await context.addInitScript(mode => {
    const later = window.setTimeout.bind(window),
      cancel = window.clearTimeout.bind(window),
      watchdogs = new Set();
    window.setTimeout = (callback, delay, ...args) => {
      // Attribute the watchdog to the login globe only; the dashboard compass
      // has its own timer after login and must keep running independently.
      const globeMounted = Boolean(document.querySelector('[data-testid="neural-mesh"]'));
      let id;
      id = later(
        (...values) => {
          watchdogs.delete(id);
          callback(...values);
        },
        delay,
        ...args,
      );
      if (globeMounted && (delay === 400 || delay === 1200)) watchdogs.add(id);
      return id;
    };
    window.clearTimeout = id => {
      watchdogs.delete(id);
      cancel(id);
    };
    if (mode === 'slow') {
      window.requestAnimationFrame = callback =>
        window.setTimeout(() => callback(performance.now()), 1000);
      window.cancelAnimationFrame = id => window.clearTimeout(id);
    } else {
      window.requestAnimationFrame = () => 2147480000; // A pending frame never calls back.
      window.cancelAnimationFrame = () => {};
    }
    window.__testWatchdogs = () => watchdogs.size;
  }, mode);
}
async function completeDemoLogin(root) {
  for (const text of [
    'استخدام بيانات تجريبية',
    'المتابعة إلى التحقق',
    'ملء الرمز',
    'التحقق والدخول',
  ])
    await root.getByText(text, { exact: true }).click({ force: true });
  await root.locator('#primary-navigation').waitFor({ state: 'attached' });
}
async function assertGeometryMoves(frame, mesh, where) {
  const initial = await mesh.evaluate(c => ({ angle: c.__nexoraRotation, image: c.toDataURL() }));
  // The old 50ms clamp advances only 0.0126 radians per second at one fps;
  // require a meaningful rotation of the actual projected sphere.
  await frame.waitForFunction(
    angle =>
      Math.abs(document.querySelector('[data-testid="neural-mesh"]')?.__nexoraRotation - angle) >
      0.4,
    initial.angle,
    { polling: 100, timeout: 8000 },
  );
  const after = await mesh.evaluate(c => ({ angle: c.__nexoraRotation, image: c.toDataURL() }));
  assert.ok(Math.abs(after.angle - initial.angle) > 0.4, `${where}: geometry really rotates`);
  assert.notEqual(after.image, initial.image, `${where}: rendered canvas pixels change`);
}
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
      // 1 fps requestAnimationFrame on a high-DPI desktop, no OS motion reduction.
      const slow = await browser.newContext({
        viewport: { width: 1280, height: 900 },
        deviceScaleFactor: 2,
        reducedMotion: 'no-preference',
      });
      try {
        await simulateFrames(slow, 'slow');
        const page = await slow.newPage(),
          errors = [];
        page.on('pageerror', e => errors.push(e.message));
        await page.goto(builtUrl);
        const mesh = page.getByTestId('neural-mesh');
        await page.locator('[data-testid="neural-mesh"][data-motion="animated"]').waitFor();
        const screenBefore = await page.screenshot({ clip: await mesh.boundingBox() });
        await assertGeometryMoves(page, mesh, `${name} 1fps`);
        const screenAfter = await page.screenshot({ clip: await mesh.boundingBox() });
        assert.ok(!screenBefore.equals(screenAfter), `${name} visible screen pixels change`);
        assert.equal(await page.getByRole('button', { name: 'حركة الكرة' }).count(), 0);
        await completeDemoLogin(page);
        await page.waitForFunction(() => window.__testWatchdogs() === 0, null, { polling: 100 });
        assert.deepEqual(errors, []);
        console.log(`PASS ${name} · visibly rotating high-DPI globe despite 1 fps · login cleanup`);
      } finally {
        await slow.close();
      }

      // Mobile sandbox: mimic both missing animation frames and an incorrect
      // host IntersectionObserver report. The globe must start by itself even
      // with the OS preference set to reduce, as the owner explicitly requested.
      const embedded = await browser.newContext({
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 2,
        reducedMotion: 'reduce',
      });
      try {
        await simulateFrames(embedded, 'blocked');
        await embedded.addInitScript(() => {
          window.IntersectionObserver = class {
            constructor(callback) {
              this.callback = callback;
            }
            observe(target) {
              setTimeout(() => this.callback([{ isIntersecting: false, target }], this), 30);
            }
            disconnect() {}
          };
        });
        const page = await embedded.newPage(),
          errors = [],
          external = [];
        page.on('pageerror', e => errors.push(e.message));
        await embedded.route('**/*', route => {
          if (!route.request().url().startsWith(origin)) {
            external.push(route.request().url());
            return route.abort();
          }
          return route.continue();
        });
        await page.goto(origin);
        const loc = page.frameLocator('iframe'),
          mesh = loc.getByTestId('neural-mesh');
        await loc.locator('[data-testid="neural-mesh"][data-motion="animated"]').waitFor();
        const frame = page.frame({ url: `${origin}/demo` });
        assert.equal(await loc.getByRole('button', { name: 'حركة الكرة' }).count(), 0);
        assert.equal(await loc.locator('.auth-motion-hint').count(), 0);
        const screenBefore = await page.screenshot({ clip: await mesh.boundingBox() });
        await assertGeometryMoves(
          frame,
          mesh,
          `${name} autoplay in sandbox with missing frames and a false intersection`,
        );
        const screenAfter = await page.screenshot({ clip: await mesh.boundingBox() });
        assert.ok(!screenBefore.equals(screenAfter), `${name} visible iframe screen pixels change`);
        await completeDemoLogin(loc);
        await frame.waitForFunction(() => window.__testWatchdogs() === 0, null, { polling: 100 });
        assert.deepEqual(errors, []);
        assert.deepEqual(external, []);
        console.log(
          `PASS ${name} · autoplay despite false intersection and missing frames · login cleanup`,
        );
      } finally {
        await embedded.close();
      }

      // Reproduce the offline workspace viewer more closely: srcdoc, opaque
      // sandbox, no network, system requests reduced motion, no initial click.
      const offline = await browser.newContext({
        viewport: { width: 1280, height: 900 },
        reducedMotion: 'reduce',
      });
      try {
        const page = await offline.newPage(),
          errors = [],
          external = [];
        page.on('pageerror', e => errors.push(e.message));
        await offline.route(/^https?:\/\//, route => {
          external.push(route.request().url());
          return route.abort();
        });
        await page.setContent(
          '<iframe title="offline viewer" sandbox="allow-scripts" style="width:100%;height:850px;border:0"></iframe>',
        );
        await page.locator('iframe').evaluate((el, src) => {
          el.srcdoc = src;
        }, html.toString('utf8'));
        const loc = page.frameLocator('iframe'),
          mesh = loc.getByTestId('neural-mesh');
        await loc.locator('[data-testid="neural-mesh"][data-motion="animated"]').waitFor();
        const frame = await (await page.locator('iframe').elementHandle()).contentFrame();
        assert.equal(await loc.getByRole('button', { name: 'حركة الكرة' }).count(), 0);
        assert.equal(await loc.locator('.auth-motion-hint').count(), 0);
        await assertGeometryMoves(frame, mesh, `${name} offline srcdoc autoplay`);
        const hero = await loc.locator('.auth-aside').boundingBox();
        await page.mouse.move(hero.x + hero.width * 0.1, hero.y + hero.height * 0.1);
        await frame.waitForFunction(
          () => document.querySelector('[data-testid="neural-mesh"]').__nexoraTilt < -0.25,
          null,
          { polling: 100, timeout: 10000 },
        );
        let angle = await mesh.evaluate(c => c.__nexoraRotation);
        await frame.waitForFunction(
          a => document.querySelector('[data-testid="neural-mesh"]').__nexoraRotation < a - 0.1,
          angle,
          { polling: 100, timeout: 10000 },
        );
        await page.mouse.move(hero.x + hero.width * 0.9, hero.y + hero.height * 0.9);
        await frame.waitForFunction(
          () => document.querySelector('[data-testid="neural-mesh"]').__nexoraTilt > -0.1,
          null,
          { polling: 100, timeout: 10000 },
        );
        angle = await mesh.evaluate(c => c.__nexoraRotation);
        await frame.waitForFunction(
          a => document.querySelector('[data-testid="neural-mesh"]').__nexoraRotation > a + 0.1,
          angle,
          { polling: 100, timeout: 10000 },
        );
        await completeDemoLogin(loc);
        assert.equal(await mesh.count(), 0);
        assert.deepEqual(errors, []);
        assert.deepEqual(external, []);
        console.log(`PASS ${name} · offline sandboxed srcdoc autoplay and pointer direction`);
      } finally {
        await offline.close();
      }
    } finally {
      await browser.close();
    }
  }
} finally {
  await new Promise(resolve => server.close(resolve));
}
console.log('PASS slow and missing animation-frame reliability, pixels, geometry and cleanup.');
