// Deterministic network UI prototype: unit consistency, honest provenance,
// keyboard/mouse interactions, responsive layouts and an offline sandbox.
// No actual monitoring, Geo-IP lookup, backend or WCAG certification is tested.
import fs from 'node:fs';
import AxeBuilder from '@axe-core/playwright';
import { chromium, firefox, webkit } from 'playwright';
import { assert, builtUrl, newPage, login, noOverflow, clean } from '../support/helpers.mjs';
import {
  NETWORK_BASELINE,
  NETWORK_PERIODS,
  networkView,
  netRate,
} from '../../src/features/network/network-data.js';
import { WORLD_DOTS } from '../../src/features/network/world-dots.js';

const close = (a, b, message) =>
  assert.ok(Math.abs(a - b) < Math.max(1e-7, Math.abs(b) * 1e-10), `${message}: ${a} vs ${b}`);
assert.ok(
  WORLD_DOTS.length > 1000,
  'reference land dots provide a decorative base map, not geolocation',
);
assert.equal(netRate(1000, 'Gbps'), '١٫٠٠');
for (const period of Object.keys(NETWORK_PERIODS)) {
  const incoming = networkView(period, 'in'),
    outgoing = networkView(period, 'out'),
    both = networkView(period, 'both');
  for (const v of [incoming, outgoing, both]) {
    assert.equal(v.duration, NETWORK_PERIODS[period].samples * 300);
    close(v.mbps, (v.bytes * 8) / v.duration / 1e6, `${period}/${v.direction} throughput`);
    close(v.pps, v.packets / v.duration, `${period}/${v.direction} packets`);
    close(v.meanBytes, v.bytes / v.packets, `${period}/${v.direction} mean bytes`);
    close(
      (v.pps * v.meanBytes * 8) / 1e6,
      v.mbps,
      `${period}/${v.direction} metrics share a window`,
    );
    close(v.cps, v.completed / v.duration, `${period}/${v.direction} completed TCP CPS`);
    assert.equal(v.completed + v.incomplete, v.attempts);
    assert.equal(v.resets + v.unresolved, v.incomplete);
    assert.ok(v.resets >= 0 && v.resets <= v.incomplete);
    close(v.incompletePercent, (v.incomplete / v.attempts) * 100, 'handshake rate');
    close(
      v.transport.reduce((s, x) => s + x.percent, 0),
      100,
      'transport group sums to 100%',
    );
    close(
      v.applications.reduce((s, x) => s + x.percent, 0),
      100,
      'application group sums to 100%',
    );
    assert.ok(
      v.ports.reduce((s, x) => s + x.count, 0) < v.attempts,
      'sample port observations are a subset',
    );
    assert.ok(
      v.talkers.every((x, i, all) => !i || all[i - 1].bytes >= x.bytes),
      'talkers are sorted by volume',
    );
    assert.ok(
      v.talkers.reduce((s, x) => s + x.bytes, 0) < v.bytes,
      'remaining assets are not misrepresented as displayed',
    );
    assert.ok(
      v.regions.every(x => !('ip' in x) && x.x > 0 && x.x < 1000 && x.y > 0 && x.y < 500),
      'regions are synthetic map positions, not IP lookups',
    );
    assert.equal(v.buckets.length, period === '7d' ? 14 : 12);
    const chartIn = v.buckets.reduce((s, x) => s + x.mbpsIn * x.seconds, 0) / v.duration;
    const chartOut = v.buckets.reduce((s, x) => s + x.mbpsOut * x.seconds, 0) / v.duration;
    close(chartIn, (v.totals.bytesIn * 8) / v.duration / 1e6, 'inbound chart agrees with average');
    close(
      chartOut,
      (v.totals.bytesOut * 8) / v.duration / 1e6,
      'outbound chart agrees with average',
    );
  }
  for (const k of ['bytes', 'packets', 'completed', 'attempts', 'incomplete', 'resets', 'active'])
    close(both[k], incoming[k] + outgoing[k], `${period} directional ${k}`);
  for (let i = 0; i < both.regions.length; i++)
    assert.equal(
      both.regions[i].count,
      incoming.regions[i].count + outgoing.regions[i].count,
      'illustrative region counts respect direction',
    );
}
assert.equal(
  networkView('1h').active,
  networkView('7d').active,
  'active sessions are a fixed end-of-sample snapshot',
);
for (const period of Object.keys(NETWORK_PERIODS))
  for (const direction of ['in', 'out', 'both']) {
    const normal = networkView(period, direction),
      spike = networkView(period, direction, 'spike');
    assert.equal(normal.scenario, 'normal');
    assert.equal(spike.scenario, 'spike');
    assert.ok(
      spike.mbps > normal.mbps && spike.pps > normal.pps,
      'the optional synthetic spike affects traffic',
    );
    for (const key of ['active', 'cps', 'completed', 'attempts', 'incomplete', 'resets'])
      close(spike[key], normal[key], `${period}/${direction} scenario leaves ${key} alone`);
    assert.deepEqual(
      spike.regions,
      normal.regions,
      'illustrative geography is independent from the traffic scenario',
    );
    assert.deepEqual(
      spike.ports,
      normal.ports,
      'TCP observations are not changed by the traffic scenario',
    );
    for (let i = 0; i < normal.buckets.length; i++) {
      const a = normal.buckets[i],
        b = spike.buckets[i];
      for (const key of ['baselineMbpsIn', 'baselineMbpsOut'])
        close(a[key], b[key], `${period}/${direction}/${i} reference does not move with spike`);
      for (const [actual, base, flag] of [
        ['mbpsIn', 'baselineMbpsIn', 'alertIn'],
        ['mbpsOut', 'baselineMbpsOut', 'alertOut'],
      ]) {
        assert.equal(a[flag], a[base] > 0 && a[actual] > a[base] * NETWORK_BASELINE.alertFactor);
        assert.equal(b[flag], b[base] > 0 && b[actual] > b[base] * NETWORK_BASELINE.alertFactor);
      }
    }
    const last = normal.buckets.at(-1),
      elevated = spike.buckets.at(-1);
    assert.equal(last.alertIn, false);
    assert.equal(last.alertOut, false);
    assert.equal(elevated.alertIn, true);
    assert.equal(elevated.alertOut, true);
    close(
      elevated.mbpsIn / last.mbpsIn,
      NETWORK_BASELINE.spikeFactor,
      `${period} final inbound spike`,
    );
    close(
      elevated.mbpsOut / last.mbpsOut,
      NETWORK_BASELINE.spikeFactor,
      `${period} final outbound spike`,
    );
    close(
      spike.mbps,
      (spike.pps * spike.meanBytes * 8) / 1e6,
      'spike throughput remains consistent with packets and size',
    );
  }
