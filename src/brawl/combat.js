
/* VOLT BRAWL 3D — deterministic, renderer-independent combat simulation.
   Units are metres and seconds. No DOM, timers, or unseeded randomness. */
(function(root){
'use strict';
const cap=(v,a,b)=>Math.max(a,Math.min(b,v)), len=Math.hypot, d=(a,b)=>len(a.x-b.x,a.z-b.z);
const rng=s=>()=>{let t=s+=0x6D2B79F5;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;};
const ATTACKS={
 punch:{cost:9,damage:7,wind:.12,active:.09,recovery:.22,range:1.85,zone:'head',push:2.1},
 heavy:{cost:25,damage:17,wind:.39,active:.13,recovery:.40,range:2.05,zone:'head',push:7,down:true},
 kick:{cost:18,damage:11,wind:.24,active:.12,recovery:.31,range:2.45,zone:'leg',push:3.8}
};
const ITEMS={
 chair:{label:'CHAIR',damage:13,speed:10.5,radius:.35,bounce:.26,durability:2},
 toolbox:{label:'TOOLBOX',damage:18,speed:9,radius:.34,bounce:.24,durability:3},
 bucket:{label:'BUCKET',damage:9,speed:12,radius:.27,bounce:.52,durability:4},
 shoe:{label:'SHOE',damage:5,speed:15,radius:.22,bounce:.30,durability:4},
 box:{label:'CRATE',damage:8,speed:11.5,radius:.34,bounce:.26,durability:2},
 banana:{label:'BANANA',damage:3,speed:13,radius:.24,bounce:.16,durability:2},
 ball:{label:'BALL',damage:7,speed:14,radius:.29,bounce:.70,durability:9},
 bottle:{label:'BOTTLE',damage:6,speed:14.5,radius:.21,bounce:.38,durability:2},
 cone:{label:'CONE',damage:10,speed:11,radius:.32,bounce:.36,durability:5},
 mop:{label:'MOP',damage:9,speed:11.5,radius:.25,bounce:.23,durability:3}
};
const NAMES=['VOLT','SPARK','FUSE','SURGE'];
class Sim{
 constructor(options={}){this.seed=options.seed||73129;this.random=rng(this.seed);this.ai=options.ai!==false;this.difficulty=options.difficulty||'normal';this.selected=options.selected||0;this.mode=options.mode||'last';this.bounds={x:11.5,z:8};this.obstacles=[{x:-8.8,z:-5.3,r:1.35},{x:8.8,z:-4.8,r:1.25},{x:-8.8,z:5.7,r:1},{x:9.1,z:5.4,r:1.0}];this.reset();}
 reset(){this.time=0;this.events=[];this.finished=false;this.winner=null;this.draw=false;this.hitStop=0;this.cloud={active:false,x:0,z:0,r:2.4,members:[],age:0,fade:0,quiet:0,serial:0};this.crown={x:0,z:0,holder:null,time:[0,0,0,0]};this.fighters=NAMES.map((n,i)=>this.newFighter(i));this.items=[];let types=Object.keys(ITEMS);let ps=[[-4.8,3.4],[4.8,-3.6],[-6.4,-.4],[6.2,2.5],[1.8,5.8],[-2.7,-5.9],[0,3.5],[-5,-4.8],[7,-1],[-1.3,-3.2],[4.6,5.4],[-6.4,4.8]];ps.forEach((p,i)=>this.items.push(this.newItem(types[i%types.length],...p)));this.input={x:0,z:0};return this;}
 newFighter(i){let p=[[-3.5,2.1],[3.1,1.8],[-2.8,-2.6],[3.3,-2.5]][i];return{id:i,name:NAMES[i],x:p[0],z:p[1],y:0,vy:0,vx:0,vz:0,yaw:Math.atan2(-p[0],-p[1]),hp:100,stamina:100,rage:0,state:'idle',age:0,duration:0,attack:null,attackHit:false,inv:0,cool:0,head:0,body:0,leg:0,damage:0,hits:0,throws:0,kos:0,score:0,combo:0,comboTime:0,revenge:[0,0,0,0],held:null,grabbedBy:null,grabTarget:null,grabTime:0,ko:false,respawn:0,walk:0,speed:0,lastAttack:-100,lastHit:-100,lastAttacker:null,pressureBy:null,pressureHits:0,pressureSince:-100,pressureLast:-100,pushCooldown:0,think:.15+i*.1,aiTarget:null,aiAction:.4+i*.18,intent:{x:0,z:0},cloud:false,escapedUntil:0,dodgeX:0,dodgeZ:0,attackSide:1,rageAttack:false,blocks:0};}
 newItem(type,x,z){return{id:this.items?this.items.length:0,type,x,z,y:0,vx:0,vz:0,vy:0,spin:0,yaw:0,held:null,owner:null,flying:false,broken:false,health:ITEMS[type].durability,hit:new Set(),slipUntil:0};}
 emit(type,data={}){this.events.push({type,time:this.time,...data});if(this.events.length>220)this.events.shift();}
 drainEvents(){let e=this.events;this.events=[];return e;}
 condition(f){return f.ko?'K.O.':f.hp<=25?'WRECKED':f.hp<=50?'BEAT UP':f.hp<=75?'BRUISED':'CLEAN';}
 canAct(f){return !f.ko&&f.grabbedBy===null&&['idle','walk','holding'].includes(f.state)&&f.cool<=0;}
 target(f,range=Infinity){let fs=this.fighters.filter(q=>q!==f&&!q.ko&&q.grabbedBy===null&&d(f,q)<=range);fs.sort((a,b)=>{let sa=d(f,a)-(f.revenge[a.id]||0)*.012,sb=d(f,b)-(f.revenge[b.id]||0)*.012;if(this.mode==='crown'){if(a.id===this.crown.holder)sa-=5;if(b.id===this.crown.holder)sb-=5;}return sa-sb;});return fs[0]||null;}
 grabCandidate(f){let down=this.fighters.filter(q=>q!==f&&!q.ko&&q.grabbedBy===null&&q.state==='down'&&q.y<=.35&&q.inv<=0&&d(f,q)<=1.9).sort((a,b)=>d(f,a)-d(f,b))[0];if(down)return down;return this.fighters.filter(q=>q!==f&&!q.ko&&q.grabbedBy===null&&q.state!=='down'&&q.state!=='getup'&&q.inv<=0&&d(f,q)<=1.62).sort((a,b)=>d(f,a)-d(f,b))[0]||null;}
 face(f,q){if(q)f.yaw=Math.atan2(q.x-f.x,q.z-f.z);}
 state(f,s,duration=0){f.state=s;f.age=0;f.duration=duration;}
 moveInput(x,z){let m=len(x,z);this.input={x:m>1?x/m:x,z:m>1?z/m:z};}
 nearestItem(f){return this.items.filter(o=>o.held===null&&!o.flying&&!o.broken&&o.slipUntil<=this.time).sort((a,b)=>d(a,f)-d(b,f))[0]||null;}
 action(id,type,move){let f=this.fighters[id];if(!f||this.finished||f.ko)return false;
  if(type==='grab'&&f.grabbedBy!==null){f.grabTime-=.29;f.stamina=Math.max(0,f.stamina-4);if(f.grabTime<=0){let a=this.fighters[f.grabbedBy];this.releaseGrab(a);f.inv=.4;this.emit('escapeGrab',{id});}return true;}
  if(type==='grab'&&f.grabTarget!==null){this.slam(f);return true;}
  if(!this.canAct(f))return false;
  if(type==='pick'){
   if(f.held!==null){this.state(f,'throw',.48);f.attackHit=false;let q=this.target(f,18);if(q)this.face(f,q);f.lastAttack=this.time;return true;}
   let o=this.nearestItem(f);if(!o||d(f,o)>1.9){if(id===this.selected)this.emit('hint',{text:'Get closer to a highlighted prop to pick it up.'});return false;}
   f.held=o.id;o.held=id;o.owner=id;o.slipUntil=0;this.state(f,'pickup',.28);this.emit('pickup',{id,item:o.type});return true;
  }
  if(type==='dodge'){
   if(f.stamina<18)return false;f.stamina-=18;let v=move||f.intent;let m=len(v?.x||0,v?.z||0);let x=m>.1?v.x/m:Math.sin(f.yaw),z=m>.1?v.z/m:Math.cos(f.yaw);f.dodgeX=x;f.dodgeZ=z;f.inv=.29;f.escapedUntil=this.time+1.6;this.state(f,'dodge',.38);this.emit('dodge',{id});return true;
  }
  if(type==='grab'){
   if(f.stamina<13||f.held!==null)return false;f.stamina-=13;let q=this.grabCandidate(f),grounded=q?.state==='down';if(q){this.face(f,q);f.grabTarget=q.id;q.grabbedBy=id;q.grabTime=grounded?1.35:1.1;this.state(f,grounded?'groundGrabbing':'grabbing',q.grabTime);this.state(q,grounded?'groundGrabbed':'grabbed',q.grabTime);f.lastAttack=this.time;this.emit('grab',{id,target:q.id,grounded});}else{this.state(f,'counter',.48);this.emit('counterReady',{id});}return true;
  }
  let a=ATTACKS[type];if(!a||f.stamina<a.cost||f.held!==null)return false;
  f.stamina-=a.cost;f.attack=type;f.attackHit=false;f.attackSide*=-1;f.rageAttack=f.rage>=99.9;if(f.rageAttack){f.rage=0;this.emit('rage',{id});}
  let q=this.target(f,a.range+1);this.face(f,q);this.state(f,type,a.wind+a.active+a.recovery);f.lastAttack=this.time;return true;
 }
 releaseGrab(f){if(!f)return;if(f.grabTarget!==null){let q=this.fighters[f.grabTarget];if(q){q.grabbedBy=null;if(!q.ko)this.state(q,'idle');}f.grabTarget=null;}if(f.grabbedBy!==null){let a=this.fighters[f.grabbedBy];if(a){a.grabTarget=null;if(!a.ko)this.state(a,'idle');}f.grabbedBy=null;}if(!f.ko)this.state(f,'idle');}
 dropItem(f){if(f.held===null)return;let o=this.items[f.held];o.held=null;o.x=f.x;o.z=f.z;o.y=1;o.vy=1;o.vx=0;o.vz=0;o.flying=true;o.owner=null;o.hit.clear();f.held=null;}
 slam(f){let q=this.fighters[f.grabTarget];if(!q)return;this.releaseGrab(f);q.x=f.x+Math.sin(f.yaw)*1.4;q.z=f.z+Math.cos(f.yaw)*1.4;q.inv=0;this.hit(q,f,14,'body',6,true,'slam');this.state(f,'slam',.55);this.emit('slam',{id:f.id,target:q.id});}
 hit(q,f,amount,zone,push=2,down=false,source='melee',noCounter=false){
  if(q.ko||q.inv>0||q.state==='down'||q.state==='getup')return false;
  if(!noCounter&&q.state==='counter'&&q.age<=.3&&f&&d(q,f)<2.8&&source!=='prop'&&source!=='slip'){
   this.state(q,'idle');q.blocks++;q.score+=35;this.hit(f,q,12,'head',5,true,'counter',true);this.emit('perfectCounter',{id:q.id,target:f.id});return false;
  }
  let damage=Math.min(q.hp,Math.max(0,amount));q.hp=cap(q.hp-damage,0,100);q[zone]+=damage;q.lastHit=this.time;q.lastAttacker=f?.id??null;q.rage=cap(q.rage+damage*2,0,100);
  this.releaseGrab(q);this.dropItem(q);
  if(f){f.damage+=damage;f.hits++;f.score+=Math.round(damage*5);f.combo=f.comboTime>0?f.combo+1:1;f.comboTime=1.65;q.revenge[f.id]+=damage;}
  let dx=f?q.x-f.x:0,dz=f?q.z-f.z:1,m=len(dx,dz)||1;q.vx=dx/m*push;q.vz=dz/m*push;q.inv=.11;
  if(this.crown.holder===q.id&&(down||q.hp<=0)){this.crown.holder=null;this.crown.x=q.x;this.crown.z=q.z;this.emit('crownDrop',{id:q.id});}
  if(q.hp<=0){q.ko=true;q.respawn=this.mode==='last'?Infinity:3.8;this.state(q,'ko',999);q.vy=4;q.cloud=false;if(f){f.kos++;f.score+=250;}this.emit('ko',{id:q.id,by:f?.id,x:q.x,z:q.z});}
  else if(down){this.state(q,'down',.90);q.vy=3.6;this.emit('knockdown',{id:q.id});}
  else this.state(q,'hit',.24);
  this.emit('hit',{id:q.id,by:f?.id,damage,zone,source,heavy:down,x:q.x,z:q.z,cloud:this.cloud.active&&this.cloud.members.includes(q.id)});
  if(source==='melee'&&f&&!q.ko&&!down&&d(q,f)<=2.25)this.pressureHit(q,f);
  return true;
 }
 pressureHit(q,f){
  if(this.time<q.pushCooldown)return;
  if(q.pressureBy!==f.id||this.time-q.pressureLast>3.2||this.time-q.pressureSince>4.5){q.pressureBy=f.id;q.pressureHits=0;q.pressureSince=this.time;}
  q.pressureHits++;q.pressureLast=this.time;
  if(q.pressureHits<3||this.time-q.pressureSince<.55)return;
  let strong=q.hp>f.hp*2,dx=f.x-q.x,dz=f.z-q.z,m=len(dx,dz)||1;
  q.pressureHits=0;q.pressureBy=null;q.pushCooldown=this.time+7;q.inv=Math.max(q.inv,.7);q.vx=0;q.vz=0;this.face(q,f);this.state(q,'push',.42);
  f.vx=dx/m*(strong?1.25:7.5);f.vz=dz/m*(strong?1.25:7.5);f.inv=Math.max(f.inv,strong?.12:.3);
  if(strong){this.releaseGrab(f);this.dropItem(f);this.state(f,'down',1.65);f.vy=0;if(this.crown.holder===f.id){this.crown.holder=null;this.crown.x=f.x;this.crown.z=f.z;this.emit('crownDrop',{id:f.id});}this.emit('knockdown',{id:f.id});}
  else this.state(f,'shoved',.48);
  this.emit('autoPush',{id:q.id,target:f.id,strong,x:f.x,z:f.z});
 }
 throwItem(f){if(f.held===null)return;let o=this.items[f.held],spec=ITEMS[o.type];o.x=f.x+Math.sin(f.yaw)*.8;o.z=f.z+Math.cos(f.yaw)*.8;o.y=1.55;o.held=null;o.owner=f.id;o.flying=true;o.vx=Math.sin(f.yaw)*spec.speed;o.vz=Math.cos(f.yaw)*spec.speed;o.vy=3.8;o.spin=0;o.hit.clear();f.held=null;f.throws++;this.emit('throw',{id:f.id,item:o.type});}
 step(dt=1/60){if(this.finished)return;dt=cap(dt,0,.05);this.time+=dt;
  for(let f of this.fighters){f.inv=Math.max(0,f.inv-dt);f.cool=Math.max(0,f.cool-dt);f.comboTime-=dt;if(f.comboTime<=0)f.combo=0;f.age+=dt;
   if(f.ko){f.respawn-=dt;if(f.respawn<=0)this.revive(f);this.integrate(f,dt);continue;}
   if(f.grabbedBy!==null){let a=this.fighters[f.grabbedBy];if(!a||a.ko){this.releaseGrab(f);continue;}f.x=a.x+Math.sin(a.yaw)*1.1;f.z=a.z+Math.cos(a.yaw)*1.1;f.yaw=a.yaw+Math.PI;f.grabTime-=dt;if(f.grabTime<=0)this.slam(a);continue;}
   f.stamina=cap(f.stamina+(this.canAct(f)?24:9)*dt,0,100);f.intent={x:0,z:0};
   if(f.id===this.selected)f.intent={...this.input};else if(this.ai)this.aiStep(f,dt);
   if(f.grabTarget!==null){if(f.age>.85)this.slam(f);this.integrate(f,dt);continue;}
   if(ATTACKS[f.state]){let a=ATTACKS[f.state];if(!f.attackHit&&f.age>=a.wind){f.attackHit=true;let candidates=this.fighters.filter(q=>q!==f&&!q.ko&&q.grabbedBy===null&&d(q,f)<=a.range);candidates.sort((x,y)=>d(f,x)-d(f,y));for(let q of candidates){let m=d(f,q)||1,dot=((q.x-f.x)*Math.sin(f.yaw)+(q.z-f.z)*Math.cos(f.yaw))/m;if(dot<.15)continue;let dmg=a.damage*(f.combo>=2?1.12:1)*(f.rageAttack?1.30:1);this.hit(q,f,dmg,a.zone,a.push,a.down||f.rageAttack,'melee');break;}this.emit('swing',{id:f.id,attack:f.state});}}
   if(f.state==='throw'&&!f.attackHit&&f.age>=.18){f.attackHit=true;this.throwItem(f);}
   if(f.state==='dodge'){f.vx=f.dodgeX*8.7;f.vz=f.dodgeZ*8.7;}
   if(f.duration&&f.age>=f.duration){if(f.state==='down'){this.state(f,'getup',.50);f.inv=.65;}else if(!f.ko&&f.grabbedBy===null)this.state(f,f.held!==null?'holding':'idle');}
   if(this.canAct(f)){let m=len(f.intent.x,f.intent.z),speed=3.75*(f.leg>=30?.72:1)*(f.hp<=25?.90:1)*(f.held!==null?.80:1);let k=1-Math.exp(-14*dt);f.vx+=(f.intent.x*speed-f.vx)*k;f.vz+=(f.intent.z*speed-f.vz)*k;if(m>.1){f.yaw=Math.atan2(f.intent.x,f.intent.z);f.state='walk';}else f.state=f.held!==null?'holding':'idle';}
   this.integrate(f,dt);
  }
  // Solid-body separation: no sucking fighters into the cloud and no permanent overlap.
  for(let i=0;i<4;i++)for(let j=i+1;j<4;j++){let a=this.fighters[i],b=this.fighters[j];if(a.ko||b.ko||a.grabbedBy!==null||b.grabbedBy!==null)continue;let dx=b.x-a.x,dz=b.z-a.z,dd=len(dx,dz),min=.88;if(dd<min){let nx=dd>.001?dx/dd:1,nz=dd>.001?dz/dd:0,k=(min-dd)*.5;a.x-=nx*k;a.z-=nz*k;b.x+=nx*k;b.z+=nz*k;}}
  for(let f of this.fighters){f.x=cap(f.x,-this.bounds.x,this.bounds.x);f.z=cap(f.z,-this.bounds.z,this.bounds.z);}
  this.stepItems(dt);this.stepCloud(dt);this.stepCrown(dt);
  if(this.mode==='last'){let alive=this.fighters.filter(f=>!f.ko);if(alive.length<=1)this.finish(alive[0]?.id??null);}
  else if(this.mode==='score'&&this.time>=90)this.finish(this.rank()[0].id);
  else if(this.mode==='crown'&&(Math.max(...this.crown.time)>=45||this.time>=180)){let ids=[0,1,2,3].sort((a,b)=>this.crown.time[b]-this.crown.time[a]||this.fighters[b].score-this.fighters[a].score);this.finish(ids[0]);}
 }
 integrate(f,dt){f.x+=f.vx*dt;f.z+=f.vz*dt;f.y+=f.vy*dt;if(f.y>0||f.vy>0)f.vy-=15*dt;if(f.y<0){f.y=0;f.vy=0;}if(!this.canAct(f)&&f.state!=='dodge'){let k=Math.exp(-7*dt);f.vx*=k;f.vz*=k;}
  f.x=cap(f.x,-this.bounds.x,this.bounds.x);f.z=cap(f.z,-this.bounds.z,this.bounds.z);
  for(let o of this.obstacles){let dx=f.x-o.x,dz=f.z-o.z,dd=len(dx,dz),rr=o.r+.42;if(dd<rr){if(dd<.001){dx=1;dd=1;}f.x=o.x+dx/dd*rr;f.z=o.z+dz/dd*rr;}}
  f.speed=len(f.vx,f.vz);f.walk+=f.speed*dt*2.6;
 }
 revive(f){let fresh=this.newFighter(f.id);let stats={damage:f.damage,hits:f.hits,kos:f.kos,score:f.score,throws:f.throws,blocks:f.blocks};Object.assign(f,fresh,stats);f.inv=1.6;this.emit('respawn',{id:f.id});}
 aiStep(f,dt){if(!this.canAct(f))return;f.think-=dt;f.aiAction-=dt;
  if(f.think<=0){f.think=.20+this.random()*.22;let q=this.target(f);f.aiTarget=q?.id??null;}
  let q=this.fighters[f.aiTarget];if(!q||q.ko)return;let dx=q.x-f.x,dz=q.z-f.z,dd=len(dx,dz)||1;
  if(this.mode==='crown'&&this.crown.holder===f.id){f.intent={x:-dx/dd*.75,z:-dz/dd*.75};if(Math.abs(f.x)>9||Math.abs(f.z)>6)f.intent={x:-f.x/len(f.x,f.z),z:-f.z/len(f.x,f.z)};}
  else if(this.mode==='crown'&&this.crown.holder===null&&d(f,this.crown)<dd){let xx=this.crown.x-f.x,zz=this.crown.z-f.z,mm=len(xx,zz)||1;f.intent={x:xx/mm,z:zz/mm};}
  else if(dd>1.65){let side=Math.sin(this.time*.8+f.id*2)*.20;f.intent={x:dx/dd+dz/dd*side,z:dz/dd-dx/dd*side};}
  this.face(f,q);
  if(f.aiAction>0)return;
  let delay=this.difficulty==='easy'?.65:this.difficulty==='hard'?.14:.33;f.aiAction=delay+this.random()*.38;
  if(f.held!==null){if(dd<13)this.action(f.id,'pick');return;}
  let o=this.nearestItem(f);if(o&&d(o,f)<1.7&&dd>2.5&&this.random()<.50){this.action(f.id,'pick');return;}
  if(q.state==='heavy'&&dd<2.8&&this.random()<(this.difficulty==='hard'?.55:.24)){this.action(f.id,'dodge',{x:-dx/dd,z:-dz/dd});return;}
  if(dd<2.25){let r=this.random();if(r<.07&&dd<1.5)this.action(f.id,'grab');else if(r<.20)this.action(f.id,'heavy');else if(r<.49)this.action(f.id,'kick');else this.action(f.id,'punch');}
 }
 stepItems(dt){for(let o of this.items){if(o.broken)continue;let spec=ITEMS[o.type];if(o.held!==null){let f=this.fighters[o.held];o.x=f.x+Math.sin(f.yaw)*.7;o.z=f.z+Math.cos(f.yaw)*.7;o.y=1.65;continue;}
   if(o.slipUntil>this.time){for(let f of this.fighters)if(!f.ko&&f.inv<=0&&f.speed>1.2&&d(o,f)<.6&&f.state!=='down'&&f.state!=='getup'){this.hit(f,this.fighters[o.owner],3,'leg',2,true,'slip',true);o.slipUntil=0;o.broken=true;this.emit('slip',{id:f.id});break;}}
   if(!o.flying)continue;let px=o.x,pz=o.z;o.x+=o.vx*dt;o.z+=o.vz*dt;o.y+=o.vy*dt;o.vy-=11*dt;o.spin+=dt*len(o.vx,o.vz)*.65;
   if(o.y<.12){o.y=.12;o.vy=-o.vy*spec.bounce;o.vx*=.64;o.vz*=.64;if(o.type==='banana'){o.slipUntil=this.time+16;o.flying=false;o.y=.04;o.vx=o.vz=o.vy=0;}else if(Math.abs(o.vy)<.7&&len(o.vx,o.vz)<1.8){o.flying=false;o.y=0;o.vx=o.vz=o.vy=0;}}
   if(Math.abs(o.x)>this.bounds.x){o.x=cap(o.x,-this.bounds.x,this.bounds.x);o.vx*=-.5;}if(Math.abs(o.z)>this.bounds.z){o.z=cap(o.z,-this.bounds.z,this.bounds.z);o.vz*=-.5;}
   for(let obstacle of this.obstacles){let dx=o.x-obstacle.x,dz=o.z-obstacle.z,dd=len(dx,dz)||.001;if(dd<obstacle.r+spec.radius&&o.y<1.6){o.x=obstacle.x+dx/dd*(obstacle.r+spec.radius);o.z=obstacle.z+dz/dd*(obstacle.r+spec.radius);let dot=(o.vx*dx+o.vz*dz)/dd;if(dot<0){o.vx-=1.4*dot*dx/dd;o.vz-=1.4*dot*dz/dd;}}}
   if(o.owner===null||len(o.vx,o.vz)<2.8||o.y>2.9)continue;
   for(let f of this.fighters){if(f.id===o.owner||f.ko||o.hit.has(f.id))continue;let sx=o.x-px,sz=o.z-pz,den=sx*sx+sz*sz,t=den?cap(((f.x-px)*sx+(f.z-pz)*sz)/den,0,1):0,near=len(f.x-(px+sx*t),f.z-(pz+sz*t));if(near<.5+spec.radius){let ok=this.hit(f,this.fighters[o.owner],spec.damage,o.y>1.15?'head':'body',spec.damage>12?6:3,spec.damage>12,'prop',true);if(ok){o.hit.add(f.id);o.health--;o.vx*=-.30;o.vz*=-.30;o.vy=2.5;if(o.health<=0){o.broken=true;this.emit('break',{item:o.type,x:o.x,z:o.z});}break;}}}
  }}
 stepCloud(dt){let c=this.cloud;let living=this.fighters.filter(f=>!f.ko);for(let f of this.fighters)f.cloud=false;
  if(!c.active){let best=[];for(let a of living){let group=living.filter(f=>d(a,f)<3.1&&f.escapedUntil<=this.time);let active=group.filter(f=>this.time-f.lastAttack<1.45);if(group.length>=3&&active.length>=2&&group.length>best.length)best=group;}if(best.length>=3){c.active=true;c.members=best.map(f=>f.id);c.age=0;c.quiet=0;c.fade=1;c.serial++;c.x=best.reduce((s,f)=>s+f.x,0)/best.length;c.z=best.reduce((s,f)=>s+f.z,0)/best.length;this.emit('cloudStart',{members:[...c.members]});}}
  if(c.active){c.age+=dt;let members=c.members.map(i=>this.fighters[i]).filter(f=>!f.ko&&d(f,c)<3.8&&!(f.state==='dodge'&&f.age>.08));for(let f of living)if(!members.includes(f)&&d(f,c)<2.7&&this.time-f.lastAttack<1.1&&f.escapedUntil<=this.time)members.push(f);
   c.members=members.map(f=>f.id);let active=members.some(f=>this.time-f.lastAttack<1.3||this.time-f.lastHit<.8);c.quiet=active?0:c.quiet+dt;
   if(members.length<3||c.quiet>.70){c.active=false;c.fade=1;this.emit('cloudEnd',{});}
   else{let x=members.reduce((s,f)=>s+f.x,0)/members.length,z=members.reduce((s,f)=>s+f.z,0)/members.length,k=1-Math.exp(-8*dt);c.x+=(x-c.x)*k;c.z+=(z-c.z)*k;c.r=2.0+members.length*.18;for(let f of members)f.cloud=true;}
  }else c.fade=Math.max(0,c.fade-dt*2.5);
 }
 stepCrown(dt){if(this.mode!=='crown')return;let c=this.crown;if(c.holder!==null){let f=this.fighters[c.holder];c.x=f.x;c.z=f.z;c.time[f.id]+=dt;f.score+=10*dt;}else for(let f of this.fighters)if(!f.ko&&f.state!=='down'&&f.state!=='getup'&&d(f,c)<1.0){c.holder=f.id;this.emit('crownPickup',{id:f.id});break;}}
 rank(){return this.fighters.slice().sort((a,b)=>b.score-a.score||b.kos-a.kos||b.hp-a.hp||a.id-b.id);}
 finish(id){this.finished=true;this.winner=id;this.draw=id===null;this.emit('finish',{id});}
 snapshot(){return{time:this.time,mode:this.mode,finished:this.finished,winner:this.winner,cloud:{...this.cloud,members:[...this.cloud.members]},crown:{...this.crown,time:[...this.crown.time]},fighters:this.fighters.map(f=>({...f,revenge:[...f.revenge]})),items:this.items.map(o=>({...o,hit:[...o.hit]}))};}
}
root.BrawlSim={Sim,ATTACKS,ITEMS,NAMES};if(typeof module!=='undefined'&&module.exports)module.exports=root.BrawlSim;
})(globalThis);
