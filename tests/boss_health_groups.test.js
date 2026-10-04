const assert=require('node:assert/strict');
require('../src/brawl/combat.js');require('../src/brawl/boss.js');
const step=(s,n)=>{for(let i=0;i<n;i++)s.step(1/60);};
for(const mode of ['last','score','crown']){
 const s=new BrawlSim.Sim({mode,selected:0,ai:false,seed:7391});
 s.fighters[0].hp=31;s.fighters[1].hp=0;s.fighters[1].ko=true;s.finish(0);
 assert(s.fighters.every(f=>f.hp===100&&!f.ko&&f.state==='idle'),'Full health without staged resurrection');
 assert.deepEqual(s.fighters.map(f=>f.bossSquad),[0,0,1,1]);
 assert(s.fighters.slice(0,2).every(f=>f.x<0)&&s.fighters.slice(2).every(f=>f.x>0),'Two pairs occupy opposite flanks');
 step(s,290);assert(!s.drainEvents().some(e=>e.type==='bossRevive'),'No arrival revival events');
 assert.equal(s.healthPickups.length,4);
}
const s=new BrawlSim.Sim({selected:0,ai:false,seed:81});s.beginBoss(0);step(s,290);
s.boss.attack='idle';s.boss.cooldown=1000;s.boss.aimHold=1000;
const p=s.fighters[0],h=s.healthPickups[0];Object.assign(p,{x:h.x,z:h.z,hp:50,state:'idle',inv:0});
s.step(1/60);assert.equal(p.hp,75);assert(h.availableAt>s.time);
assert(s.drainEvents().some(e=>e.type==='healthPickup'&&e.id===0&&e.amount===25));
step(s,10);assert.equal(p.hp,75,'Single collection per spawn');
h.availableAt=s.time;Object.assign(p,{x:h.x,z:h.z,hp:94});s.step(1/60);assert.equal(p.hp,100,'Healing respects max HP');
assert(s.drainEvents().some(e=>e.type==='healthPickup'&&e.amount===6));
h.availableAt=s.time;s.step(1/60);assert(h.availableAt<=s.time,'Full-health players do not consume pickups');
Object.assign(p,{hp:0,ko:true,state:'ko'});s.step(1/60);assert.equal(p.hp,0);assert(p.ko,'Pickups never revive KO players');
const q=s.fighters[1];Object.assign(q,{x:h.x,z:h.z,hp:45,state:'idle',ko:false});s.step(1/60);assert.equal(q.hp,70,'An ally can collect health');
assert.equal(p.hp,0,'No shared or resurrection healing');
s.drainEvents();q.hp=45;h.availableAt=s.time;Object.assign(p,{hp:40,ko:false,state:'idle'});
s.step(1/60);const collected=s.drainEvents().filter(e=>e.type==='healthPickup');assert.equal(collected.length,1,'One pickup heals one player when players overlap');
const inactive=new BrawlSim.Sim({selected:0,ai:false,seed:9});assert.equal(inactive.healthPickups,undefined,'Normal Brawl has no boss pickups');
const formation=new BrawlSim.Sim({selected:0,ai:false,seed:9});formation.beginBoss(0);step(formation,290);
Object.assign(formation.boss,{cooldown:1e6,pursuitClock:-1e6,aimHold:1e6,shieldReadyAt:1e6,hp:1e6});step(formation,600);
assert(formation.fighters.slice(0,2).every(f=>f.x<-3)&&formation.fighters.slice(2).every(f=>f.x>3),'AI maintains two separate flanks');
for(const ids of [[0,1],[2,3]]){const [a,b]=ids.map(id=>formation.fighters[id]);assert(Math.hypot(a.x-b.x,a.z-b.z)>1.2,'Pair members keep firing space');}
const cooldown=new BrawlSim.Sim({selected:0,ai:false,seed:1});cooldown.beginBoss(0);cooldown.boss.phase='battle';
const pack=cooldown.healthPickups[0],patient=cooldown.fighters[0];Object.assign(patient,{hp:20,x:pack.x,z:pack.z});cooldown.collectBossHealth();assert.equal(patient.hp,45);
cooldown.time+=13.9;cooldown.collectBossHealth();assert.equal(patient.hp,45,'Pickup is unavailable during cooldown');
cooldown.time+=.2;cooldown.collectBossHealth();assert.equal(patient.hp,70,'Pickup respawns after fourteen seconds');
console.log('Full health arrival, two flanks, capped single-use health, ally collection and permanent KOs passed.');
