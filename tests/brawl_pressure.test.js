const assert = require('node:assert/strict');
const {Sim} = require('../src/brawl/combat.js');

function setup(defenderHp=65, attackerHp=55) {
  const sim = new Sim({ai:false, mode:'score', seed:7391});
  const defender=sim.fighters[0], attacker=sim.fighters[1];
  defender.x=0;defender.z=0;defender.hp=defenderHp;defender.demoIdle=true;
  attacker.x=1.2;attacker.z=0;attacker.hp=attackerHp;
  for(const f of sim.fighters.slice(2)){f.ko=true;f.hp=0;f.respawn=Infinity;}
  return {sim,defender,attacker};
}
function step(sim,seconds){for(let i=0;i<Math.round(seconds*60);i++)sim.step(1/60);}
function hit(sim,defender,attacker,source='melee'){
  assert.equal(sim.hit(defender,attacker,3,'body',0,false,source),true);
}

{
  const {sim,defender,attacker}=setup();
  step(sim,2);
  assert.equal(sim.drainEvents().some(e=>e.type==='autoPush'),false,'proximity alone must do nothing');
  hit(sim,defender,attacker);step(sim,.6);
  hit(sim,defender,attacker);step(sim,.6);
  assert.equal(sim.drainEvents().some(e=>e.type==='autoPush'),false,'two hits must not push');
  hit(sim,defender,attacker);
  const push=sim.drainEvents().find(e=>e.type==='autoPush');
  assert.deepEqual({strong:push.strong,id:push.id,target:push.target},{strong:false,id:0,target:1});
  assert.equal(attacker.state,'shoved');
  assert.equal(defender.state,'push');
  assert.equal(sim.hit(defender,attacker,3,'body',0,false,'melee'),false,'push gives breathing room');
  step(sim,.4);
  assert.ok(attacker.x>2,'normal push separates the fighters');
}

{
  const {sim,defender,attacker}=setup(95,24);
  for(let i=0;i<3;i++){hit(sim,defender,attacker);if(i<2)step(sim,.6);}
  assert.equal(sim.drainEvents().find(e=>e.type==='autoPush').strong,true);
  assert.equal(attacker.state,'down');
  step(sim,.55);
  assert.equal(sim.action(0,'grab'),true);
  assert.equal(defender.grabTarget,1);
  assert.equal(attacker.state,'groundGrabbed');
  const priorHp=attacker.hp;
  assert.equal(sim.action(0,'grab'),true);
  assert.ok(attacker.hp<priorHp,'ground slam must cause damage');
}

{
  const {sim,defender,attacker}=setup(89,40);
  for(let i=0;i<3;i++){hit(sim,defender,attacker);if(i<2)step(sim,.6);}
  assert.equal(defender.hp,80);
  assert.equal(sim.drainEvents().find(e=>e.type==='autoPush').strong,false,'exactly double HP is not enough');
}

{
  const {sim,defender,attacker}=setup();
  const other=sim.fighters[2];other.ko=false;other.hp=100;other.x=1.2;other.z=0;
  hit(sim,defender,attacker);step(sim,.6);
  hit(sim,defender,attacker);step(sim,.6);
  hit(sim,defender,other);
  assert.equal(sim.drainEvents().some(e=>e.type==='autoPush'),false,'a different aggressor resets pressure');
}

{
  const {sim,defender,attacker}=setup();
  for(let i=0;i<3;i++){hit(sim,defender,attacker,'prop');if(i<2)step(sim,.6);}
  assert.equal(sim.drainEvents().some(e=>e.type==='autoPush'),false,'thrown props do not count as close sustained pressure');
}

{
  const {sim,defender,attacker}=setup();
  for(let i=0;i<3;i++){hit(sim,defender,attacker);step(sim,.6);}
  sim.drainEvents();
  step(sim,.2);
  for(let i=0;i<3;i++){hit(sim,defender,attacker);step(sim,.6);}
  assert.equal(sim.drainEvents().some(e=>e.type==='autoPush'),false,'the cooldown prevents push spam');
}

console.log('Brawl pressure, HP threshold, cooldown, and ground grab passed');
