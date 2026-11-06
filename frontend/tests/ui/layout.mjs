// Overview banner/guide spacing, including the dismissed-guide state. This is
// a focused visual-layout regression, not an accessibility certification.
import { chromium, firefox, webkit } from 'playwright';
import { assert, newPage, login, noOverflow, clean } from '../support/helpers.mjs';

async function checkGap(page, following, where) {
  const info = await page.evaluate(selector => {
    const hero = document.querySelector('.overview-hero'),
      next = document.querySelector(selector),
      role = document.querySelector('.role-focus');
    const a = hero.getBoundingClientRect(),
      b = next.getBoundingClientRect();
    return {
      adjacent: hero.nextElementSibling === next,
      gap: b.top - a.bottom,
      heroMargin: getComputedStyle(hero).marginBlockEnd,
      leftDifference: Math.abs(a.left - b.left),
      rightDifference: Math.abs(a.right - b.right),
      following: next.className,
      roleExists: Boolean(role),
      scroll: document.documentElement.scrollWidth,
      client: document.documentElement.clientWidth,
    };
  }, following);
  assert.ok(
    info.adjacent && Math.abs(info.gap - 15) < 0.75 && info.heroMargin === '15px',
    `${where}: consistent visible gap ${JSON.stringify(info)}`,
  );
  assert.ok(
    info.leftDifference < 1 && info.rightDifference < 1 && info.roleExists,
    `${where}: cards remain aligned ${JSON.stringify(info)}`,
  );
  await noOverflow(page, where);
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
    for (const theme of ['dark', 'light'])
      for (const [width, height] of [
        [1440, 900],
        [390, 844],
        [320, 600],
      ]) {
        const run = await newPage(browser, { width, height, theme }),
          { page } = run,
          where = `${name}/${theme}/${width}x${height}`;
        try {
          await login(page);
          await page.evaluate(() => document.fonts.ready);
          await page.locator('.start-guide').waitFor();
          await checkGap(page, '.start-guide', `${where}/guide visible`);
          await page.getByRole('button', { name: 'إخفاء بطاقة الدليل' }).click();
          await page.locator('.start-guide').waitFor({ state: 'detached' });
          const persisted = await page.evaluate(() =>
            JSON.parse(localStorage.getItem('nexora-ui-guide') || 'null'),
          );
          assert.equal(
            persisted?.visible,
            false,
            `${where}: dismissal is stored before a quick reload`,
          );
          await checkGap(page, '.role-focus', `${where}/guide dismissed`);
          await page.reload();
          await login(page);
          assert.equal(
            await page.locator('.start-guide').count(),
            0,
            `${where}: dismissal persists on reload`,
          );
          await checkGap(page, '.role-focus', `${where}/after reload`);
          clean(run);
          console.log(`PASS overview spacing with and without the guide · ${where}`);
        } finally {
          await run.context.close();
        }
      }
  } finally {
    await browser.close();
  }
}
console.log('PASS overview spacing across themes, layouts and three browser engines.');