assert.equal(networkView('24h', 'both', 'not-a-scenario').scenario, 'normal');
console.log(
  'PASS deterministic counters, baseline windows and thresholds, simulated spike, independent geographic fixture',
);

async function assertMetrics(root, view, where) {
  for (const [id, field] of [
    ['throughput', 'mbps'],
    ['pps', 'pps'],
    ['packet-size', 'meanBytes'],
    ['active', 'active'],
    ['cps', 'cps'],
    ['handshake', 'incomplete'],
  ]) {
    const val = Number(await root.getByTestId(`network-${id}`).getAttribute('data-value'));
    close(val, view[field], `${where}/${id}`);
  }
}
async function exercise(root, frame, where) {
  await root.getByRole('button', { name: 'استكشف التحليل' }).click();
  await root.getByRole('heading', { name: 'تحليل الشبكة', exact: true }).waitFor();
  assert.equal(
    (await root.locator('#primary-navigation button[aria-current="page"]').textContent()).trim(),
    'تحليل الشبكة',
  );
  await assertMetrics(root, networkView('24h', 'both'), `${where}/default`);
  assert.match(await root.locator('.network-intro').innerText(), /عينة ثابتة، وليست مراقبة مباشرة/);
  assert.match(await root.locator('.network-map-note').innerText(), /لا يوجد بحث Geo-IP/);
  assert.match(
    await root.locator('.network-map-note').innerText(),
    /لا تُستنتج مواقع من العناوين الخاصة/,
  );
  assert.equal(await root.locator('.network-map-point').count(), 4);
  assert.equal(
    await root.getByTestId('network-baseline-status').getAttribute('data-state'),
    'normal',
  );
  assert.match(await root.getByTestId('network-baseline-status').innerText(), /ضمن الحد التجريبي/);
  assert.equal(
    await root.getByRole('button', { name: 'العينة العادية' }).getAttribute('aria-pressed'),
    'true',
  );
  assert.equal(
    await root.locator('.network-baseline-line').count(),
    2,
    'one comparable reference per displayed direction',
  );
  assert.equal(await root.locator('.network-chart-line.is-alert').count(), 0);
  const slider = root.getByRole('slider', {
    name: 'استكشاف فترات حركة الشبكة، استخدم مفاتيح الأسهم',
  });
  assert.match(await slider.getAttribute('aria-valuetext'), /الأساس/);
  const normalActive = await root.getByTestId('network-active').getAttribute('data-value');
  const normalRegions = await root.locator('.network-region-selected').textContent();
  await root.getByRole('button', { name: 'محاكاة ارتفاع' }).click();
  await root.locator('[data-testid="network-baseline-status"][data-state="alert"]').waitFor();
  assert.match(await root.getByTestId('network-baseline-status').innerText(), /انحراف تجريبي/);
  assert.equal(
    await root.getByRole('button', { name: 'محاكاة ارتفاع' }).getAttribute('aria-pressed'),
    'true',
  );
  assert.equal(await root.locator('.network-chart-line.is-alert').count(), 2);
  assert.match(await slider.getAttribute('aria-valuetext'), /فوق حد المراجعة التجريبي/);
  assert.match(await root.locator('.network-scenario-note').innerText(), /لا تتصل بشبكة/);
  await assertMetrics(root, networkView('24h', 'both', 'spike'), `${where}/spike`);
  assert.equal(await root.getByTestId('network-active').getAttribute('data-value'), normalActive);
  assert.equal(await root.locator('.network-region-selected').textContent(), normalRegions);
  await root.getByRole('button', { name: 'العينة العادية' }).click();
  await root.locator('[data-testid="network-baseline-status"][data-state="normal"]').waitFor();
  assert.equal(await root.locator('.network-chart-line.is-alert').count(), 0);
  await assertMetrics(root, networkView('24h', 'both'), `${where}/reset`);
  const throughput = root.getByTestId('network-throughput');
  await root.getByLabel('وحدة سرعة النقل').selectOption('Gbps');
  assert.match(await throughput.innerText(), /Gbps/);
  assert.equal(
    Number(await throughput.getAttribute('data-value')),
    networkView('24h', 'both').mbps,
    'unit choice must not change source data',
  );
  await root.getByLabel('الفترة الزمنية لتحليل الشبكة').selectOption('1h');
  await root.getByLabel('اتجاه حركة الشبكة').selectOption('out');
  await assertMetrics(root, networkView('1h', 'out'), `${where}/hour/outbound`);
  assert.match(await root.getByTestId('network-handshake').innerText(), /محاولات TCP/);
  await root.getByRole('button', { name: 'محاكاة ارتفاع' }).click();
  await root.locator('[data-testid="network-baseline-status"][data-state="alert"]').waitFor();
  await assertMetrics(root, networkView('1h', 'out', 'spike'), `${where}/hour/outbound/spike`);
  assert.equal(await root.locator('.network-baseline-line').count(), 1, 'one outbound reference');
  assert.equal(await root.locator('.network-chart-line.is-alert').count(), 1);
  await root.getByLabel('الفترة الزمنية لتحليل الشبكة').selectOption('7d');
  await assertMetrics(root, networkView('7d', 'out', 'spike'), `${where}/week/outbound/spike`);
  assert.equal(
    await root.getByTestId('network-baseline-status').getAttribute('data-state'),
    'alert',
  );
  assert.match(await slider.getAttribute('aria-valuetext'), /Gbps/);
  await root.getByRole('button', { name: 'العينة العادية' }).click();
  await root.locator('[data-testid="network-baseline-status"][data-state="normal"]').waitFor();
  await root.getByLabel('الفترة الزمنية لتحليل الشبكة').selectOption('1h');
  await root.getByRole('button', { name: 'الحزم', exact: true }).click();
  assert.equal(
    await root.locator('.network-baseline-line').count(),
    0,
    'bandwidth reference is not misapplied to PPS',
  );
  assert.match(await slider.getAttribute('aria-valuetext'), /PPS/);
  await root.getByLabel('الفترة الزمنية لتحليل الشبكة').selectOption('7d');
  assert.equal(
    await root.getByRole('button', { name: 'الحزم', exact: true }).getAttribute('aria-pressed'),
    'true',
    'chart metric survives filter changes',
  );
  await assertMetrics(root, networkView('7d', 'out'), `${where}/week/outbound`);
  assert.equal(await slider.getAttribute('aria-valuemax'), '14');
  await slider.focus();
  await slider.press('Home');
  assert.equal(await slider.getAttribute('aria-valuenow'), '1');
  await slider.press('ArrowRight');
  assert.equal(await slider.getAttribute('aria-valuenow'), '2');
  await slider.press('End');
  assert.equal(await slider.getAttribute('aria-valuenow'), '14');
  // A burst of 80 pointer moves should schedule only one paint-frame update and
  // reuse the static SVG paths rather than rebuilding them per pointer event.
  const burst = await slider.evaluate(async el => {
    const original = window.requestAnimationFrame;
    let requested = 0;
    const path = el.querySelector('.network-chart-line'),
      d = path.getAttribute('d'),
      rect = el.getBoundingClientRect();
    window.requestAnimationFrame = function (callback) {
      requested++;
      return original.call(window, callback);
    };
    try {
      for (let i = 0; i < 80; i++)
        el.dispatchEvent(
          new PointerEvent('pointermove', {
            bubbles: true,
            clientX: rect.left + (rect.width * i) / 79,
            clientY: rect.top + rect.height / 2,
          }),
        );
      await new Promise(resolve => original.call(window, () => original.call(window, resolve)));
      return {
        requested,
        samePath: path === el.querySelector('.network-chart-line'),
        sameData: d === path.getAttribute('d'),
      };
    } finally {
      window.requestAnimationFrame = original;
    }
  });
  assert.ok(
    burst.requested <= 2 && burst.requested >= 1,
    `${where}: frame batching ${JSON.stringify(burst)}`,
  );
  assert.ok(burst.samePath && burst.sameData, `${where}: hover should not rebuild curves`);
  assert.equal(await slider.getAttribute('aria-valuenow'), '14');
  assert.match(await slider.getAttribute('aria-valuetext'), /صادر/);
  assert.doesNotMatch(await slider.getAttribute('aria-valuetext'), /وارد/);
  const tcp = root
    .locator('.network-distribution-group')
    .first()
    .getByRole('button', { name: /TCP/ });
  await tcp.click();
  assert.equal(await tcp.getAttribute('aria-pressed'), 'true');
  assert.match(
    await root.locator('.network-protocols-panel .network-footnote').innerText(),
    /تمييز TCP/,
  );
  await root.getByRole('button', { name: 'اختيار منطقة أوروبا' }).click();
  assert.match(await root.locator('.network-region-selected').innerText(), /أوروبا/);
  assert.equal(
    await root.getByRole('button', { name: 'اختيار منطقة أوروبا' }).getAttribute('aria-pressed'),
    'true',
  );
  const count = networkView('7d', 'out').regions.find(r => r.id === 'europe').count;
  assert.match(
    await root.locator('.network-region-selected').innerText(),
    new RegExp(new Intl.NumberFormat('ar-EG').format(count)),
  );
  await root.getByRole('button', { name: 'محاكاة ارتفاع' }).click();
  await root.locator('[data-testid="network-baseline-status"][data-state="alert"]').waitFor();
  assert.match(
    await root.locator('.network-region-selected').innerText(),
    /أوروبا/,
    'independent map selection survives the traffic scenario',
  );
  await root.getByRole('button', { name: 'العينة العادية' }).click();
  await root.locator('[data-testid="network-baseline-status"][data-state="normal"]').waitFor();
  await root.locator('.network-talker').first().click();
  const drawer = root.locator('.detail-layer-active .drawer');
  await drawer.waitFor();
  await drawer.getByRole('button', { name: 'إغلاق' }).click();
  await drawer.waitFor({ state: 'detached' });
  await root.locator('.network-port').first().click();
  await drawer.waitFor();
  await drawer.getByRole('button', { name: 'إغلاق' }).click();
  await root.locator('.network-definitions summary').click();
  assert.match(
    await root.locator('.network-definitions').innerText(),
    /ترويسة IP ودون ترويسة Ethernet/,
  );
  assert.match(await root.locator('.network-definitions').innerText(), /الأرقام مصنوعة للعرض/);
  const dim = await root
    .locator('.network-metric-value')
    .evaluateAll(els => els.map(el => ({ client: el.clientWidth, scroll: el.scrollWidth })));
  assert.ok(
    dim.every(x => x.scroll <= x.client + 1),
    `${where}: metric values do not overflow ${JSON.stringify(dim)}`,
  );
  const intro = await root.locator('.network-intro>div:nth-child(2)').boundingBox();
  assert.ok(intro.width >= 175, `${where}: introductory copy keeps a readable column`);
  if (frame)
    await frame.waitForFunction(() => document.querySelector('[data-testid="network-active"]'));
}

