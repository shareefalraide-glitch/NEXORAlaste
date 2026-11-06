// Notification read/unread state, visible status, explicit actions and counts.
// Standalone and opaque-sandbox UI checks only; no real notification delivery.
import fs from 'node:fs';
import { chromium, firefox, webkit } from 'playwright';
import { assert, builtUrl, login, noOverflow } from '../support/helpers.mjs';

const html = fs.readFileSync('dist/index.html', 'utf8');
const incident = 'حادثة جديدة تحتاج إسنادًا',
  approval = 'طلب احتواء بانتظار المراجعة',
  alert = 'تنبيه مصادقة في العينة';
const digit = ['٠', '١', '٢', '٣'];
const center = root => root.getByRole('region', { name: 'مركز الإشعارات التجريبي' });
const entry = (panel, title) => panel.locator('.notification-entry').filter({ hasText: title });
async function countIs(root, trigger, n, where) {
  const count = root.locator('#notification-unread-count');
  if (n === 0) {
    assert.equal(await count.count(), 0, `${where}: no count when all read`);
    assert.equal(await trigger.getAttribute('aria-describedby'), null);
  } else {
    assert.equal(await count.innerText(), digit[n], `${where}: bell count`);
    assert.equal(await trigger.getAttribute('aria-describedby'), 'notification-unread-count');
  }
  if (await center(root).isVisible())
    assert.match(
      await center(root).locator('.popover-head').innerText(),
      new RegExp(`${digit[n]} غير مقروء`),
      `${where}: panel count`,
    );
}
async function stateIs(panel, title, read, where) {
  const row = entry(panel, title),
    status = read ? 'الحالة: مقروء' : 'الحالة: غير مقروء',
    action = read ? 'تحديد كغير مقروء' : 'تحديد كمقروء';
  assert.equal(await row.count(), 1, `${where}: notification exists`);
  assert.equal(await row.getAttribute('data-read'), String(read), `${where}: underlying state`);
  assert.equal(
    (await row.locator('.notification-status').innerText()).trim(),
    status,
    `${where}: visible current state`,
  );
  assert.equal(
    (await row.locator('.notification-mark').innerText()).trim(),
    action,
    `${where}: separate explicit action`,
  );
  assert.equal(
    await row.getByRole('button', { name: `${action}: ${title}` }).count(),
    1,
    `${where}: named action`,
  );
  assert.match(
    await row.locator('.notification-open').innerText(),
    new RegExp(status),
    `${where}: status belongs to notification`,
  );
  assert.equal(
    await row.getByRole('button', { name: new RegExp(status) }).count(),
    1,
    `${where}: current state is in the open button's accessible name`,
  );
}
async function closeDetails(root) {
  const drawer = root.locator('.detail-layer-active .drawer');
  await drawer.waitFor();
  await drawer.getByRole('button', { name: 'إغلاق' }).click();
  await drawer.waitFor({ state: 'detached' });
}
async function exercise(root, page, where) {
  const trigger = root.getByRole('button', { name: 'الإشعارات التجريبية' });
  await countIs(root, trigger, 2, where);
  await trigger.click();
  let panel = center(root);
  await panel.waitFor();
  await stateIs(panel, incident, false, where);
  await stateIs(panel, approval, false, where);
  await stateIs(panel, alert, true, where);
  // Opening the panel alone does not mark anything read.
  await trigger.click();
  await countIs(root, trigger, 2, where);
  await trigger.click();
  panel = center(root);
  await panel.getByRole('button', { name: 'غير المقروء', exact: true }).click();
  assert.equal(await panel.locator('.notification-entry').count(), 2);
  // Opening one unread item marks that item read, removes it from the unread
  // filter and decrements the badge without changing any other notification.
  const open = entry(panel, incident).locator('.notification-open');
  await open.focus();
  await page.keyboard.press('Enter');
  await closeDetails(root);
  await countIs(root, trigger, 1, where);
  await trigger.click();
  panel = center(root);
  assert.equal(
    await entry(panel, incident).count(),
    0,
    `${where}: opened item leaves unread filter`,
  );
  await stateIs(panel, approval, false, where);
  await panel.getByRole('button', { name: 'الكل', exact: true }).click();
  await stateIs(panel, incident, true, where);
  await stateIs(panel, alert, true, where);
  // Reopening an already-read notification must not toggle it back to unread.
  await entry(panel, incident).locator('.notification-open').click();
  await closeDetails(root);
  await countIs(root, trigger, 1, where);
  await trigger.click();
  panel = center(root);
  await stateIs(panel, incident, true, where);
  // Reverse the state only via an explicitly labelled action; undo it likewise.
  await entry(panel, incident)
    .getByRole('button', { name: `تحديد كغير مقروء: ${incident}` })
    .click();
  assert.equal(
    await root.locator('.detail-layer-active .drawer').count(),
    0,
    `${where}: changing state does not open the record`,
  );
  await stateIs(panel, incident, false, where);
  await countIs(root, trigger, 2, where);
  await entry(panel, incident)
    .getByRole('button', { name: `تحديد كمقروء: ${incident}` })
    .click();
  await stateIs(panel, incident, true, where);
  await countIs(root, trigger, 1, where);
  await panel.getByRole('button', { name: 'تمييز الكل كمقروء' }).click();
  await countIs(root, trigger, 0, where);
  for (const title of [incident, approval, alert]) await stateIs(panel, title, true, where);
  assert.equal(await panel.getByRole('button', { name: 'تمييز الكل كمقروء' }).isDisabled(), true);
  // A deliberate mark-unread action reintroduces exactly that item.
  await entry(panel, alert)
    .getByRole('button', { name: `تحديد كغير مقروء: ${alert}` })
    .click();
  await countIs(root, trigger, 1, where);
  await panel.getByRole('button', { name: 'غير المقروء', exact: true }).click();
  assert.equal(await panel.locator('.notification-entry').count(), 1);
  await stateIs(panel, alert, false, where);
  await entry(panel, alert)
    .getByRole('button', { name: `تحديد كمقروء: ${alert}` })
    .focus();
  await page.keyboard.press('Enter');
  assert.match(await panel.innerText(), /لا توجد إشعارات/);
  await countIs(root, trigger, 0, where);
}
async function inspectLayout(root, page, where) {
  const trigger = root.getByRole('button', { name: 'الإشعارات التجريبية' });
  if ((await trigger.getAttribute('aria-expanded')) !== 'true') await trigger.click();
  const result = await center(root).evaluate(el => {
    const panel = el.getBoundingClientRect(),
      list = el.querySelector('.notification-list');
    const actions = [...el.querySelectorAll('.notification-mark')].map(b => {
      const r = b.getBoundingClientRect();
      return { width: r.width, height: r.height, left: r.left, right: r.right };
    });
    return {
      left: panel.left,
      right: panel.right,
      screen: innerWidth,
      client: el.clientWidth,
      scroll: el.scrollWidth,
      listClient: list.clientWidth,
      listScroll: list.scrollWidth,
      actions,
    };
  });
  assert.ok(
    result.left >= -1 && result.right <= result.screen + 1,
    `${where}: panel fits ${JSON.stringify(result)}`,
  );
  assert.ok(
    result.scroll <= result.client + 1 && result.listScroll <= result.listClient + 1,
    `${where}: no horizontal popover overflow ${JSON.stringify(result)}`,
  );
  assert.ok(
    result.actions.every(
      a => a.height >= 44 && a.left >= result.left - 1 && a.right <= result.right + 1,
    ),
    `${where}: action target fits ${JSON.stringify(result)}`,
  );
  if (root === page) await noOverflow(page, where);
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
    const combinations =
      name === 'Chromium'
        ? [
            ['dark', 1440],
            ['dark', 320],
            ['light', 1440],
            ['light', 320],
          ]
        : [
            ['dark', 1440],
            ['light', 320],
          ];
    for (const [theme, width] of combinations) {
      const context = await browser.newContext({
          viewport: { width, height: width === 320 ? 700 : 900 },
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
        await context.route(/^https?:\/\//, route => {
          external.push(route.request().url());
          return route.abort();
        });
        await page.goto(builtUrl);
        await login(page);
        if (theme === 'light')
          await page.getByRole('button', { name: 'تفعيل المظهر الفاتح' }).click();
        await exercise(page, page, `${name}/${theme}/${width}`);
        await center(page).getByRole('button', { name: 'الكل', exact: true }).click();
        await inspectLayout(page, page, `${name}/${theme}/${width}`);
        if (name === 'Chromium' && theme === 'dark' && width === 1440) {
          // State is deliberately session-only; a reload resets the sample.
          await page.reload();
          await login(page);
          const trigger = page.getByRole('button', { name: 'الإشعارات التجريبية' });
          await countIs(page, trigger, 2, 'reload');
          await trigger.click();
          await stateIs(center(page), incident, false, 'reload');
          await stateIs(center(page), alert, true, 'reload');
          await entry(center(page), incident)
            .getByRole('button', { name: `تحديد كمقروء: ${incident}` })
            .click();
          await countIs(page, trigger, 1, 'before logout');
          await trigger.click();
          await page.getByRole('button', { name: 'قائمة الحساب' }).click();
          await page.getByRole('button', { name: 'تسجيل الخروج التجريبي' }).click();
          await login(page);
          await countIs(page, trigger, 2, 'logout reset');
          await trigger.click();
          await stateIs(center(page), incident, false, 'logout reset');
        }
        assert.deepEqual(errors, []);
        assert.deepEqual(external, []);
        console.log(
          `PASS ${name} · ${theme} · ${width}px · read status, counts, actions and repeat open`,
        );
      } finally {
        await context.close();
      }
    }
    const context = await browser.newContext({
        viewport: { width: 390, height: 844 },
        reducedMotion: 'reduce',
      }),
      errors = [],
      external = [];
    try {
      const page = await context.newPage();
      page.on('pageerror', e => errors.push(e.message));
      await context.route(/^https?:\/\//, route => {
        external.push(route.request().url());
        return route.abort();
      });
      await page.setContent(
        '<iframe title="isolated demo" sandbox="allow-scripts" style="width:100%;height:820px;border:0"></iframe>',
      );
      await page.locator('iframe').evaluate((el, src) => {
        el.srcdoc = src;
      }, html);
      const frame = page.frameLocator('iframe');
      await login(frame);
      await exercise(frame, page, `${name}/sandbox`);
      await center(frame).getByRole('button', { name: 'الكل', exact: true }).click();
      await inspectLayout(frame, page, `${name}/sandbox`);
      assert.deepEqual(errors, []);
      assert.deepEqual(external, []);
      console.log(`PASS ${name} · offline sandbox · correct notification transitions`);
    } finally {
      await context.close();
    }
  } finally {
    await browser.close();
  }
}

