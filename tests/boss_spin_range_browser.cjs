const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '..');
const before = process.argv.includes('--before');
const urlIndex = process.argv.indexOf('--url');
const targetUrl = urlIndex < 0 ? pathToFileURL(path.join(root, 'brawl.html')).href : process.argv[urlIndex + 1];
const output = path.join(root, '.qa-run', 'boss-spin-range');
require('node:fs').mkdirSync(output, { recursive: true });

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const report = [];
  try {
    for (const [name, viewport, mobile] of [
      ['portrait', { width: 430, height: 932 }, true],
      ['small', { width: 360, height: 780 }, true],
      ['landscape', { width: 844, height: 390 }, true],
      ['desktop', { width: 1280, height: 800 }, false],
    ]) {
      const context = await browser.newContext({ viewport, isMobile: mobile, hasTouch: mobile });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(String(error)));
      await page.goto(targetUrl);
      await page.waitForFunction(() => window.brawl?.state === 'menu');
      await page.evaluate(() => {
        brawl.start({ instant: true, ai: false, seed: 7391, selected: 0, mode: 'score' });
        brawl.audio.muted = true;
        brawl.testFrozen = true;
        const s = brawl.sim, p = s.fighters[0], q = s.fighters[1];
        p.x = 0; p.z = 0; q.x = 1.3; q.z = 0;
        s.fighters[2].x = 8; s.fighters[3].x = -8;
        s.dizzy(q, 2.5); q.inv = 0;
        brawl.scene.render(s, 0, 'playing'); brawl.updateHUD(); brawl.worldHUD(0);
      });
      if (!before) {
        await page.evaluate(() => {
          brawl.sim.fighters[1].x = 6;
          brawl.scene.render(brawl.sim, 0, 'playing'); brawl.updateHUD(); brawl.worldHUD(0);
        });
        assert.equal(await page.locator('.combat.grab').getAttribute('data-action'), 'spin');
        assert(await page.locator('.combat.grab').evaluate(e => e.classList.contains('unavailable')),
          'Spin is shown but unavailable until the player approaches the dizzy enemy');
        await page.evaluate(() => {
          brawl.sim.fighters[1].x = 1.3;
          brawl.scene.render(brawl.sim, 0, 'playing'); brawl.updateHUD(); brawl.worldHUD(0);
        });
      }
      await page.screenshot({ path: path.join(output, `${before ? 'before' : 'after'}-spin-${name}.png`) });
      const action = await page.locator('.combat.grab').getAttribute('data-action');
      if (!before) {
        assert.equal(action, 'spin', 'dizzy target changes the fixed button to Spin');
        if (mobile) await page.locator('.combat.grab').tap();
        else await page.locator('.combat.grab').click();
        assert.equal(await page.evaluate(() => brawl.sim.fighters[0].spinGrabTarget), 1);
        await page.evaluate(() => {
          for (let i = 0; i < 40; i++) brawl.sim.step(1 / 60);
          brawl.events(); brawl.scene.render(brawl.sim, 0, 'playing'); brawl.updateHUD(); brawl.worldHUD(0);
        });
        assert.equal(await page.evaluate(() => brawl.sim.fighters[0].state), 'spin');
        await page.screenshot({ path: path.join(output, `after-spin-action-${name}.png`) });
        await page.evaluate(() => {
          const s = brawl.sim, p = s.fighters[0], q = s.fighters[1], item = s.items[0];
          s.state(p, 'idle'); p.held = null; q.x = 7; q.z = 0;
          item.x = p.x + .5; item.z = p.z; item.y = 0;
          item.held = null; item.flying = false; item.broken = false; item.slipUntil = 0;
          brawl.scene.render(s, 0, 'playing'); brawl.updateHUD(); brawl.worldHUD(0);
        });
        if (mobile) await page.locator('[data-action="pick"]').tap();
        else await page.locator('[data-action="pick"]').click();
        assert.notEqual(await page.evaluate(() => brawl.sim.fighters[0].held), null);
        await page.evaluate(() => {
          for (let i = 0; i < 20; i++) brawl.sim.step(1 / 60);
          brawl.scene.render(brawl.sim, 0, 'playing'); brawl.updateHUD(); brawl.worldHUD(0);
        });
        if (mobile) await page.locator('[data-action="pick"]').tap();
        else await page.locator('[data-action="pick"]').click();
        await page.evaluate(() => { for (let i = 0; i < 15; i++) brawl.sim.step(1 / 60); });
        const itemState = await page.evaluate(() => ({ flying: brawl.sim.items[0].flying,
          held: brawl.sim.fighters[0].held, state: brawl.sim.fighters[0].state,
          item: brawl.sim.items[0].type, y: brawl.sim.items[0].y }));
        assert(itemState.flying, `Pick Up and Throw still work: ${JSON.stringify(itemState)}`);
      }
      console.log(`${name} normal action: ${action}`);

      await page.evaluate(() => {
        const s = brawl.sim;
        s.beginBoss(0);
        for (let i = 0; i < 290; i++) s.step(1 / 60);
        s.drainEvents();
        s.boss.x = 0; s.boss.z = 0; s.boss.yaw = Math.PI;
        const p = s.fighters[0];
        p.x = 11.2; p.z = 0; p.y = 0; p.yaw = -Math.PI / 2;
        s.fighters.slice(1).forEach(f => { f.weaponCooldown = 1000; });
        brawl.scene.effects = [];
        for (const pop of brawl.pops) pop.n.remove();
        brawl.pops = []; brawl.toastUntil = 0;
        document.querySelector('#toast').classList.remove('on');
        brawl.scene.render(s, 0, 'playing'); brawl.updateHUD(); brawl.worldHUD(0);
      });
      const laser = await page.evaluate(() => {
        const s = brawl.sim, hp = s.boss.hp;
        s.bossFire(s.fighters[0], false);
        const event = s.drainEvents().find(e => e.type === 'laserShot');
        brawl.scene.onEvent(event, s);
        brawl.scene.render(s, 0, 'playing'); brawl.updateHUD(); brawl.worldHUD(0);
        return { before: hp, after: s.boss.hp, event };
      });
      await page.screenshot({ path: path.join(output, `${before ? 'before' : 'after'}-range-${name}.png`) });
      if (!before) {
        assert.equal(laser.after, laser.before, 'edge shot cannot damage boss');
        assert.equal(laser.event.outOfRange, true);
        assert(Math.abs(Math.hypot(laser.event.toX - laser.event.x, laser.event.toZ - laser.event.z) - 7.5) < .001);
      }
      const pacing = await page.evaluate(() => new Promise(resolve => {
        const times = []; let started = 0, last = 0;
        function tick(now) {
          if (!started) started = now;
          if (last) times.push(now - last);
          last = now;
          if (now - started < 1200) return requestAnimationFrame(tick);
          const sorted = [...times].sort((a, b) => a - b), r = brawl.scene.R;
          const gl = r.gl, ext = gl.getExtension('WEBGL_debug_renderer_info');
          resolve({ samples: times.length, p95Ms: sorted[Math.floor(sorted.length * .95)],
            over33Ms: times.filter(t => t > 33.3).length, draws: r.draws, triangles: r.tris,
            renderer: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER) });
        }
        requestAnimationFrame(tick);
      }));
      report.push({ name, viewport, action, laser, pacing, errors });
      if (!before && ['portrait', 'desktop'].includes(name)) {
        await page.evaluate(() => {
          const s = brawl.sim, f = s.fighters[0], b = s.boss;
          f.x = 0; f.z = 2; f.y = 0; f.inv = 0; f.vx = f.vz = f.vy = 0;
          b.x = 0; b.z = 0; b.yaw = Math.PI;
          b.attack = 'claw'; b.attackAge = 0; b.targetIds = [0]; b.grabbed = null;
          brawl.scene.effects = []; brawl.pops = [];
          for (let i = 0; i < 35; i++) s.step(1 / 60);
          brawl.events(); brawl.scene.render(s, 0, 'playing'); brawl.updateHUD(); brawl.worldHUD(0);
        });
        assert.equal(await page.evaluate(() => brawl.sim.fighters[0].state), 'bossGrabbed');
        await page.screenshot({ path: path.join(output, `after-claw-grab-${name}.png`) });
        await page.evaluate(() => {
          for (let i = 0; i < 43; i++) brawl.sim.step(1 / 60);
          brawl.events(); brawl.scene.render(brawl.sim, 0, 'playing'); brawl.updateHUD(); brawl.worldHUD(0);
        });
        assert.equal(await page.evaluate(() => brawl.sim.fighters[0].state), 'bossThrown');
        await page.evaluate(() => {
          for (let i = 0; i < 22; i++) brawl.sim.step(1 / 60);
          brawl.events(); brawl.scene.render(brawl.sim, 0, 'playing'); brawl.updateHUD(); brawl.worldHUD(0);
        });
        assert(await page.evaluate(() => brawl.sim.fighters[0].y > 1));
        await page.screenshot({ path: path.join(output, `after-claw-flight-${name}.png`) });
      }
      assert.deepEqual(errors, []);
      console.log(`${name} edge laser: ${JSON.stringify(laser)} pacing=${pacing.p95Ms.toFixed(1)}ms draws=${pacing.draws} triangles=${pacing.triangles}`);
      await context.close();
    }
    require('node:fs').writeFileSync(path.join(output, `${before ? 'before' : 'after'}-report.json`), JSON.stringify(report, null, 2));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