// Check actual rendered, animated location halos, not just a CSS class.
// The animation is decorative; reduced-motion must leave markers selectable.
async function verifyPulse(map, where) {
  await map.scrollIntoViewIfNeeded();
  const halo = map.locator('.network-map-point span').first();
  await halo.waitFor();
  const picture = await map.screenshot({ animations: 'allow' });
  const stats = await halo.evaluate(async el => {
    const values = [],
      start = performance.now();
    const one = pseudo => {
      const s = getComputedStyle(el, pseudo),
        m = s.transform === 'none' ? new DOMMatrixReadOnly() : new DOMMatrixReadOnly(s.transform);
      return { scale: m.a, opacity: Number(s.opacity), name: s.animationName };
    };
    const sample = () => [one('::before'), one('::after')];
    values.push(sample());
    await new Promise(resolve => {
      const timer = setInterval(() => {
        values.push(sample());
        if (performance.now() - start >= 1100) {
          clearInterval(timer);
          resolve();
        }
      }, 65);
    });
    const span = x => Math.max(...x) - Math.min(...x);
    return [0, 1].map(i => ({
      names: [...new Set(values.map(x => x[i].name))],
      scale: span(values.map(x => x[i].scale)),
      opacity: span(values.map(x => x[i].opacity)),
      unique: new Set(values.map(x => x[i].scale.toFixed(2))).size,
    }));
  });
  assert.ok(
    stats.every(x => x.names.length === 1 && x.names[0] === 'network-region-pulse'),
    `${where}: starts automatically ${JSON.stringify(stats)}`,
  );
  assert.ok(
    stats.some(x => x.scale > 0.25 && x.opacity > 0.1 && x.unique >= 5),
    `${where}: visible pulse must evolve ${JSON.stringify(stats)}`,
  );
  assert.notDeepEqual(
    await map.screenshot({ animations: 'allow' }),
    picture,
    `${where}: pulse changes pixels`,
  );
}
async function verifyReducedPulse(map, where) {
  const name = await map
    .locator('.network-map-point span')
    .first()
    .evaluate(el => getComputedStyle(el, '::before').animationName);
  assert.equal(name, 'none', `${where}: decorative halo respects reduced motion`);
  assert.equal(await map.getByRole('button', { name: 'اختيار منطقة أوروبا' }).count(), 1);
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
    for (const [width, height, theme] of [
      [1440, 900, 'dark'],
      [320, 700, 'light'],
    ]) {
      const run = await newPage(browser, { width, height, theme }),
        { page } = run,
        where = `${name}/${theme}/${width}`;
      try {
        await login(page);
        await page.evaluate(() => document.fonts.ready);
        assert.match(await page.locator('.network-overview-card').innerText(), /مثال مستقل/);
        await exercise(page, page, where);
        await noOverflow(page, where);
        let incomplete = 0;
        for (const state of ['normal', 'spike']) {
          if (state === 'spike') {
            await page.getByRole('button', { name: 'محاكاة ارتفاع' }).click();
            await page
              .locator('[data-testid="network-baseline-status"][data-state="alert"]')
              .waitFor();
          }
          const scan = await new AxeBuilder({ page })
            .include('.network-page')
            .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'])
            .analyze();
          incomplete += scan.incomplete.length;
          assert.deepEqual(
            scan.violations.map(v => ({ id: v.id, targets: v.nodes.map(n => n.target) })),
            [],
            `${where}/${state} focused axe`,
          );
          await noOverflow(page, `${where}/${state}`);
        }
        await page.emulateMedia({ reducedMotion: 'no-preference' });
        await verifyPulse(page.locator('.network-world-map'), where);
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await verifyReducedPulse(page.locator('.network-world-map'), where);
        clean(run);
        console.log(
          `PASS ${where} · baseline, spike/reset, frame batching, map pulse, reduced motion and focused axe (${incomplete} incomplete rules)`,
        );
      } finally {
        await run.context.close();
      }
    }
    // The downloaded single HTML also runs in an opaque sandbox with no network
    // or localStorage; it never sends the simulated data outside the document.
    const context = await browser.newContext({
        viewport: { width: 390, height: 844 },
        reducedMotion: 'no-preference',
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
        '<iframe title="واجهة معزولة" sandbox="allow-scripts" style="width:100%;height:820px;border:0"></iframe>',
      );
      await page.locator('iframe').evaluate(
        (el, html) => {
          el.srcdoc = html;
        },
        fs.readFileSync('dist/index.html', 'utf8'),
      );
      const frame = page.frameLocator('iframe');
      await login(frame);
      await frame.getByRole('button', { name: 'استكشف التحليل' }).click();
      await frame.getByRole('heading', { name: 'تحليل الشبكة', exact: true }).waitFor();
      await assertMetrics(frame, networkView('24h', 'both'), `${name}/offline`);
      await frame.getByLabel('اتجاه حركة الشبكة').selectOption('in');
      await assertMetrics(frame, networkView('24h', 'in'), `${name}/offline/in`);
      await frame.getByRole('button', { name: 'محاكاة ارتفاع' }).click();
      await frame.locator('[data-testid="network-baseline-status"][data-state="alert"]').waitFor();
      await assertMetrics(frame, networkView('24h', 'in', 'spike'), `${name}/offline/spike`);
      await verifyPulse(frame.locator('.network-world-map'), `${name}/offline`);
      await frame.getByRole('button', { name: 'اختيار منطقة أوروبا' }).click();
      assert.match(await frame.locator('.network-region-selected').innerText(), /أوروبا/);
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await verifyReducedPulse(frame.locator('.network-world-map'), `${name}/offline`);
      assert.deepEqual(errors, []);
      assert.deepEqual(requests, []);
      console.log(
        `PASS ${name} · offline opaque iframe, simulated baseline, visible pulses and zero external requests`,
      );
    } finally {
      await context.close();
    }
  } finally {
    await browser.close();
  }
}
// Check layout transitions around responsive breakpoints without relying only
// on the 320px and 1440px end points used above.
{
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  try {
    for (const width of [360, 380, 381, 390, 420, 600, 760, 761, 780, 850, 900, 1100]) {
      const run = await newPage(browser, {
          width,
          height: 800,
          theme: width % 2 ? 'light' : 'dark',
        }),
        { page } = run;
      try {
        await login(page);
        await page.getByRole('button', { name: 'استكشف التحليل' }).click();
        await page.evaluate(() => document.fonts.ready);
        await page.getByRole('button', { name: 'محاكاة ارتفاع' }).click();
        await page.locator('[data-testid="network-baseline-status"][data-state="alert"]').waitFor();
        await noOverflow(page, `${width}px scenario layout`);
        const dims = await page.evaluate(() => {
          const get = s => {
            const r = document.querySelector(s).getBoundingClientRect();
            return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, width: r.width };
          };
          return {
            panel: get('.network-baseline-demo'),
            copy: get('.network-baseline-copy'),
            side: get('.network-baseline-side'),
          };
        });
        assert.ok(
          dims.copy.width >= 150,
          `${width}px copy cannot collapse to a narrow column ${JSON.stringify(dims)}`,
        );
        assert.ok(
          dims.copy.left >= dims.panel.left - 1 && dims.copy.right <= dims.panel.right + 1,
          `${width}px copy stays inside its card`,
        );
        const overlap =
          Math.min(dims.copy.right, dims.side.right) - Math.max(dims.copy.left, dims.side.left) >
            1 &&
          Math.min(dims.copy.bottom, dims.side.bottom) - Math.max(dims.copy.top, dims.side.top) > 1;
        assert.equal(
          overlap,
          false,
          `${width}px controls must not overlap copy ${JSON.stringify(dims)}`,
        );
        clean(run);
      } finally {
        await run.context.close();
      }
    }
    console.log('PASS scenario panel breakpoints, card text and controls');
  } finally {
    await browser.close();
  }
}
console.log('PASS network UI demonstration. Automated checks are not a human accessibility audit.');
