const assert = require('node:assert/strict');
const path = require('node:path');
require(path.join(__dirname, '..', 'src', 'brawl', 'combat.js'));
require(path.join(__dirname, '..', 'src', 'brawl', 'boss.js'));

const frames = (sim, count) => {
  const events = [];
  for (let i = 0; i < count; i++) {
    sim.step(1 / 60);
    events.push(...sim.drainEvents());
  }
  return events;
};

for (const mode of ['last', 'score', 'crown']) {
  const sim = new BrawlSim.Sim({mode, selected:0, ai:false, seed:719});
  sim.fighters[1].ko = true;
  sim.fighters[2].hp = 17;
  sim.finish(0);
  assert.equal(sim.boss.phase, 'arrival', mode);
  assert.equal(sim.finished, false, mode);
  assert(sim.fighters.every(f => f.hp === 100 && !f.ko), mode);
  const arrival = frames(sim, 290);
  assert(arrival.some(e => e.type === 'bossLand'), mode);
  assert.equal(arrival.filter(e => e.type === 'bossRevive').length, 4, mode);
  assert.equal(sim.boss.phase, 'battle', mode);
  assert(sim.fighters.every(f => f.hp === 100), mode);
}

const win = new BrawlSim.Sim({selected:0, ai:false, seed:19});
win.finish(0);frames(win, 290);
for (const f of win.fighters.slice(1)) f.weaponCooldown = 1000;
let lastTier = -1;
for (let tier = 0; tier < 4; tier++) {
  assert.equal(win.boss.tier, tier);
  assert.equal(win.boss.phase, 'battle');
  win.fighters[0].weaponCooldown = 0;
  win.boss.hp = 11;
  assert(win.action(0, 'punch'));
  assert.equal(win.boss.phase, tier < 3 ? 'resurrect' : 'dead');
  if (tier < 3) {
    assert.equal(win.action(0, 'punch'), false, 'invulnerable while rebuilding');
    const rebuilding = frames(win, 212);
    assert(rebuilding.some(e => e.type === 'bossRebuild'));
    assert(rebuilding.some(e => e.type === 'bossResurrected'));
    assert.equal(win.boss.tier, tier + 1);
    assert(win.boss.hp > 0);
  }
  lastTier = tier;
}
assert.equal(lastTier, 3);
frames(win, 200);
assert.equal(win.finished, true);
assert.equal(win.bossOutcome, 'crew');

const claw = new BrawlSim.Sim({selected:0, ai:false, seed:29});
claw.beginBoss(0);frames(claw, 290);
for (const f of claw.fighters.slice(1)) f.weaponCooldown = 1000;
const victim = claw.fighters[0];
victim.x = 0;victim.z = 2.0;victim.inv = 0;
claw.boss.attack = 'claw';claw.boss.attackAge = 0;claw.boss.targetIds = [0];
frames(claw, 35);
assert.equal(victim.state, 'bossGrabbed', 'claw can grab a standing fighter');
frames(claw, 43);
assert(victim.hp < 100, 'claw throw causes damage');
assert.equal(victim.grabbedBy, null);

const loss = new BrawlSim.Sim({selected:0, ai:false, seed:39});
loss.beginBoss(0);frames(loss, 290);
for (const f of loss.fighters) { f.inv = 0;loss.bossHitPlayer(f, 100); }
frames(loss, 1);
assert.equal(loss.boss.phase, 'laugh');
frames(loss, 210);
assert.equal(loss.bossOutcome, 'boss');
assert(loss.fighters.every(f => f.ko && f.hp === 0), 'boss KOs never respawn');

// A player who never joins the firefight cannot rely on the allies to win it.
const idle = new BrawlSim.Sim({selected:0, ai:false, seed:7391});
idle.finish(0);
frames(idle, 60 * 120);
assert.equal(idle.bossOutcome, 'boss');
assert(idle.fighters.every(f => f.ko));
assert(idle.boss.stride > 20, 'boss must actually travel around the arena');
assert(idle.boss.chaseTime / idle.boss.battleTime > .6, 'boss pursues for most of combat');
assert(idle.boss.chaseTime / idle.boss.battleTime < .95, 'boss has readable attack and aim pauses');

// The player can finish all four stages by contributing sustained laser fire.
const active = new BrawlSim.Sim({selected:0, ai:false, seed:7391});
active.finish(0);
for (let i=0; i<60*120 && !active.finished; i++) {
  if (active.boss.phase==='battle') active.action(0,'punch');
  active.step(1/60);active.drainEvents();
}
assert.equal(active.bossOutcome, 'crew');
assert(active.fighters[0].bossDamage > 500);

console.log('Boss transition, crew revival, four stages, three animated rebuilds, standing claw grab, permanent KOs and both endings passed.');
