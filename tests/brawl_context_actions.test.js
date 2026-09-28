const assert = require('node:assert/strict');
const {Sim} = require('../src/brawl/combat.js');

function setup(){
  const s=new Sim({ai:false,mode:'score',seed:7391});
  const p=s.fighters[0],q=s.fighters[1];
  p.x=0;p.z=0;q.x=1.25;q.z=0;q.demoIdle=true;q.pushCooldown=Infinity;
  for(const f of s.fighters.slice(2)){f.ko=true;f.hp=0;f.respawn=Infinity;}
  return {s,p,q};
}
function step(s,seconds){for(let i=0;i<Math.round(seconds*60);i++)s.step(1/60);}
function connect(s,p,q,type){
  p.state=type;p.attackHit=true;
  q.inv=0;
  assert.equal(s.hit(q,p,type==='kick'?8:5,type==='kick'?'leg':'head',0,false,'melee'),true);
  p.state='idle';
}

{
  const {s,p,q}=setup();
  assert.equal(s.action(0,'heavy'),false,'Heavy cannot be used before a combo');
  connect(s,p,q,'punch');connect(s,p,q,'kick');
  assert.equal(p.comboReady,null);
  connect(s,p,q,'punch');
  assert.equal(p.comboReady,'heavy','two punches make Heavy Punch');
  assert.ok(p.comboUntil-s.time>=3);
  assert.equal(s.action(0,'punch'),true);
  assert.equal(p.state,'heavy');
  assert.equal(p.comboReady,null,'the upgraded strike is consumed once');
}
{
  const {s,p,q}=setup();
  connect(s,p,q,'punch');connect(s,p,q,'punch');connect(s,p,q,'punch');
  p.stamina=12;
  assert.equal(s.action(0,'punch'),true,'basic punch remains usable if Heavy lacks stamina');
  assert.equal(p.state,'punch');
  assert.equal(p.comboReady,'heavy');
}
{
  const {s,p,q}=setup();
  connect(s,p,q,'kick');connect(s,p,q,'punch');connect(s,p,q,'kick');
  assert.equal(p.comboReady,'heavyKick','two kicks make Heavy Kick');
  assert.equal(s.action(0,'kick'),true);
  assert.equal(p.state,'heavyKick');
}
{
  const {s,p,q}=setup();
  connect(s,p,q,'punch');connect(s,p,q,'punch');
  const other=s.fighters[2];other.ko=false;other.hp=100;other.demoIdle=true;other.x=5;
  connect(s,p,other,'punch');
  assert.equal(p.comboReady,null,'hits on a different rival reset the combo');
  connect(s,p,q,'punch');connect(s,p,q,'punch');connect(s,p,q,'punch');
  assert.equal(p.comboReady,'heavy');
  step(s,3.6);
  assert.equal(p.comboReady,null,'the upgrade expires');
}
{
  const {s,p,q}=setup();
  q.demoIdle=false;
  s.selected=1;
  step(s,.35);
  assert.equal(q.blocking,true,'standing still automatically guards');
  s.moveInput(1,0);step(s,.05);
  assert.equal(q.blocking,false,'moving drops the automatic guard');
  s.moveInput(0,0);step(s,.35);
  assert.equal(q.blocking,true);
  const hp=q.hp,stamina=q.stamina;
  connect(s,p,q,'punch');
  assert.ok(q.hp>hp-5,'guard reduces damage');
  assert.ok(q.stamina<stamina,'guard costs stamina');
  q.demoIdle=true;q.stamina=4;q.blocking=true;q.inv=0;
  connect(s,p,q,'kick');
  assert.equal(q.state,'dizzy','empty stamina causes a dizzy stance');
  assert.ok(q.dizzyUntil>s.time);
  step(s,.15);
  assert.equal(s.grabCandidate(p)?.id,q.id);
  p.stamina=100;
  assert.equal(s.action(0,'grab'),true);
  assert.equal(p.grabTarget,q.id);
  const before=q.hp;
  assert.equal(s.action(0,'spin'),true);
  assert.equal(p.state,'spin');
  assert.ok(q.hp<before);
  assert.equal(q.state,'down');
}
{
  const {s,p,q}=setup();
  assert.equal(s.action(0,'grab'),false,'a healthy rival cannot be grabbed');
  q.stamina=0;s.dizzy(q,2.2);q.inv=0;
  assert.equal(s.action(0,'grab'),true);
  assert.equal(s.action(0,'grab'),true,'Slam remains available after Grab');
}
{
  const {s,p,q}=setup();
  p.yaw=0;
  assert.equal(s.action(0,'punch'),true);
  assert.ok(Math.abs(p.yaw-Math.PI/2)<.01,'attack automatically faces the nearest rival');
}
{
  const {s,p,q}=setup();
  for(let i=0;i<5;i++){connect(s,p,q,'kick');step(s,.55);}
  assert.ok(q.dizzyUntil>s.time,'repeated successful kicks can deplete stamina in a fight');
}
console.log('Brawl combo upgrades, auto block, dizzy grab and spin passed');
