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
const throwOrigin={x:victim.x,z:victim.z};
claw.boss.attack = 'claw';claw.boss.attackAge = 0;claw.boss.targetIds = [0];
frames(claw, 35);
assert.equal(victim.state, 'bossGrabbed', 'claw can grab a standing fighter');
assert(frames(claw, 43).some(e=>e.type==='bossThrow'),'claw visibly releases its victim');
assert(victim.hp < 100, 'claw throw causes damage');
assert.equal(victim.grabbedBy, null);
assert.equal(victim.state,'bossThrown','surviving victim stays in the airborne throw pose');
claw.boss.phase = 'resurrect';
claw.boss.age = 0;
assert(frames(claw, 65).some(e=>e.type==='bossThrowLand'),'long claw throw lands with an impact');
assert(victim.y < .01, 'a thrown survivor lands instead of hovering');
assert(Math.hypot(victim.x-throwOrigin.x,victim.z-throwOrigin.z)>5,
  'the claw sends a fighter across the arena');
assert(['down','getup'].includes(victim.state),'landing has a recovery pose');
frames(claw,80);
assert.equal(victim.state,'idle','the fighter can recover after landing');

// AI companions support the selected player without clearing the boss phases for them.
const pressure = new BrawlSim.Sim({selected:0, ai:false, seed:7391});
pressure.finish(0);
frames(pressure, 60 * 30);
assert(pressure.fighters.slice(1).reduce((sum, f) => sum + f.bossDamage, 0) < 400,
  'allied laser damage must leave the player a meaningful part of the fight');

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

// A player who moves around cover and dodges telegraphed strikes can finish.
const active = new BrawlSim.Sim({selected:0, ai:false, seed:7391});
active.finish(0);
for (let i=0; i<60*120 && !active.finished; i++) {
  if (active.boss.phase==='battle'&&!active.fighters[0].ko) {
    const p=active.fighters[0],b=active.boss,angle=active.time*.5;
    const goal={x:b.x+Math.sin(angle)*6.5,z:b.z+Math.cos(angle)*6.5};
    const dx=goal.x-p.x,dz=goal.z-p.z,m=Math.hypot(dx,dz)||1;
    active.moveInput(dx/m,dz/m);
    if (b.attack==='charge'&&b.attackAge>.6||b.attack==='slamWind'&&b.attackAge>.45||b.attack==='claw'&&b.attackAge>.28)
      active.action(0,'dodge',{x:dx/m,z:dz/m});
    active.action(0,'punch');
  }
  active.step(1/60);active.drainEvents();
}
assert.equal(active.bossOutcome, 'crew');
assert(active.fighters[0].bossDamage > 500);

// Raised ground is accessible via its ramp; armor breaks fire both ways.
const tactical = new BrawlSim.Sim({selected:0, ai:false, seed:17});
tactical.beginBoss(0);frames(tactical,290);
for(const ally of tactical.fighters.slice(1))ally.weaponCooldown=1000;
const shooter=tactical.fighters[0];
shooter.x=8.3;shooter.z=4.5;
let topY=0;
for(let i=0;i<115;i++){tactical.moveInput(0,-1);tactical.step(1/60);tactical.drainEvents();topY=Math.max(topY,shooter.y);}
assert(topY>.95,'the ramp reaches walkable high ground');
shooter.x=-5.8;shooter.z=-1.7;shooter.y=0;shooter.weaponCooldown=0;
tactical.boss.x=-2;tactical.boss.z=-1.7;
const armoredHp=tactical.boss.hp;
tactical.action(0,'punch');
assert.equal(tactical.boss.hp,armoredHp,'cover blocks player lasers');
tactical.boss.x=0;tactical.boss.z=-1.7;tactical.boss.yaw=Math.PI/2;
tactical.boss.targetIds=[0];tactical.boss.targetPoints=[{x:shooter.x,z:shooter.z}];
shooter.inv=0;const shelteredHp=shooter.hp;
tactical.bossBeam(0);
assert.equal(shooter.hp,shelteredHp,'cover also blocks the boss cannon');
tactical.boss.x=0;tactical.boss.z=0;
shooter.x=0;shooter.z=4.5;
const exposedHp=tactical.boss.hp;shooter.weaponCooldown=0;
tactical.action(0,'punch');
assert(tactical.boss.hp<exposedHp,'an exposed firing lane works');
shooter.x=tactical.bounds.x-.1;shooter.z=0;tactical.boss.x=0;tactical.boss.z=0;
const edgeHp=tactical.boss.hp,edgeDistance=Math.hypot(shooter.x-tactical.boss.x,shooter.z-tactical.boss.z);
shooter.weaponCooldown=0;tactical.action(0,'punch');
const farShot=tactical.drainEvents().findLast(e=>e.type==='laserShot'&&e.id===0);
assert(edgeDistance>BrawlSim.BOSS_LASER_RANGE);
assert.equal(tactical.boss.hp,edgeHp,'edge-of-map player fire has no damage');
assert.equal(farShot.outOfRange,true);
assert(Math.abs(Math.hypot(farShot.toX-farShot.x,farShot.toZ-farShot.z)-BrawlSim.BOSS_LASER_RANGE)<.001,
  'the visible beam stops at the same range as gameplay damage');

