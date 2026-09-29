const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
const out=path.join(root,'.qa-run','crimson-boss');
fs.mkdirSync(out,{recursive:true});
const url='http://127.0.0.1:5174/brawl.html';
const cases=['before','candidate'];
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  for(const label of cases){
   const context=await browser.newContext({viewport:{width:430,height:932},isMobile:true,hasTouch:true});
   if(label==='candidate')await context.route('**/brawl.html',route=>route.fulfill({body:fs.readFileSync(path.join(root,'brawl.html')),contentType:'text/html'}));
   const page=await context.newPage();const errors=[];
   page.on('pageerror',e=>errors.push(String(e)));
   const loadStart=Date.now();await page.goto(url);await page.waitForFunction(()=>window.brawl?.state==='menu');
   const loadMs=Date.now()-loadStart;
   await page.evaluate(()=>{
    brawl.start({instant:true,ai:false,seed:7391,selected:0,mode:'last'});
    brawl.audio.muted=true;brawl.testFrozen=true;
    const s=brawl.sim;s.beginBoss(0);
    for(let i=0;i<285;i++)s.step(1/60);
    brawl.events();
    const b=s.boss;b.phase='battle';b.age=0;b.attack='idle';b.attackAge=0;b.x=0;b.z=-1;b.yaw=Math.PI;b.moving=0;b.hp=b.maxHp;
    [[0,5.8],[-7,6],[7,6],[6,-6]].forEach(([x,z],i)=>{const f=s.fighters[i];f.x=x;f.z=z;f.y=0;f.ko=false;f.hp=100;f.state='idle';});
    for(const pop of brawl.pops)pop.n.remove();brawl.pops=[];brawl.toastUntil=0;brawl.feed=[];brawl.scene.effects=[];
    document.getElementById('toast').classList.remove('on');document.getElementById('combatfeed').innerHTML='';
    brawl.scene.center=[0,2];brawl.scene.camera=null;brawl.scene.render(s,1/60,'playing');brawl.updateHUD();
   });
   await page.waitForTimeout(200);
   await page.screenshot({path:path.join(out,label+'-portrait.png')});
   const basic=await page.evaluate(()=>{
    const scene=brawl.scene,b=brawl.sim.boss,ground=scene.R.project([b.x,0,b.z]);
    let heel=null;if(scene.crimson){const m=M4.trs([b.x,0,b.z],[0,b.yaw+Math.PI,0],[1.65,1.65,1.65]);heel=scene.crimson.socket('Socket_Heel_R',m).position;}
    return{draws:scene.R.draws,tris:scene.R.tris,boss:!!b,face:document.querySelector('#bossHud b').textContent,
     groundY:ground.y,heel,heelY:heel?scene.R.project(heel).y:null};
   });
   basic.loadMs=loadMs;
   basic.pacing=await page.evaluate(()=>new Promise(resolve=>{
    const frames=[];let first=0,last=0;
    const tick=now=>{if(!first)first=now;if(last)frames.push(now-last);last=now;
     if(now-first<1100){requestAnimationFrame(tick);return;}
     frames.sort((a,b)=>a-b);resolve({samples:frames.length,p95Ms:frames[Math.floor(frames.length*.95)],maxMs:frames.at(-1),over33Ms:frames.filter(x=>x>33.3).length});};
    requestAnimationFrame(tick);
   }));
   if(label==='candidate'){
    const clips=await page.evaluate(()=>{
     const s=brawl.sim,b=s.boss,scene=brawl.scene,result={};
     const sample=(name,phase,attack,moving,age=0)=>{b.phase=phase;b.attack=attack;b.moving=moving;b.age=age;b.attackSerial++;scene.render(s,1/60,'playing');result[name]=scene.crimson.rig.clip.name;};
     sample('run','battle','idle',1);
     const pose0=Array.from(scene.crimson.rig.palette);
     for(let i=0;i<20;i++)scene.render(s,1/60,'playing');
     result.runPoseChanged=pose0.some((v,i)=>Math.abs(v-scene.crimson.rig.palette[i])>1e-4);
     sample('cannon','battle','charge',0);
     sample('stomp','battle','slamWind',0);
     sample('sword','battle','claw',0);
     b.aimHold=1;sample('guard','battle','idle',0);b.aimHold=0;
     b.hitVisual=.2;b.visualHitSerial=1;sample('hit','battle','idle',0);b.hitVisual=0;
     sample('defeat','dead','idle',0);
     sample('resurrect','resurrect','idle',0,1.8);
     sample('laugh','laugh','idle',0);
     result.muzzle=scene.crimson.socket('Socket_Muzzle').position;
     result.gpuSkin=scene.crimson.gpuSkin;
     result.batches=scene.crimson.batches.length;
     return result;
    });
    assert.deepEqual([clips.run,clips.cannon,clips.stomp,clips.sword,clips.guard,clips.hit,clips.defeat,clips.resurrect,clips.laugh],['Run','Cannon_Fire','Stomp','Sword_Slash','Guard','Hit_Reaction','Defeat_Kneel','Spawn','Taunt']);
    assert(clips.runPoseChanged,'Run bones animate');
    assert(clips.muzzle.every(Number.isFinite),'Muzzle socket remains finite');
    assert(clips.gpuSkin,'GPU skinning is active');
    for(const [pose,attack,frames] of [['cannon','charge',43],['stomp','slamWind',48],['sword','claw',33]]){
     await page.evaluate(({attack,frames})=>{const s=brawl.sim,b=s.boss;b.phase='battle';b.attack=attack;b.attackAge=0;b.attackSerial++;b.aimHold=0;b.moving=0;
      for(let i=0;i<frames;i++)brawl.scene.render(s,1/60,'playing');},{attack,frames});
     await page.screenshot({path:path.join(out,pose+'-portrait.png')});
    }
    await page.evaluate(()=>{const s=brawl.sim,b=s.boss;b.phase='resurrect';b.age=1.8;b.attack='idle';
     for(let i=0;i<35;i++)brawl.scene.render(s,1/60,'playing');});
    await page.screenshot({path:path.join(out,'resurrection-portrait.png')});
    console.log(JSON.stringify({label,...basic,clips}));
   }else console.log(JSON.stringify({label,...basic}));
   assert.equal(errors.length,0,errors.join('\n'));
   await context.close();
  }
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
