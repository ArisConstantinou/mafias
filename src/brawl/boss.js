/* Crimson Boss finale: deterministic, renderer-independent phase and combat rules. */
(function(){
'use strict';
const Sim=BrawlSim.Sim;
const cap=(n,a,b)=>Math.max(a,Math.min(b,n));
const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const health=[280,340,400,460];
const crewLaserRange=7.5;
const shieldDeploy=.8,shieldDuration=10,shieldRetract=.7,shieldCooldown=60;
BrawlSim.BOSS_LASER_RANGE=crewLaserRange;
// Shared by collision, laser cover and the rendered boss-only arena.
const arena={
 cover:[{x:-4.4,z:-1.7,w:1.45,d:2.3},{x:4.4,z:-1.7,w:1.45,d:2.3},
  {x:-3.7,z:2.7,w:1.6,d:1.15},{x:3.7,z:2.7,w:1.6,d:1.15}],
 decks:[{x:-8.3,z:-1.5,w:3.2,d:3.6},{x:8.3,z:-1.5,w:3.2,d:3.6}],
 height:1.05,rampEnd:4.55
};
BrawlSim.BOSS_ARENA=arena;
const segmentCover=(a,b)=>{
 let closest=null;
 for(const box of arena.cover){
  let lo=0,hi=1;
  for(const [p,v,min,max] of [[a.x,b.x-a.x,box.x-box.w/2,box.x+box.w/2],[a.z,b.z-a.z,box.z-box.d/2,box.z+box.d/2]]){
   if(Math.abs(v)<1e-8){if(p<min||p>max){lo=2;break;}continue;}
   let t1=(min-p)/v,t2=(max-p)/v;if(t1>t2)[t1,t2]=[t2,t1];
   lo=Math.max(lo,t1);hi=Math.min(hi,t2);
  }
  if(lo<=hi&&lo>.025&&lo<.98&&(!closest||lo<closest.t))closest={t:lo,x:a.x+(b.x-a.x)*lo,z:a.z+(b.z-a.z)*lo};
 }
 return closest;
};
const floorHeight=(x,z)=>{
 for(const deck of arena.decks){
  if(Math.abs(x-deck.x)>deck.w/2)continue;
  if(z>=deck.z-deck.d/2&&z<=deck.z+deck.d/2)return arena.height;
  let front=deck.z+deck.d/2;
  if(z>front&&z<arena.rampEnd)return arena.height*(arena.rampEnd-z)/(arena.rampEnd-front);
 }
 return 0;
};
const pushOut=(body,margin)=>{
 for(const c of arena.cover){let dx=body.x-c.x,dz=body.z-c.z,px=c.w/2+margin-Math.abs(dx),pz=c.d/2+margin-Math.abs(dz);
  if(px>0&&pz>0){if(px<pz)body.x+=Math.sign(dx||1)*px;else body.z+=Math.sign(dz||1)*pz;}
 }
};

Sim.prototype.beginBoss=function(roundWinner){
 this.roundWinner=roundWinner;this.bossOutcome=null;this.cloud.active=false;this.cloud.fade=0;
 this.boss={phase:'arrival',age:0,x:0,y:0,z:-.7,yaw:Math.PI,scale:.98,
  tier:0,hp:health[0],maxHp:health[0],attack:'idle',attackAge:0,
  cooldown:3.0,shots:0,targetIds:[],targetPoints:[],targetCursor:0,attackSerial:0,
  chaseTargetId:0,chaseAge:0,chaseTime:0,battleTime:0,stride:0,moving:0,
  pursuitClock:0,aimHold:0,avoidSide:1,
  shieldPhase:'stowed',shieldAge:0,shieldReadyAt:0,shieldPressure:0,shieldHitVisual:0,
  clawOpen:.2,grabbed:null,hitVisual:0,visualHitSerial:0};
 for(let item of this.items)item.broken=true;
 for(let f of this.fighters){
  this.releaseGrab(f);this.dropItem(f);
  f.x=(f.id-1.5)*1.75;f.z=4.5+(f.id%2)*.35;f.y=0;f.vx=f.vz=f.vy=0;
  f.yaw=Math.PI;f.hp=100;f.stamina=100;f.head=f.body=f.leg=0;f.ko=false;
  f.inv=0;f.weaponCooldown=0;f.laserAge=0;f.bossShots=0;f.bossDamage=0;f.grabbedBy=null;
  this.state(f,'down',0);
 }
 this.emit('bossStart',{roundWinner});
};

Sim.prototype.bossAction=function(id,type,move){
 let boss=this.boss,f=this.fighters[id];
 if(!boss||boss.phase!=='battle'||!f||f.ko||f.state==='bossGrabbed')return false;
 if(type==='dodge'){
  if(f.stamina<18||f.inv>.3)return false;
  let v=move||this.input,m=Math.hypot(v.x||0,v.z||0)||1;
  f.stamina-=18;f.vx=(v.x||Math.sin(f.yaw))/m*9;
  f.vz=(v.z||Math.cos(f.yaw))/m*9;f.inv=.42;
  this.state(f,'dodge',.4);this.emit('dodge',{id});return true;
 }
 // The current three-button Brawl layout uses Kick as the power-shot button
 // during the finale. Keep Heavy as a keyboard/API alias for older controls.
 let heavy=type==='kick'||type==='heavy';
 if(!['punch','kick','heavy'].includes(type))return false;
 if(f.weaponCooldown>0||heavy&&f.stamina<25)return false;
 if(heavy)f.stamina-=25;
 f.weaponCooldown=heavy?1.15:.33;f.laserAge=.20;
 this.bossFire(f,heavy);
 return true;
};

Sim.prototype.bossFire=function(f,heavy=false){
 let b=this.boss;if(!b||b.phase!=='battle'||f.ko)return;
 let r=distance(f,b),outOfRange=r>crewLaserRange;
 let end=outOfRange?{x:f.x+(b.x-f.x)*crewLaserRange/r,z:f.z+(b.z-f.z)*crewLaserRange/r}:b;
 let block=segmentCover(f,end),damage=heavy?31:f.id===this.selected?11:4;
 const fx=-Math.sin(b.yaw),fz=-Math.cos(b.yaw);
 const dot=(f.x-b.x)*fx+(f.z-b.z)*fz;
 const shieldBlock=!block&&!outOfRange&&b.shieldPhase==='active'&&dot>r*.34;
 if(shieldBlock){end={x:b.x+fx*1.25,z:b.z+fz*1.25};b.shieldHitVisual=.24;
  this.emit('bossShieldHit',{x:end.x,z:end.z,heavy});}
 let applied=block||outOfRange||shieldBlock?0:Math.min(b.hp,damage);
 f.bossShots++;f.bossDamage+=applied;
 this.emit('laserShot',{id:f.id,x:f.x,z:f.z,toX:block?.x??end.x,toZ:block?.z??end.z,heavy,damage:applied,blocked:!!block,shieldBlock,outOfRange});
 if(block||outOfRange||shieldBlock)return;
 b.hp=Math.max(0,b.hp-damage);
 b.shieldPressure=Math.min(100,b.shieldPressure+damage);
 if(heavy&&b.attack==='idle'){b.hitVisual=.28;b.visualHitSerial++;}
 if(b.hp<=0){
  b.phase=b.tier<3?'resurrect':'dead';b.age=0;b.attack='idle';b.grabbed=null;b.shieldPhase='stowed';
  b.nextMaxHp=b.tier<3?health[b.tier+1]:0;
  this.emit(b.phase==='dead'?'bossFinalFall':'bossCollapse',{tier:b.tier});
 }
};

Sim.prototype.bossHitPlayer=function(f,damage,source='cannon'){
 if(!f||f.ko||f.inv>0)return false;
 f.hp=Math.max(0,f.hp-damage);f.body+=damage;f.inv=.65;
 this.emit('hit',{id:f.id,damage,zone:'body',source:'boss-'+source,
  heavy:damage>=30,x:f.x,z:f.z});
 if(f.hp<=0){f.ko=true;f.state='ko';f.age=0;f.vy=3.4;
  this.emit('ko',{id:f.id,boss:true,x:f.x,z:f.z});}
 else this.state(f,'hit',.36);
 return true;
};

Sim.prototype.bossBeam=function(shot){
 let b=this.boss;if(!b||b.shieldPhase!=='stowed')return;
 let id=b.targetIds[shot],point=b.targetPoints[shot];
 if(id===undefined||!point)return;
 let start={x:b.x+Math.cos(b.yaw)-Math.sin(b.yaw)*3.6,
  z:b.z-Math.sin(b.yaw)-Math.cos(b.yaw)*3.6},end=point;
 let block=segmentCover(start,end);
 this.emit('bossLaser',{id,x:start.x,z:start.z,toX:block?.x??end.x,toZ:block?.z??end.z,tier:b.tier,blocked:!!block});
 let vx=end.x-start.x,vz=end.z-start.z,den=vx*vx+vz*vz||1;
 for(let f of this.fighters){
  if(f.ko)continue;
  let t=cap(((f.x-start.x)*vx+(f.z-start.z)*vz)/den,0,1);
  let miss=Math.hypot(f.x-(start.x+vx*t),f.z-(start.z+vz*t));
  if(miss<1.05&&(!block||t<block.t))this.bossHitPlayer(f,22+b.tier*5,'cannon');
 }
};

Sim.prototype.bossStep=function(dt){
 let b=this.boss;b.age+=dt;
 b.hitVisual=Math.max(0,(b.hitVisual||0)-dt);
 b.shieldHitVisual=Math.max(0,b.shieldHitVisual-dt);
 if(b.phase==='arrival'){
  for(let f of this.fighters){
   let begin=1.95+f.id*.19;
   if(b.age>=begin){
    if(f.state==='down'){this.state(f,'getup',1.45);this.emit('bossRevive',{id:f.id});}
    else if(f.state==='getup'){f.age+=dt;if(f.age>=f.duration)this.state(f,'idle');}
   }
  }
  if(b.age-dt<1.55&&b.age>=1.55)this.emit('bossLand',{x:b.x,z:b.z});
  if(b.age>=4.65){b.phase='battle';b.age=0;this.fighters.forEach(f=>{this.state(f,'idle');f.inv=1.0;});this.emit('bossBattle',{});}
  return;
 }
 if(b.phase==='resurrect'){
  if(b.age-dt<1.15&&b.age>=1.15)this.emit('bossRebuild',{tier:b.tier+1});
  if(b.age>=3.5){b.tier++;b.maxHp=health[b.tier];b.hp=b.maxHp;
   b.phase='battle';b.age=0;b.cooldown=1.35;b.attack='idle';
   this.emit('bossResurrected',{tier:b.tier});}
 }
 if(b.phase==='dead'||b.phase==='laugh'){
  if(b.age>=3.25){this.bossOutcome=b.phase==='dead'?'crew':'boss';
   this.bossResolved=true;this.finish(this.bossOutcome==='crew'?this.roundWinner:null);}
  return;
 }
 if(b.phase==='battle'){
  b.battleTime+=dt;b.chaseAge+=dt;b.pursuitClock+=dt;
  b.shieldPressure=Math.max(0,b.shieldPressure-dt*1.4);
  if(b.shieldPhase!=='stowed'){
   b.shieldAge+=dt;
   if(b.shieldPhase==='deploy'&&b.shieldAge>=shieldDeploy){b.shieldPhase='active';b.shieldAge=0;this.emit('bossShieldLocked',{});}
   else if(b.shieldPhase==='active'&&b.shieldAge>=shieldDuration){b.shieldPhase='retract';b.shieldAge=0;this.emit('bossShieldRetract',{});}
   else if(b.shieldPhase==='retract'&&b.shieldAge>=shieldRetract){b.shieldPhase='stowed';b.shieldAge=0;b.cooldown=Math.max(b.cooldown,.65);}
  }
  if(b.shieldPhase!=='stowed'){
   b.aimHold=0;
   if(b.attack==='charge'||b.attack==='beam'){
    b.attack='idle';b.attackAge=0;b.shots=0;b.targetIds=[];b.targetPoints=[];
   }
  }
  if(b.shieldPhase==='stowed'&&b.pursuitClock>=3.4){b.pursuitClock=0;b.aimHold=.45;}
  b.aimHold=Math.max(0,b.aimHold-dt);
  let living=this.fighters.filter(f=>!f.ko);
  if(b.chaseAge>=4.2||!living.some(f=>f.id===b.chaseTargetId)){
   b.chaseAge=0;
   b.chaseTargetId=living.find(f=>f.id>b.chaseTargetId)?.id??living[0]?.id??0;
  }
  let target=b.attack==='claw'?this.fighters[b.targetIds[0]]:this.fighters[b.chaseTargetId];
  if(!target||target.ko)target=living[0];
  if(target){
   let dx=target.x-b.x,dz=target.z-b.z,r=Math.hypot(dx,dz)||1;
   let desiredYaw=Math.atan2(-dx,-dz);
   let delta=Math.atan2(Math.sin(desiredYaw-b.yaw),Math.cos(desiredYaw-b.yaw));
   b.yaw+=cap(delta,-2.8*dt,2.8*dt);
   let speed=b.shieldPhase==='deploy'||b.shieldPhase==='retract'||b.aimHold>0||b.attack==='beam'?0:
    b.attack==='claw'?5.1:b.attack==='charge'?1.9:b.shieldPhase==='active'?2.65:3.45+b.tier*.25;
   let gap=b.attack==='claw'?1.9:2.2;
   let step=Math.min(Math.max(0,r-gap),speed*dt);
   let oldX=b.x,oldZ=b.z;
   b.x=cap(b.x+dx/r*step,-9.2,9.2);
   b.z=cap(b.z+dz/r*step,-6.2,6.2);
   pushOut(b,1.05);
   let actual=Math.hypot(b.x-oldX,b.z-oldZ);
   if(step>.01&&actual<step*.45){
    for(const side of[b.avoidSide,-b.avoidSide]){
     let probe={x:cap(oldX-dz/r*step*side,-9.2,9.2),z:cap(oldZ+dx/r*step*side,-6.2,6.2)};
     pushOut(probe,1.05);
     let moved=Math.hypot(probe.x-oldX,probe.z-oldZ);
     if(moved>actual+.005){b.x=probe.x;b.z=probe.z;actual=moved;b.avoidSide=side;break;}
    }
   }
   b.moving=actual>.002?1:0;
   if(b.moving){b.chaseTime+=dt;b.stride+=actual*3.4;}
  }else b.moving=0;
 }else b.moving=0;
 for(let f of this.fighters){
  f.inv=Math.max(0,f.inv-dt);f.weaponCooldown=Math.max(0,(f.weaponCooldown||0)-dt);
  f.laserAge=Math.max(0,(f.laserAge||0)-dt);f.age+=dt;
  if(f.ko){f.y+=f.vy*dt;f.vy-=16*dt;if(f.y<0){f.y=0;f.vy=0;}continue;}
  if(f.state==='bossGrabbed'){
   f.x=b.x-Math.sin(b.yaw)*2.15;f.z=b.z-Math.cos(b.yaw)*2.15;
   f.y=1.2+Math.sin(Math.min(1,b.attackAge)*Math.PI)*.8;continue;
  }
  if(f.y>floorHeight(f.x,f.z)+.02||f.vy>0){
   f.y+=f.vy*dt;f.vy-=18*dt;
   let ground=floorHeight(f.x,f.z);
   if(f.y<=ground){f.y=ground;f.vy=0;f.vx*=.35;f.vz*=.35;pushOut(f,.40);if(f.state==='bossThrown'){this.state(f,'down',.60);f.inv=Math.max(f.inv,.70);}this.emit('bossThrowLand',{id:f.id,x:f.x,z:f.z});}
   else{f.x=cap(f.x+f.vx*dt,-this.bounds.x,this.bounds.x);f.z=cap(f.z+f.vz*dt,-this.bounds.z,this.bounds.z);continue;}
  }
  if(f.state==='down'||f.state==='getup'){
   if(f.age>=f.duration)this.state(f,f.state==='down'?'getup':'idle',f.state==='down'?.52:0);
   f.vx*=Math.exp(-8*dt);f.vz*=Math.exp(-8*dt);f.y=floorHeight(f.x,f.z);
   continue;
  }
  if(f.state==='hit'&&f.age>=.36||f.state==='dodge'&&f.age>=.40)this.state(f,'idle');
  f.stamina=cap(f.stamina+21*dt,0,100);
  let intent;
  if(f.id===this.selected)intent=this.input;
  else{
   let theta=f.id*1.55+this.time*.28;
   let ideal={x:b.x+Math.sin(theta)*5.35,z:b.z+Math.cos(theta)*5.35};
   let dx=ideal.x-f.x,dz=ideal.z-f.z,m=Math.hypot(dx,dz)||1;
   intent={x:m>.5?dx/m:0,z:m>.5?dz/m:0};
   if(b.attack==='charge'&&b.targetIds.includes(f.id)&&f.lastBossDodge!==b.attackSerial){
    f.lastBossDodge=b.attackSerial;
    if(this.random()<.38&&f.stamina>=18){
     let side=f.id%2?-1:1;intent={x:Math.cos(theta)*side,z:-Math.sin(theta)*side};
     this.bossAction(f.id,'dodge',intent);
    }
   }
   if(b.attack==='slamWind'&&distance(f,b)<5.4){let dx=f.x-b.x,dz=f.z-b.z,m=Math.hypot(dx,dz)||1;intent={x:dx/m,z:dz/m};}
  }
  if(f.state==='dodge'){
   f.vx*=Math.exp(-2*dt);f.vz*=Math.exp(-2*dt);
  }else{
   let k=1-Math.exp(-13*dt);f.vx+=(intent.x*4.2-f.vx)*k;
   f.vz+=(intent.z*4.2-f.vz)*k;
   f.state=Math.hypot(f.vx,f.vz)>.3?'walk':'idle';
  }
  const oldX=f.x,oldZ=f.z,oldFloor=floorHeight(oldX,oldZ);
  f.x=cap(f.x+f.vx*dt,-this.bounds.x,this.bounds.x);
  f.z=cap(f.z+f.vz*dt,-this.bounds.z,this.bounds.z);
  pushOut(f,.40);
  let nextFloor=floorHeight(f.x,f.z);
  if(nextFloor>oldFloor+.13){f.x=oldX;f.z=oldZ;f.vx=f.vz=0;nextFloor=oldFloor;}
  let awayX=f.x-b.x,awayZ=f.z-b.z,r=Math.hypot(awayX,awayZ)||1;
  if(r<2.55){f.x=b.x+awayX/r*2.55;f.z=b.z+awayZ/r*2.55;}
  if(nextFloor<oldFloor-.13){f.y=oldFloor;f.vy=0;}else f.y=nextFloor;
  f.yaw=Math.atan2(b.x-f.x,b.z-f.z);f.speed=Math.hypot(f.vx,f.vz);
  f.walk+=f.speed*dt*2.6;
  if(f.id!==this.selected&&b.phase==='battle'&&f.weaponCooldown<=0){
   f.weaponCooldown=1.45+this.random()*.55;this.bossFire(f,false);
  }
 }
 if(b.phase==='resurrect')return;
 if(this.fighters.every(f=>f.ko)){
  b.phase='laugh';b.age=0;b.attack='idle';this.emit('bossLaugh',{});return;
 }
 b.clawOpen=.28;
 if(b.attack==='idle'){
  b.cooldown-=dt;
  if(b.shieldPhase==='stowed'&&this.time>=b.shieldReadyAt&&b.battleTime>=5&&
   (b.shieldPressure>=18||b.battleTime>=12)){
   b.shieldPhase='deploy';b.shieldAge=0;b.shieldReadyAt=this.time+shieldCooldown;
   b.shieldPressure=0;b.cooldown=.25;b.aimHold=0;
   this.emit('bossShieldDeploy',{duration:shieldDuration,cooldown:shieldCooldown});
  }
  if(b.shieldPhase!=='stowed')return;
  if(b.cooldown<=0){
   let living=this.fighters.filter(f=>!f.ko);
   let near=living.filter(f=>f.inv<=0).sort((a,c)=>distance(a,b)-distance(c,b))[0];
   let crowded=living.filter(f=>distance(f,b)<5.1).length;
   if(crowded>=2&&this.random()<.62){
    b.attack='slamWind';b.attackAge=0;b.attackSerial++;b.targetIds=[];
    this.emit('bossSlamWind',{x:b.x,z:b.z});
   }else if(near&&distance(near,b)<5.2&&this.random()<.82){
    b.attack='claw';b.attackAge=0;b.grabbed=null;b.targetIds=[near.id];
    b.attackSerial++;
    this.emit('bossClawWind',{id:near.id});
   }else{
    b.attack='charge';b.attackAge=0;b.shots=0;
    b.attackSerial++;
    b.targetIds=[];b.targetPoints=[];
    for(let j=0;j<Math.min(3,living.length);j++){
     let f=living[(b.targetCursor+j)%living.length];
     b.targetIds.push(f.id);b.targetPoints.push({x:f.x,z:f.z});
    }
    b.targetCursor=(b.targetCursor+1)%living.length;
    this.emit('bossCharge',{targets:[...b.targetIds]});
   }
  }
 }else{
  b.attackAge+=dt;
  if(b.attack==='slamWind'){
   b.clawOpen=.95;
   if(b.attackAge>=.88){
    b.attack='slamImpact';b.attackAge=0;this.emit('bossSlam',{x:b.x,z:b.z,radius:5.1});
    for(const f of this.fighters){if(f.ko||distance(f,b)>5.1||f.y>.75)continue;
     if(this.bossHitPlayer(f,27+b.tier*3,'slam')){let dx=f.x-b.x,dz=f.z-b.z,m=Math.hypot(dx,dz)||1;f.vx=dx/m*5;f.vz=dz/m*5;}
    }
   }
  }else if(b.attack==='slamImpact'){
   if(b.attackAge>=.62){b.attack='idle';b.cooldown=2.35;}
  }else if(b.attack==='charge'){
   b.clawOpen=.15;
   if(b.attackAge>=.95){b.attack='beam';b.attackAge=0;}
  }else if(b.attack==='beam'){
   while(b.shots<b.targetIds.length&&b.attackAge>=b.shots*.28){
    this.bossBeam(b.shots);b.shots++;
   }
   if(b.attackAge>.85){b.attack='idle';b.cooldown=Math.max(1.2,3.0-b.tier*.38);}
  }else if(b.attack==='claw'){
   b.clawOpen=.85;
   if(b.attackAge>=.53&&b.grabbed===null){
    let target=this.fighters[b.targetIds[0]];
    if(target&&!target.ko&&target.inv<=0&&distance(target,b)<4.6){
     b.grabbed=target.id;target.grabbedBy=-1;this.state(target,'bossGrabbed',1.0);
     this.emit('bossGrab',{id:target.id});
    }else b.grabbed=-1;
   }
   if(b.attackAge>=1.22){
    if(b.grabbed>=0){let target=this.fighters[b.grabbed];
     target.grabbedBy=null;target.y=1.65;
     target.vx=-Math.sin(b.yaw)*12.5;target.vz=-Math.cos(b.yaw)*12.5;target.vy=5.5;
     target.inv=0;this.bossHitPlayer(target,34+b.tier*5,'claw');
     if(!target.ko)this.state(target,'bossThrown');
     this.emit('bossThrow',{id:target.id});}
    b.attack='idle';b.cooldown=2.25;b.grabbed=null;
   }
  }
 }
};
})();
