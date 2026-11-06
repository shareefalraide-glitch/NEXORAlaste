// Reference palette, NeuralMesh, theme changes, reduced motion and cleanup.
// These are focused browser checks, not an accessibility certification.
import {
  assert,
  builtUrl,
  launch,
  newPage,
  login,
  noOverflow,
  clean,
} from '../support/helpers.mjs';
import fs from 'node:fs';

const common = {
  '--nx-brand': '#22d3ee',
  '--nx-brand2': '#3b82f6',
  '--nx-blue': '#4da3ff',
  '--nx-purple': '#a78bfa',
  '--nx-green': '#34d399',
  '--nx-red': '#ff4d5f',
  '--nx-orange': '#ff8b3d',
  '--nx-yellow': '#f5b83d',
  '--nx-chart-cyan': '#22d3ee',
  '--nx-chart-blue': '#4da3ff',
  '--nx-chart-red': '#ff4d5f',
  '--nx-chart-orange': '#ff8b3d',
  '--nx-chart-yellow': '#f5b83d',
};
const palette = {
  dark: {
    '--nx-bg0': '#07090d',
    '--nx-bg1': '#0b0e15',
    '--nx-bg2': '#10141d',
    '--nx-bg3': '#161c28',
    '--nx-bg4': '#1c2434',
    '--nx-line': '#1e2635',
    '--nx-line2': '#2a3550',
    '--nx-tx1': '#e9eef7',
    '--nx-tx2': '#9fadc4',
    '--nx-tx3': '#64748f',
    ...common,
  },
  light: {
    '--nx-bg0': '#eef1f6',
    '--nx-bg1': '#f7f9fc',
    '--nx-bg2': '#ffffff',
    '--nx-bg3': '#eef2f8',
    '--nx-bg4': '#e3e9f2',
    '--nx-line': '#d8e0ec',
    '--nx-line2': '#c2cee0',
    '--nx-tx1': '#16202e',
    '--nx-tx2': '#4c5c74',
    '--nx-tx3': '#7c8aa0',
    ...common,
  },
};
const pixels = locator =>
  locator.evaluate(canvas => {
    const { data } = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);
    let painted = 0;
    for (let i = 3; i < data.length; i += 4) if (data[i]) painted++;
    return { painted, total: data.length / 4, width: canvas.width, height: canvas.height };
  });