const quake=new BrawlSim.Sim({selected:0,ai:false,seed:23});
quake.beginBoss(0);frames(quake,290);
quake.boss.x=0;quake.boss.z=0;quake.boss.attack='slamWind';quake.boss.attackAge=.86;
const floorTarget=quake.fighters[0],raisedTarget=quake.fighters[1];
floorTarget.x=2.5;floorTarget.z=0;floorTarget.y=0;floorTarget.inv=0;
raisedTarget.x=8.3;raisedTarget.z=-1.5;raisedTarget.y=1.05;raisedTarget.inv=0;
const quakeEvents=frames(quake,2);
assert(quakeEvents.some(e=>e.type==='bossSlam'),'ground smash has a real impact event');
assert(floorTarget.hp<100,'nearby ground-level players take shockwave damage');
assert.equal(raisedTarget.hp,100,'the raised deck protects from the shockwave');

// The physical front shield catches crew lasers for ten seconds. Its back
// remains a weak side and the cooldown starts when deployment begins.
const shield=new BrawlSim.Sim({selected:0,ai:false,seed:51});
shield.beginBoss(0);frames(shield,290);
for(const f of shield.fighters){f.inv=1000;f.weaponCooldown=1000;}
const guard=shield.boss,gunner=shield.fighters[0];
guard.x=0;guard.z=0;guard.yaw=Math.PI;guard.shieldPhase='active';guard.shieldAge=0;
gunner.x=0;gunner.z=4;gunner.weaponCooldown=0;
const guardedHp=guard.hp;
shield.bossFire(gunner,true);
const blockedShot=shield.drainEvents().findLast(e=>e.type==='laserShot');
assert.equal(guard.hp,guardedHp,'front shield prevents projectile damage');
assert.equal(blockedShot.shieldBlock,true,'the shot reports a shield impact');
gunner.z=-4;shield.bossFire(gunner,false);
assert(guard.hp<guardedHp,'rear projectiles still damage the boss');
guard.shieldPhase='deploy';guard.shieldAge=0;guard.shieldReadyAt=shield.time+60;
guard.shieldPressure=0;guard.battleTime=5;guard.cooldown=1000;guard.attack='idle';
let deployFrames=0;
while(guard.shieldPhase==='deploy'&&deployFrames<60){frames(shield,1);deployFrames++;}
assert.equal(guard.shieldPhase,'active');
assert(deployFrames>=48&&deployFrames<=49,'the shield has a visible deployment window');
guard.cooldown=0;
let shieldAttacks=new Set(),shieldEvents=[],activeFrames=0;
while(guard.shieldPhase==='active'&&shieldAttacks.size<10){
 shield.step(1/60);activeFrames++;shieldEvents.push(...shield.drainEvents());shieldAttacks.add(guard.attack);
}
assert.equal(guard.shieldPhase,'retract','protection ends after ten seconds');
assert(activeFrames>=600&&activeFrames<=601,'active shield duration is ten seconds');
assert(shieldEvents.some(e=>e.type==='bossLaser'),'the cannon fires while shielding');
assert(!shieldAttacks.has('claw')&&!shieldAttacks.has('slamWind')&&!shieldAttacks.has('slamImpact'),
 'sword, grab and ground smash stay disabled while shielding');
assert(shield.time<guard.shieldReadyAt,'shield is still cooling after retraction');
guard.shieldPhase='stowed';guard.shieldAge=0;guard.attack='idle';guard.cooldown=0;
guard.shieldPressure=100;shield.time=guard.shieldReadyAt-2/60;
frames(shield,1);
assert.equal(guard.shieldPhase,'stowed','shield cannot redeploy before one minute');
guard.attack='idle';guard.cooldown=0;frames(shield,2);
assert.equal(guard.shieldPhase,'deploy','shield becomes available at the one-minute mark');

console.log('Boss revival, four stages, landing physics, ally balance, cover, high ground, shield timing and cannon-only guard, pursuit and both endings passed.');
