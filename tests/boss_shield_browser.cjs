const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
const baseline=process.env.BRAWL_BASELINE==='1';
const html=process.env.BRAWL_HTML||path.join(root,'brawl.html');
const out=path.join(root,'.qa-run',baseline?'boss-shield-before':'boss-shield');
fs.mkdirSync(out,{recursive:true});

(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  for(const [label,viewport,mobile] of [['mobile',{width:430,height:932},true],['desktop',{width:1280,height:800},false]]){
   const context=await browser.newContext({viewport,isMobile:mobile,hasTouch:mobile});
   await context.route('**/brawl.html',route=>route.fulfill({body:fs.readFileSync(html),contentType:'text/html'}));
   const page=await context.newPage(),errors=[];
   page.on('pageerror',e=>errors.push(String(e)));
   await page.goto('http://127.0.0.1:5174/brawl.html');
   await page.waitForFunction(()=>window.brawl?.state==='menu');
   await page.evaluate(()=>{
    brawl.start({instant:true,ai:false,seed:7391,selected:0,mode:'last'});
    brawl.audio.muted=true;brawl.testFrozen=true;
    const s=brawl.sim;s.beginBoss(0);for(let i=0;i<290;i++)s.step(1/60);brawl.events();
    const b=s.boss;b.phase='battle';b.age=0;b.attack='idle';b.attackAge=0;b.cooldown=1000;
    b.x=0;b.z=-1;b.yaw=Math.PI;b.moving=0;b.hp=b.maxHp;
    [[0,5.8],[-7,6],[7,6],[6,-6]].forEach(([x,z],i)=>{const f=s.fighters[i];f.x=x;f.z=z;f.y=0;f.ko=false;f.hp=100;f.state='idle';f.weaponCooldown=1000;});
    for(const pop of brawl.pops)pop.n.remove();brawl.pops=[];brawl.toastUntil=0;brawl.feed=[];brawl.scene.effects=[];
    document.getElementById('toast').classList.remove('on');document.getElementById('combatfeed').innerHTML='';
    brawl.scene.center=[0,2];brawl.scene.camera=null;
   });
   const sample=async(phase,age)=>page.evaluate(({phase,age})=>{
    const s=brawl.sim,b=s.boss;b.shieldPhase=phase;b.shieldAge=age;b.shieldHitVisual=0;
    brawl.scene.render(s,1/60,'playing');brawl.updateHUD();
    const shield=brawl.scene.bossShield,rig=brawl.scene.crimson.rig;
    const at=name=>{const i=rig.asset.byName.get(name);return Array.from(rig.world[i].subarray(12,15));};
    return{shield,muzzle:brawl.scene.bossMuzzle,bossZ:b.z,clip:rig.clip.name,
     shieldParent:rig.asset.nodes[rig.asset.parents[rig.asset.byName.get('Shield_Mount')]].name,
     hand:at('Hand_L'),mount:at('Shield_Mount'),pelvis:at('Pelvis'),head:at('Head'),heelL:at('Socket_Heel_L'),heelR:at('Socket_Heel_R'),
     label:document.getElementById('bossShieldStatus').textContent,draws:brawl.scene.R.draws,tris:brawl.scene.R.tris};
   },{phase,age});
   const back=await sample('stowed',0);
   await page.screenshot({path:path.join(out,label+'-stowed.png')});
   await page.evaluate(()=>{document.getElementById('bossHud').style.display='none';brawl.scene.center=[0,-3];brawl.scene.camera=null;brawl.scene.render(brawl.sim,1/60,'playing');});
   await page.screenshot({path:path.join(out,label+'-stowed-detail.png')});
   await page.evaluate(()=>{document.getElementById('bossHud').style.display='';brawl.scene.center=[0,2];brawl.scene.camera=null;});
   const swing=await sample('deploy',.43);
   await page.screenshot({path:path.join(out,label+'-deploy.png')});
   const front=await sample('active',2);
   await page.screenshot({path:path.join(out,label+'-active.png')});
   if(!baseline){
    const impact=await page.evaluate(()=>{const s=brawl.sim,b=s.boss,scene=brawl.scene,hp=b.hp;
     s.bossFire(s.fighters[0],true);brawl.events();const beam=scene.effects.findLast(e=>e.kind==='beam');
     scene.render(s,1/60,'playing');return{hpBefore:hp,hpAfter:b.hp,endpoint:beam?.b,shield:scene.bossShield};});
    assert.equal(impact.hpAfter,impact.hpBefore,'the front shield absorbs the projectile');
    assert(Math.hypot(...impact.endpoint.map((v,i)=>v-impact.shield[i]))<.12,'laser visibly ends on the hand-held shield: '+JSON.stringify(impact));
    await page.screenshot({path:path.join(out,label+'-shield-impact.png')});
    await page.evaluate(()=>{brawl.sim.boss.shieldHitVisual=0;brawl.scene.effects=[];});
   }
   const pacing=await page.evaluate(()=>new Promise(resolve=>{const gaps=[];let first=0,last=0;
    const tick=now=>{if(!first)first=now;if(last)gaps.push(now-last);last=now;
     if(now-first<1000){requestAnimationFrame(tick);return;}
     gaps.sort((a,b)=>a-b);resolve({samples:gaps.length,p95Ms:gaps[Math.floor(gaps.length*.95)],over33Ms:gaps.filter(x=>x>33.3).length});};
    requestAnimationFrame(tick);
   }));
   let lockout=null;
   if(!baseline){
    lockout=await page.evaluate(()=>{const s=brawl.sim,b=s.boss;
     b.attack='beam';b.attackAge=.5;b.shots=0;b.targetIds=[0];b.targetPoints=[{x:s.fighters[0].x,z:s.fighters[0].z}];
     s.step(1/60);const events=s.drainEvents();brawl.scene.render(s,1/60,'playing');
     return{attack:b.attack,clip:brawl.scene.crimson.rig.clip.name,laser:events.some(e=>e.type==='bossLaser')};});
    await page.screenshot({path:path.join(out,label+'-shield-cannon-lockout.png')});
    assert.equal(lockout.attack,'idle','pending cannon attack is cancelled during guard');
    assert.equal(lockout.clip,'Guard','shield keeps the defensive pose');
    assert.equal(lockout.laser,false,'no boss laser while using the shield');
   }
   const retract=await sample('retract',.35);
   await page.screenshot({path:path.join(out,label+'-retract.png')});
   assert(retract.shield.every(Number.isFinite));
   await sample('active',2);
   await page.evaluate(()=>{document.getElementById('bossHud').style.display='none';brawl.scene.center=[0,-3];brawl.scene.camera=null;brawl.scene.render(brawl.sim,1/60,'playing');});
   await page.screenshot({path:path.join(out,label+'-active-detail.png')});
   assert(back.shield.every(Number.isFinite)&&front.shield.every(Number.isFinite));
   assert(front.shield[2]>back.shield[2]+.5,'rigged shield must swing to the boss front');
   assert(front.shield[2]>front.bossZ,'deployed shield must stand ahead of the torso');
   if(!baseline){
    assert.equal(front.shieldParent,'Hand_L','shield mount follows the left hand joint');
    assert(front.shield[0]>.45&&front.shield[0]<1.6,'shield guards the boss left side and overlaps the chest');
    assert(Math.hypot(...front.mount.map((v,i)=>v-front.hand[i]))<.43,'shield grip stays beside the left hand');
    assert(front.pelvis[1]<back.pelvis[1]-.18,'boss lowers his center of mass');
    assert(front.head[1]<back.head[1]-.21,'helmet tucks behind the shield');
    assert(front.heelL[0]-front.heelR[0]>back.heelL[0]-back.heelR[0]+.45,'legs widen into a braced stance');
    assert(front.muzzle[2]<front.shield[2]-.2,'inactive cannon retracts behind the shield while guarding');
   }
   assert.equal(front.draws,back.draws,'shield uses its existing skinned draw calls');
   assert.equal(front.tris,back.tris,'shield adds no geometry');
   assert(pacing.p95Ms<24&&pacing.over33Ms<10,'shield pose stays responsive in the browser sample');
   assert.equal(front.clip,'Guard');
   assert.match(front.label,/SHIELD 8s/);
   assert.equal(errors.length,0,errors.join('\n'));
   await page.evaluate(()=>{
    const scene=brawl.scene,begin=scene.R.begin;scene.R._guardBegin=begin;
    scene.R.begin=function(eye,target,fov){return begin.call(this,target.map((v,i)=>v+(eye[i]-v)*.57),target,fov);};
    document.getElementById('bossHud').style.display='none';scene.center=[0,-1];scene.camera=[0,0,0];
    scene.render(brawl.sim,0,'playing');
   });
   await page.screenshot({path:path.join(out,label+'-active-close.png')});
   await page.evaluate(()=>{
    brawl.scene.R.begin=function(){
     const canvas=brawl.scene.R;canvas.eye=[4,4.4,7];
     return canvas._guardBegin.call(canvas,[4,4.4,7],[0,1.55,-1],51);
    };
    brawl.scene.render(brawl.sim,0,'playing');
   });
   await page.screenshot({path:path.join(out,label+'-active-level.png')});
   console.log(JSON.stringify({label,back,swing,front,lockout,retract,pacing,errors}));
   await context.close();
  }
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
