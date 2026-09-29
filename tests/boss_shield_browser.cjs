const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
const out=path.join(root,'.qa-run','boss-shield');
fs.mkdirSync(out,{recursive:true});

(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  for(const [label,viewport,mobile] of [['mobile',{width:430,height:932},true],['desktop',{width:1280,height:800},false]]){
   const context=await browser.newContext({viewport,isMobile:mobile,hasTouch:mobile});
   await context.route('**/brawl.html',route=>route.fulfill({body:fs.readFileSync(path.join(root,'brawl.html')),contentType:'text/html'}));
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
    const shield=brawl.scene.bossShield;
    return{shield,bossZ:b.z,clip:brawl.scene.crimson.rig.clip.name,
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
   const pacing=await page.evaluate(()=>new Promise(resolve=>{const gaps=[];let first=0,last=0;
    const tick=now=>{if(!first)first=now;if(last)gaps.push(now-last);last=now;
     if(now-first<1000){requestAnimationFrame(tick);return;}
     gaps.sort((a,b)=>a-b);resolve({samples:gaps.length,p95Ms:gaps[Math.floor(gaps.length*.95)],over33Ms:gaps.filter(x=>x>33.3).length});};
    requestAnimationFrame(tick);
   }));
   const cannon=await page.evaluate(()=>{const s=brawl.sim,b=s.boss;b.attack='charge';b.attackSerial++;b.attackAge=.3;
    brawl.scene.render(s,1/60,'playing');return{clip:brawl.scene.crimson.rig.clip.name,shield:brawl.scene.bossShield};});
   await page.screenshot({path:path.join(out,label+'-shield-cannon.png')});
   assert.equal(cannon.clip,'Cannon_Fire','shield stays deployed during cannon firing');
   assert(cannon.shield[2]>front.bossZ,'cannon clip keeps the shield ahead of the boss');
   await page.evaluate(()=>{brawl.sim.boss.attack='idle';});
   const retract=await sample('retract',.35);
   await page.screenshot({path:path.join(out,label+'-retract.png')});
   assert(retract.shield.every(Number.isFinite));
   await sample('active',2);
   await page.evaluate(()=>{document.getElementById('bossHud').style.display='none';brawl.scene.center=[0,-3];brawl.scene.camera=null;brawl.scene.render(brawl.sim,1/60,'playing');});
   await page.screenshot({path:path.join(out,label+'-active-detail.png')});
   assert(back.shield.every(Number.isFinite)&&front.shield.every(Number.isFinite));
   assert(front.shield[2]>back.shield[2]+.5,'rigged shield must swing to the boss front');
   assert(front.shield[2]>front.bossZ,'deployed shield must stand ahead of the torso');
   assert.equal(front.draws,back.draws,'shield uses its existing skinned draw calls');
   assert.equal(front.tris,back.tris,'shield adds no geometry');
   assert.equal(pacing.over33Ms,0,'shield pose has no long browser frame');
   assert.equal(front.clip,'Guard');
   assert.match(front.label,/SHIELD 8s/);
   assert.equal(errors.length,0,errors.join('\n'));
   console.log(JSON.stringify({label,back,swing,front,cannon,retract,pacing,errors}));
   await context.close();
  }
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