const image = locator => locator.evaluate(canvas => canvas.toDataURL());
const brandLogos = {
  dark: fs.readFileSync('src/assets/nexora-logo-dark.png'),
  light: fs.readFileSync('src/assets/nexora-logo-light.png'),
};
assert.ok(
  !brandLogos.dark.equals(brandLogos.light),
  'different artwork is retained for each theme',
);
const projectIcon = fs.readFileSync('src/assets/nexora-icon.png');
const suppliedSvg = fs.readFileSync('public/icon.svg', 'utf8');
assert.match(suppliedSvg, /<svg\b/);
assert.match(suppliedSvg, /data:image\/png;base64,/);
const brandingByWidth = new Map();
async function assertPng(locator, attribute, expected, where) {
  const url = await locator.getAttribute(attribute);
  assert.ok(url?.startsWith('data:image/png;base64,'), `${where} must be self-contained`);
  assert.ok(
    Buffer.from(url.split(',')[1], 'base64').equals(expected),
    `${where} matches the supplied artwork`,
  );
}
async function dimensions(locator) {
  return locator.evaluate(el => {
    const r = el.getBoundingClientRect();
    return {
      x: r.x,
      y: r.y,
      width: r.width,
      height: r.height,
      naturalWidth: el.naturalWidth,
      naturalHeight: el.naturalHeight,
      filter: getComputedStyle(el).filter,
    };
  });
}
async function contentBounds(locator) {
  return locator.evaluate(img => {
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const c = canvas.getContext('2d');
    c.drawImage(img, 0, 0);
    const a = c.getImageData(0, 0, canvas.width, canvas.height).data;
    let x1 = canvas.width,
      y1 = canvas.height,
      x2 = -1,
      y2 = -1;
    for (let y = 0; y < canvas.height; y++)
      for (let x = 0; x < canvas.width; x++)
        if (a[(y * canvas.width + x) * 4 + 3] > 15) {
          x1 = Math.min(x1, x);
          y1 = Math.min(y1, y);
          x2 = Math.max(x2, x);
          y2 = Math.max(y2, y);
        }
    return { x1, y1, x2, y2 };
  });
}
async function assertFaviconOnly(page, where) {
  const favicon = page.locator('link[rel="icon"]');
  await assertPng(favicon, 'href', projectIcon, `${where} favicon`);
  const src = await favicon.getAttribute('href');
  assert.equal(
    await page
      .locator('body img')
      .evaluateAll((imgs, url) => imgs.some(img => img.getAttribute('src') === url), src),
    false,
    `${where} icon must not appear inside the interface`,
  );
  assert.equal(await page.locator('.auth-brand-icon,.brand-icon').count(), 0);
}
const browser = await launch();
try {
  for (const theme of ['dark', 'light'])
    for (const width of [1440, 320]) {
      const run = await newPage(browser, { theme, width }),
        { page } = run;
      try {
        const actual = await page.evaluate(
          keys =>
            Object.fromEntries(
              keys.map(key => [
                key,
                getComputedStyle(document.documentElement)
                  .getPropertyValue(key)
                  .trim()
                  .toLowerCase(),
              ]),
            ),
          Object.keys(palette[theme]),
        );
        assert.deepEqual(actual, palette[theme], `${theme} canonical nexora-clean palette`);
        const mesh = page.getByTestId('neural-mesh');
        // Autoplay and pointer response are retained; the user removed the
        // motion toggle and its adjacent notice from the login screen.
        await page.locator('[data-testid="neural-mesh"][data-motion="animated"]').waitFor();
        assert.equal(await mesh.getAttribute('aria-hidden'), 'true');
        assert.equal(await mesh.isVisible(), true, `${theme}/${width} globe visible`);
        const canvas = await pixels(mesh);
        assert.ok(
          canvas.painted > 300 && canvas.width > 0 && canvas.height > 0,
          `${theme}/${width} rendered globe ${JSON.stringify(canvas)}`,
        );
        assert.ok(
          width === 1440
            ? canvas.width >= 600 && canvas.width <= 630
            : canvas.width >= 200 && canvas.width <= 215,
          `${theme}/${width} enlarged globe frame`,
        );
        assert.equal(await page.getByRole('button', { name: 'حركة الكرة' }).count(), 0);
        assert.equal(
          await page.locator('.auth-motion-control,.auth-motion-toggle,.auth-motion-hint').count(),
          0,
        );
        const first = await image(mesh),
          initialAngle = await mesh.evaluate(c => c.__nexoraRotation);
        await page.waitForFunction(
          angle =>
            Math.abs(
              document.querySelector('[data-testid="neural-mesh"]').__nexoraRotation - angle,
            ) > 0.08,
          initialAngle,
          { timeout: 10000 },
        );
        assert.notEqual(await image(mesh), first, `${theme}/${width} autoplay visibly repaints`);
        if (theme === 'dark' && width === 1440) {
          const before = await mesh.evaluate(c => ({
            angle: c.__nexoraRotation,
            time: performance.now(),
          }));
          await page.waitForTimeout(1400);
          const after = await mesh.evaluate(c => ({
            angle: c.__nexoraRotation,
            time: performance.now(),
          }));
          const rate = ((after.angle - before.angle) * 1000) / (after.time - before.time);
          assert.ok(rate > 0.23 && rate < 0.35, `slower default rotation rate: ${rate} rad/s`);
        }
        await page.evaluate(() => document.fonts.ready);
        const authLogo = page.locator('.auth-aside-logo');
        await authLogo.evaluate(img => img.decode());
        await assertPng(authLogo, 'src', brandLogos[theme], `${theme}/${width} login wordmark`);
        await assertFaviconOnly(page, `${theme}/${width} login`);
        const authSize = await dimensions(authLogo),
          ink = await contentBounds(authLogo);
        await noOverflow(page, `${theme}/${width}/login globe`);
        await login(page);
        const menu = page.getByRole('button', { name: 'فتح القائمة' });
        if (await menu.isVisible()) {
          await menu.click();
          await page.waitForTimeout(300);
        }
        const sidebarLogo = page.locator('.sidebar-brand-row .brand-logo');
        await sidebarLogo.evaluate(img => img.decode());
        await assertPng(
          sidebarLogo,
          'src',
          brandLogos[theme],
          `${theme}/${width} sidebar wordmark`,
        );
        await assertFaviconOnly(page, `${theme}/${width} sidebar`);
        const snapshot = { authSize, ink, sidebarSize: await dimensions(sidebarLogo) };
        if (theme === 'dark') brandingByWidth.set(width, snapshot);
        else
          assert.deepEqual(
            snapshot,
            brandingByWidth.get(width),
            `${width}px same wordmark size, position, whitespace and styling in both themes`,
          );
        clean(run);
        console.log(
          `PASS aligned theme-specific logos, favicon-only icon, autoplay globe and reference palette · ${theme} · ${width}px`,
        );
      } finally {
        await run.context.close();
      }
    }
  // The framed canvas has transparent padding: test the painted mesh itself,
  // rather than treating that padding as overlapping the foreground copy.
  // These minimum pixel widths are deliberately above the previous release.
  for (const [width, height, minFrame, minPaint, theme] of [
    [1920, 940, 630, 540, 'dark'],
    [1920, 800, 505, 440, 'dark'],
    [1440, 900, 610, 525, 'dark'],
    [1440, 768, 475, 415, 'dark'],
    [1024, 768, 440, 385, 'dark'],
    [900, 700, 360, 310, 'dark'],
    [780, 700, 310, 265, 'dark'],
    [761, 700, 300, 260, 'dark'],
    [1920, 700, 410, 355, 'dark'],
    [411, 700, 225, 195, 'dark'],
    [390, 844, 225, 195, 'dark'],
    [381, 700, 225, 195, 'dark'],
    [320, 700, 200, 175, 'dark'],
    [1440, 480, 225, 195, 'dark'],
    [1440, 900, 610, 525, 'light'],
    [390, 844, 225, 195, 'light'],
    [320, 700, 200, 175, 'light'],
  ]) {
    const run = await newPage(browser, { width, height, theme }),
      { page } = run;
    try {
      await page.locator('[data-testid="neural-mesh"][data-motion="animated"]').waitFor();
      await page.evaluate(() => document.fonts.ready);
      const layout = await page.evaluate(() => {
        const r = s => document.querySelector(s).getBoundingClientRect();
        const frame = r('.mesh-frame'),
          hero = r('.auth-aside'),
          brand = r('.auth-aside-logo'),
          badges = r('.auth-aside-badges'),
          canvas = document.querySelector('.neural-mesh');
        const targets = [
          '.auth-aside-logo',
          '.auth-aside-badges',
          ...(innerWidth > 760
            ? [
                '.auth-aside-overline',
                '.auth-aside-copy h2',
                '.auth-aside-copy p',
                '.auth-feature-row',
              ]
            : []),
        ].map(s => ({ selector: s, box: r(s), hits: 0 }));
        const data = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
        const rx = frame.width / canvas.width,
          ry = frame.height / canvas.height;
        let x1 = canvas.width,
          y1 = canvas.height,
          x2 = -1,
          y2 = -1;
        for (let y = 0; y < canvas.height; y++)
          for (let x = 0; x < canvas.width; x++) {
            if (data[(y * canvas.width + x) * 4 + 3] <= 70) continue;
            x1 = Math.min(x1, x);
            y1 = Math.min(y1, y);
            x2 = Math.max(x2, x);
            y2 = Math.max(y2, y);
            const px = frame.left + (x + 0.5) * rx,
              py = frame.top + (y + 0.5) * ry;
            for (const target of targets) {
              const b = target.box;
              if (px >= b.left && px <= b.right && py >= b.top && py <= b.bottom) target.hits++;
            }
          }
        return {
          frameWidth: frame.width,
          center: frame.x + frame.width / 2,
          heroCenter: hero.x + hero.width / 2,
          frameBottom: frame.bottom,
          heroBottom: hero.bottom,
          scrollHeight: document.documentElement.scrollHeight,
          viewportHeight: innerHeight,
          brandRight: brand.right,
          badgesLeft: badges.left,
          badgesHeight: badges.height,
          paintWidth: (x2 - x1 + 1) * rx,
          paintTop: frame.top + y1 * ry,
          paintBottom: frame.top + y2 * ry,
          inset: [x1 * rx, y1 * ry, (canvas.width - 1 - x2) * rx, (canvas.height - 1 - y2) * ry],
          hits: Object.fromEntries(targets.map(t => [t.selector, t.hits])),
        };
      });
      assert.ok(
        layout.frameWidth >= minFrame && Math.abs(layout.center - layout.heroCenter) < 1,
        `${theme}/${width}x${height}: larger centered canvas ${JSON.stringify(layout)}`,
      );
      assert.ok(
        layout.paintWidth >= minPaint && layout.inset.every(v => v >= 2),
        `${theme}/${width}x${height}: enlarged mesh with an unclipped glow inset ${JSON.stringify(layout)}`,
      );
      assert.ok(
        Object.values(layout.hits).every(n => n === 0),
        `${theme}/${width}x${height}: foreground text and header stay clear of mesh strokes ${JSON.stringify(layout)}`,
      );
      if (width > 760 && height >= 700)
        assert.ok(
          layout.scrollHeight <= layout.viewportHeight + 1,
          `${theme}/${width}x${height}: no unnecessary vertical scroll ${JSON.stringify(layout)}`,
        );
      if (width <= 760)
        assert.ok(
          layout.frameBottom + 5 < layout.heroBottom,
          `${theme}/${width}x${height}: mobile sphere stays in banner ${JSON.stringify(layout)}`,
        );
      assert.ok(
        layout.brandRight + 5 <= layout.badgesLeft && layout.badgesHeight <= 31,
        `${theme}/${width}x${height}: brand and badges do not overlap or wrap ${JSON.stringify(layout)}`,
      );
      await noOverflow(page, `${theme}/${width}x${height} sphere layout`);
      clean(run);
    } finally {
      await run.context.close();
    }
  }
  console.log(
    'PASS larger painted globe, text separation and unclipped responsive layout in both themes',
  );

  // Check actual drawing operations, not only changing pixels: the reference's
  // blue depth links, 26 travelers, glowing nodes, five red pulse rings and
  // occasional green interception flashes are all present in the canvas.
  const effectsContext = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    reducedMotion: 'reduce',
  });
  try {
    await effectsContext.addInitScript(() => {
      const p = CanvasRenderingContext2D.prototype,
        clear = p.clearRect,
        draw = p.drawImage,
        stroke = p.stroke;
      const s = (window.__effects = {
        frames: 0,
        frameSprites: 0,
        minSprites: 999,
        darkEdges: 0,
        lightEdges: 0,
        redRings: 0,
        greenFlashes: 0,
        ringColors: new Set(),
        travelerPositions: [],
      });
      const isMesh = ctx => ctx.canvas?.dataset?.testid === 'neural-mesh';
      p.clearRect = function (...args) {
        if (isMesh(this)) {
          if (s.frameSprites) s.minSprites = Math.min(s.minSprites, s.frameSprites);
          s.frameSprites = 0;
          s.frames++;
        }
        return clear.apply(this, args);
      };
      p.drawImage = function (...args) {
        if (isMesh(this)) {
          s.frameSprites++;
          if (s.frameSprites === 1 && s.frames % 6 === 0 && s.travelerPositions.length < 30)
            s.travelerPositions.push(args.slice(1, 3).map(Math.round).join(','));
        }
        return draw.apply(this, args);
      };
      p.stroke = function (...args) {
        if (isMesh(this)) {
          const color = String(this.strokeStyle);
          if (color.includes('56, 150, 235')) s.darkEdges++;
          else if (color.includes('28, 88, 158')) s.lightEdges++;
          else if (color.includes('255, 77, 95')) {
            s.redRings++;
            s.ringColors.add(color);
          } else if (color.includes('52, 211, 153')) s.greenFlashes++;
        }
        return stroke.apply(this, args);
      };
    });
    const page = await effectsContext.newPage(),
      errors = [],
      network = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => {
      if (m.type() === 'error') errors.push(m.text());
    });
    await effectsContext.route(/^https?:\/\//, route => {
      network.push(route.request().url());
      return route.abort();
    });
    await page.goto(builtUrl, { waitUntil: 'load' });
    await page.waitForFunction(
      () => {
        const s = window.__effects;
        return (
          s.frames > 20 &&
          s.redRings > 50 &&
          s.ringColors.size > 5 &&
          new Set(s.travelerPositions).size >= 3 &&
          s.greenFlashes > 0
        );
      },
      null,
      { timeout: 20000 },
    );
    const dark = await page.evaluate(() => ({
      ...window.__effects,
      ringColors: [...window.__effects.ringColors],
    }));
    assert.ok(
      dark.darkEdges > 100 && dark.minSprites >= 211,
      `reference mesh links and 185 nodes + 26 data travelers: ${JSON.stringify(dark)}`,
    );
    assert.ok(
      dark.redRings >= dark.frames * 4 && dark.ringColors.length > 5 && dark.greenFlashes > 0,
      'pulsing red rings and green interception flashes are drawn',
    );
    await page.getByRole('button', { name: 'تفعيل المظهر الفاتح' }).click();
    await page.waitForFunction(() => window.__effects.lightEdges > 50);
    assert.equal(await page.locator('html').getAttribute('data-theme'), 'light');
    assert.deepEqual(errors, []);
    assert.deepEqual(network, []);
    console.log(
      'PASS reference-style links, travelers, glowing nodes, red pulses and occasional green flashes',
    );
  } finally {
    await effectsContext.close();
  }

  // Track only the globe's observers/listeners while exercising the live path.
  const context = await browser.newContext({
      viewport: { width: 1200, height: 800 },
      reducedMotion: 'no-preference',
    }),
    errors = [],
    network = [];
  try {
    await context.addInitScript(() => {
      const activeRaf = new Set(),
        timers = new Set(),
        watchdogs = new Set(),
        resizeObservers = new Set(),
        intersections = new Set(),
        pointer = new Set(),
        visibility = new Set(),
        motion = new Set();
      // Track registrations made while the login globe exists, not the unrelated
      // compass which starts its own RAF, timer and visibility listener on login.
      const globeMounted = () => Boolean(document.querySelector('[data-testid="neural-mesh"]'));
      const raf = window.requestAnimationFrame.bind(window),
        cancel = window.cancelAnimationFrame.bind(window);
      window.requestAnimationFrame = callback => {
        const track = globeMounted();
        let id;
        id = raf(time => {
          activeRaf.delete(id);
          callback(time);
        });
        if (track) activeRaf.add(id);
        return id;
      };
      window.cancelAnimationFrame = id => {
        activeRaf.delete(id);
        cancel(id);
      };
      const timeout = window.setTimeout.bind(window),
        clear = window.clearTimeout.bind(window);
      window.setTimeout = (cb, delay, ...args) => {
        const track = globeMounted();
        let id;
        id = timeout(
          (...a) => {
            timers.delete(id);
            watchdogs.delete(id);
            cb(...a);
          },
          delay,
          ...args,
        );
        if (track && delay === 500) timers.add(id);
        if (track && (delay === 400 || delay === 1200)) watchdogs.add(id);
        return id;
      };
      window.clearTimeout = id => {
        timers.delete(id);
        watchdogs.delete(id);
        clear(id);
      };
      const RO = window.ResizeObserver,
        IO = window.IntersectionObserver;
      if (RO)
        window.ResizeObserver = class extends RO {
          observe(target, options) {
            if (target.classList.contains('mesh-frame')) resizeObservers.add(this);
            return super.observe(target, options);
          }
          disconnect() {
            resizeObservers.delete(this);
            return super.disconnect();
          }
        };
      if (IO)
        window.IntersectionObserver = class extends IO {
          observe(target) {
            if (target.classList.contains('mesh-frame')) intersections.add(this);
            return super.observe(target);
          }
          disconnect() {
            intersections.delete(this);
            return super.disconnect();
          }
        };
      const add = EventTarget.prototype.addEventListener,
        remove = EventTarget.prototype.removeEventListener;
      EventTarget.prototype.addEventListener = function (type, cb, options) {
        if (globeMounted() && this === document && type === 'visibilitychange') visibility.add(cb);
        if (globeMounted() && this === window && type === 'pointermove') pointer.add(cb);
        return add.call(this, type, cb, options);
      };
      EventTarget.prototype.removeEventListener = function (type, cb, options) {
        if (this === document && type === 'visibilitychange') visibility.delete(cb);
        if (this === window && type === 'pointermove') pointer.delete(cb);
        return remove.call(this, type, cb, options);
      };
      const match = window.matchMedia.bind(window);
      window.matchMedia = query => {
        const mq = match(query);
        if (query === '(prefers-reduced-motion: reduce)' && mq.addEventListener) {
          const a = mq.addEventListener.bind(mq),
            r = mq.removeEventListener.bind(mq);
          mq.addEventListener = (type, cb, ...rest) => {
            if (type === 'change') motion.add(cb);
            return a(type, cb, ...rest);
          };
          mq.removeEventListener = (type, cb, ...rest) => {
            if (type === 'change') motion.delete(cb);
            return r(type, cb, ...rest);
          };
        }
        return mq;
      };
      window.__meshStats = () => ({
        raf: activeRaf.size,
        poll: timers.size,
        watchdog: watchdogs.size,
        resize: resizeObservers.size,
        intersection: intersections.size,
        pointer: pointer.size,
        visibility: visibility.size,
        motion: motion.size,
      });
    });
    const page = await context.newPage();
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => {
      if (m.type() === 'error') errors.push(m.text());
    });
    await context.route(/^https?:\/\//, route => {
      network.push(route.request().url());
      return route.abort();
    });
    await page.goto(builtUrl, { waitUntil: 'load' });
    const mesh = page.getByTestId('neural-mesh');
    await mesh.waitFor();
    await page.waitForFunction(
      () => window.__meshStats().raf > 0 && window.__meshStats().watchdog === 1,
    );
    assert.equal(await mesh.getAttribute('data-motion'), 'animated');
    const hero = await page.locator('.auth-aside').boundingBox();
    await page.mouse.move(hero.x + hero.width * 0.325, hero.y + hero.height * 0.5);
    const animated = await image(mesh),
      angle = await mesh.evaluate(c => c.__nexoraRotation);
    await page.waitForFunction(
      a =>
        Math.abs(document.querySelector('[data-testid="neural-mesh"]').__nexoraRotation - a) > 0.05,
      angle,
      { timeout: 10000 },
    );
    assert.notEqual(
      await image(mesh),
      animated,
      'normal motion changes the image at the old cancellation point',
    );
    await page.mouse.move(hero.x + hero.width * 0.1, hero.y + hero.height * 0.1);
    await page.waitForFunction(
      () => document.querySelector('[data-testid="neural-mesh"]').__nexoraTilt < -0.25,
    );
    let directionAngle = await mesh.evaluate(c => c.__nexoraRotation);
    await page.waitForFunction(
      a => document.querySelector('[data-testid="neural-mesh"]').__nexoraRotation < a - 0.12,
      directionAngle,
      { timeout: 10000 },
    );
    await page.mouse.move(hero.x + hero.width * 0.9, hero.y + hero.height * 0.9);
    await page.waitForFunction(
      () => document.querySelector('[data-testid="neural-mesh"]').__nexoraTilt > -0.1,
    );
    directionAngle = await mesh.evaluate(c => c.__nexoraRotation);
    await page.waitForFunction(
      a => document.querySelector('[data-testid="neural-mesh"]').__nexoraRotation > a + 0.12,
      directionAngle,
      { timeout: 10000 },
    );
    await page.getByLabel('البريد الإلكتروني').fill('demo@example.test');
    await page.getByLabel('كلمة المرور', { exact: true }).fill('example');
    const old = await image(mesh);
    await page.getByRole('button', { name: 'تفعيل المظهر الفاتح' }).click();
    assert.equal(await page.locator('html').getAttribute('data-theme'), 'light');
    assert.equal(await page.getByLabel('البريد الإلكتروني').inputValue(), 'demo@example.test');
    assert.equal(await page.getByLabel('كلمة المرور', { exact: true }).inputValue(), 'example');
    assert.notEqual(
      await image(mesh),
      old,
      'canvas is repainted using the light reference palette',
    );
    await page.getByRole('button', { name: 'تفعيل المظهر الداكن' }).click();
    await page.waitForFunction(() => {
      const s = window.__meshStats();
      return (
        s.resize === 1 &&
        s.intersection === 1 &&
        s.pointer === 1 &&
        s.visibility === 1 &&
        s.motion === 1
      );
    });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    assert.equal(
      await mesh.getAttribute('data-motion'),
      'animated',
      'autoplay remains on when OS prefers reduced motion, as explicitly requested',
    );
    assert.equal(await page.getByRole('button', { name: 'حركة الكرة' }).count(), 0);
    const angleDuringReduction = await mesh.evaluate(c => c.__nexoraRotation);
    await page.waitForFunction(
      a =>
        Math.abs(document.querySelector('[data-testid="neural-mesh"]').__nexoraRotation - a) > 0.06,
      angleDuringReduction,
      { timeout: 10000 },
    );
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.setViewportSize({ width: 1440, height: 768 });
    const layout = await page.evaluate(() => {
      const frame = document.querySelector('.mesh-frame').getBoundingClientRect(),
        hero = document.querySelector('.auth-aside').getBoundingClientRect();
      return {
        width: frame.width,
        center: frame.left + frame.width / 2,
        heroCenter: hero.left + hero.width / 2,
        scrollHeight: document.documentElement.scrollHeight,
        viewportHeight: innerHeight,
      };
    });
    assert.ok(
      layout.width >= 475 &&
        layout.width <= 490 &&
        Math.abs(layout.center - layout.heroCenter) < 1 &&
        layout.scrollHeight <= layout.viewportHeight + 1,
      `compact desktop layout ${JSON.stringify(layout)}`,
    );
    await page.setViewportSize({ width: 320, height: 600 });
    await noOverflow(page, 'responsive globe after resize');
    await page.getByRole('button', { name: 'استخدام بيانات تجريبية' }).scrollIntoViewIfNeeded();
    await page.waitForFunction(
      () =>
        document.querySelector('[data-testid="neural-mesh"]').getBoundingClientRect().bottom <= 0,
    );
    await page.waitForFunction(
      () => window.__meshStats().raf === 0 && window.__meshStats().watchdog === 0,
    );
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForFunction(
      () => window.__meshStats().raf > 0 && window.__meshStats().watchdog === 1,
    );
    // Unmount while the animation and watchdog are active.
    await page.waitForFunction(() => window.__meshStats().watchdog === 1);
    await login(page);
    await page.waitForFunction(() => {
      const s = window.__meshStats();
      return (
        s.raf === 0 &&
        s.poll === 0 &&
        s.watchdog === 0 &&
        s.resize === 0 &&
        s.intersection === 0 &&
        s.pointer === 0 &&
        s.visibility === 0 &&
        s.motion === 0
      );
    });
    assert.equal(
      await page.getByTestId('overview-radar').count(),
      1,
      'globe cleanup does not stop the dashboard radar',
    );
    assert.deepEqual(errors, []);
    assert.deepEqual(network, []);
    console.log(
      'PASS live motion, theme repaint, resize, offscreen pause, preference change and resource cleanup',
    );
  } finally {
    await context.close();
  }
} finally {
  await browser.close();
}
console.log('PASS reference-theme and NeuralMesh checks.');