// On short phones the list scrolls inside the popup while the bulk action
// stays reachable; the last item's own action must also remain usable.
const shortBrowser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
try {
  const page = await shortBrowser.newPage({
    viewport: { width: 320, height: 400 },
    reducedMotion: 'reduce',
  });
  await page.goto(builtUrl);
  await login(page);
  await page.getByRole('button', { name: 'الإشعارات التجريبية' }).click();
  const panel = center(page);
  const dimensions = await panel.evaluate(el => {
    const r = el.getBoundingClientRect(),
      list = el.querySelector('.notification-list'),
      foot = el.querySelector('.notification-read-all').getBoundingClientRect();
    return {
      top: r.top,
      bottom: r.bottom,
      panelClient: el.clientHeight,
      panelScroll: el.scrollHeight,
      listClient: list.clientHeight,
      listScroll: list.scrollHeight,
      footerBottom: foot.bottom,
      height: innerHeight,
    };
  });
  assert.ok(
    dimensions.panelScroll <= dimensions.panelClient + 1 &&
      dimensions.listScroll > dimensions.listClient &&
      dimensions.footerBottom < dimensions.height,
    `short viewport single inner scroll: ${JSON.stringify(dimensions)}`,
  );
  await entry(panel, alert)
    .getByRole('button', { name: `تحديد كغير مقروء: ${alert}` })
    .click();
  await stateIs(panel, alert, false, 'short phone');
  console.log('PASS short phone · scrollable list and persistent bulk action');
} finally {
  await shortBrowser.close();
}

// A notification generated by a local demo action also starts unread, then
// becomes read when opened. No server or push delivery is involved.
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
    reducedMotion: 'reduce',
  });
  await page.goto(builtUrl);
  await login(page);
  const trigger = page.getByRole('button', { name: 'الإشعارات التجريبية' });
  await trigger.click();
  await center(page).getByRole('button', { name: 'تمييز الكل كمقروء' }).click();
  await trigger.click();
  await page.locator('.attention-approval button').click();
  const review = page.getByRole('dialog', { name: 'مراجعة طلب الاحتواء' });
  await review.getByLabel('إعادة للتعديل').check();
  await review.getByLabel('سبب الإعادة للتعديل').fill('سبب تجريبي');
  await review.getByRole('checkbox').check();
  await review.getByRole('button', { name: 'تسجيل الإعادة للتعديل' }).click();
  await countIs(page, trigger, 1, 'new local notification');
  await trigger.click();
  const panel = center(page),
    title = 'تحديث طلب احتواء: أعيد للتعديل';
  await stateIs(panel, title, false, 'new local notification');
  await entry(panel, title).locator('.notification-open').click();
  await closeDetails(page);
  await countIs(page, trigger, 0, 'opened local notification');
  await trigger.click();
  await stateIs(center(page), title, true, 'opened local notification');
  console.log('PASS locally generated notice starts unread and becomes read on open');
} finally {
  await browser.close();
}
console.log(
  'PASS notification status, filter, action, keyboard and session checks; UI sample only.',
);
