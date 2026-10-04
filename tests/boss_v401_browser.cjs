const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {chromium} = require('playwright');
const root = path.resolve(__dirname, '..');
const before = process.argv.includes('--before');
const published = process.argv.includes('--published');
const live = process.argv.includes('--live');
const url = published ? 'https://arisconstantinou.github.io/mafias/brawl.html' : 'http://127.0.0.1:5174/brawl.html';
const label = before ? 'before' : published ? 'public' : live ? 'local' : 'after';
const out = path.join(root, '.qa-run', 'boss-v401', label);
fs.mkdirSync(out, {recursive:true});

// The same deterministic fight and camera are used for both asset versions.
async function encounter(page) {
  await page.evaluate(() => {
    brawl.start({instant:true,ai:false,seed:7391,selected:0,mode:'last'});
    brawl.audio.muted=true;brawl.testFrozen=true;
    const s=brawl.sim;s.beginBoss(0);
    for(let i=0;i<285;i++)s.step(1/60);
    brawl.events();
    const b=s.boss;Object.assign(b,{phase:'battle',age:0,attack:'idle',attackAge:0,x:0,z:-1,yaw:Math.PI,moving:0,hp:b.maxHp,shieldPhase:'stowed',hitVisual:0,aimHold:0});
    [[0,5.8],[-7,6],[7,6],[6,-6]].forEach(([x,z],i)=>Object.assign(s.fighters[i],{x,z,y:0,ko:false,hp:100,state:'idle'}));
    for(const pop of brawl.pops)pop.n.remove();brawl.pops=[];brawl.toastUntil=0;brawl.feed=[];brawl.scene.effects=[];
    document.getElementById('toast').classList.remove('on');document.getElementById('combatfeed').innerHTML='';
    brawl.scene.center=[0,2];brawl.scene.camera=null;brawl.scene.render(s,1/60,'playing');brawl.updateHUD();
  });
}

(async()=>{
  const browser=await chromium.launch({channel:'chrome',headless:true});
  const report=[];
  try {
    for(const [name,viewport,mobile] of [['desktop',{width:1280,height:800},false],['portrait',{width:430,height:932},true],['landscape',{width:844,height:390},true]]) {
      const context=await browser.newContext({viewport,isMobile:mobile,hasTouch:mobile,serviceWorkers:'block'});
      if(!before&&!published&&!live)await context.route('**/brawl.html',route=>route.fulfill({body:fs.readFileSync(path.join(root,'brawl.html')),contentType:'text/html'}));
      const page=await context.newPage();const errors=[];
      page.on('pageerror',e=>errors.push(String(e)));
      const start=Date.now();await page.goto(url);await page.waitForFunction(()=>window.brawl?.state==='menu',null,{timeout:90000});
      const loadMs=Date.now()-start;
      await encounter(page);
      await page.screenshot({path:path.join(out,name+'.png')});
      const basic=await page.evaluate(()=>{
        const a=brawl.scene.crimson.asset,s=brawl.scene,R=s.R,gl=R.gl,ext=gl.getExtension('WEBGL_debug_renderer_info');
        return {bones:a.json.skins[0].joints.length,clips:a.clips.map(c=>c.name),triangles:R.tris,draws:R.draws,gpuSkin:s.crimson.gpuSkin,batches:s.crimson.batches.length,glError:gl.getError(),heap:performance.memory?.usedJSHeapSize,renderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),overflow:document.documentElement.scrollWidth>innerWidth};
      });
      const pacing=await page.evaluate(()=>new Promise(resolve=>{
        const frames=[],cpu=[];let last=null;
        function tick(now){if(last!==null)frames.push(now-last);last=now;const t=performance.now();brawl.scene.render(brawl.sim,1/60,'playing');cpu.push(performance.now()-t);
          if(cpu.length<120){requestAnimationFrame(tick);return;}
          const stats=a=>{const s=a.slice().sort((a,b)=>a-b);return{median:s[Math.floor(s.length*.5)],p95:s[Math.floor(s.length*.95)],max:s.at(-1),over33:s.filter(x=>x>33.3).length};};resolve({samples:cpu.length,rafMs:stats(frames),renderCpuMs:stats(cpu)});
        }requestAnimationFrame(tick);
      }));
      const row={name,loadMs,...basic,pacing};report.push(row);
      fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));
      console.log(JSON.stringify(row));
      assert(!basic.overflow,'No horizontal overflow');assert.equal(basic.glError,0);assert.equal(errors.length,0,errors.join('\n'));
      if(!before) {
        assert.equal(basic.bones,75,'Updated v401 skeleton is the default');assert.equal(basic.clips.length,23);assert(basic.gpuSkin);
        const mapping=await page.evaluate(()=>{
          const s=brawl.sim,b=s.boss,scene=brawl.scene,result={};
          const sample=(name,fields)=>{Object.assign(b,{phase:'battle',age:0,attack:'idle',attackAge:0,moving:0,shieldPhase:'stowed',hitVisual:0,aimHold:0,...fields});b.attackSerial++;scene.bossClipKey='';scene.render(s,1/60,'playing');result[name]=scene.crimson.rig.clip.name;};
          sample('run',{moving:1});const palette=Array.from(scene.crimson.rig.palette);for(let i=0;i<20;i++)scene.render(s,1/60,'playing');result.runMoves=palette.some((v,i)=>Math.abs(v-scene.crimson.rig.palette[i])>1e-4);
          sample('charge',{attack:'charge'});sample('fire',{attack:'beam'});sample('stomp',{attack:'slamWind'});sample('grab',{attack:'claw'});sample('deploy',{shieldPhase:'deploy'});sample('guard',{shieldPhase:'active'});sample('retract',{shieldPhase:'retract'});sample('hit',{hitVisual:.2});sample('aim',{aimHold:1});sample('defeat',{phase:'dead'});sample('resurrect',{phase:'resurrect',age:1.8});sample('taunt',{phase:'laugh'});
          result.sockets=['Socket_Muzzle','Socket_Shield','Socket_Grab'].map(n=>scene.crimson.socket(n).position.every(Number.isFinite));
          result.allClips=scene.crimson.asset.clips.every(c=>{scene.crimson.play(c.name,{fade:0});scene.crimson.rig.seek(c.extras.duration*.5);return Array.from(scene.crimson.rig.palette).every(Number.isFinite);});
          scene.crimson.play('Run',{fade:0});scene.crimson.rig.seek(0);const first=Array.from(scene.crimson.rig.palette);scene.crimson.rig.seek(.84);result.runSeam=Math.max(...first.map((v,i)=>Math.abs(v-scene.crimson.rig.palette[i])));
          return result;
        });
        assert.deepEqual([mapping.run,mapping.charge,mapping.fire,mapping.stomp,mapping.grab,mapping.deploy,mapping.guard,mapping.retract,mapping.hit,mapping.aim,mapping.defeat,mapping.resurrect,mapping.taunt],['Run','Cannon_Charge','Cannon_Fire','Stomp','Grab_Throw','Guard_Deploy','Guard','Guard_Retract','Hit_Reaction','Aim','Defeat_Kneel','Resurrect','Taunt']);
        assert(mapping.runMoves&&mapping.allClips&&mapping.sockets.every(Boolean));assert(mapping.runSeam<1e-5);
        row.mapping=mapping;
        await encounter(page);
        // Actual controls must still damage the boss in the new model's fight.
        await page.evaluate(()=>{const f=brawl.sim.fighters[0];f.x=0;f.z=3;f.inv=10;brawl.scene.render(brawl.sim,0,'playing');brawl.updateHUD();});
        const hp=await page.evaluate(()=>brawl.sim.boss.hp);
        if(mobile)await page.locator('[data-action="punch"]').tap();else await page.keyboard.press('j');
        await page.evaluate(()=>brawl.sim.step(1/60));
        assert(await page.evaluate(()=>brawl.sim.boss.hp)<hp,'Fire control damages boss');
        const hp2=await page.evaluate(()=>{brawl.sim.fighters[0].weaponCooldown=0;return brawl.sim.boss.hp;});
        if(mobile)await page.locator('[data-action="kick"]').tap();else await page.keyboard.press('k');
        await page.evaluate(()=>brawl.sim.step(1/60));assert(await page.evaluate(()=>brawl.sim.boss.hp)<hp2,'Power control damages boss');
        for(const [pose,fields,frames] of [['run',{moving:1},12],['guard',{shieldPhase:'active'},18],['grab',{attack:'claw'},26],['resurrection',{phase:'resurrect',age:1.8},1]]) {
          await encounter(page);await page.evaluate(({fields,frames})=>{Object.assign(brawl.sim.boss,fields);for(let i=0;i<frames;i++)brawl.scene.render(brawl.sim,1/60,'playing');},{fields,frames});
          await page.screenshot({path:path.join(out,name+'-'+pose+'.png')});
        }
        await encounter(page);
        const grabContact=await page.evaluate(()=>{
          const s=brawl.sim,b=s.boss,f=s.fighters[0],scene=brawl.scene;
          Object.assign(b,{attack:'claw',attackAge:0,targetIds:[0],grabbed:null});b.attackSerial++;
          Object.assign(f,{x:0,z:1,hp:100,inv:0,state:'idle'});
          let grasped=false,maxGap=0,headBefore=null,releaseHeadShift=null;
          for(let i=0;i<88;i++){
            s.step(1/60);scene.render(s,1/60,'playing');
            if(f.state==='bossGrabbed'){grasped=true;maxGap=Math.max(maxGap,Math.hypot(...f.renderGrabShoulder.map((v,i)=>v-scene.bossGrabSocket[i])));headBefore=f.renderHead.slice();}
            else if(headBefore&&f.state==='bossThrown'&&releaseHeadShift===null)releaseHeadShift=Math.hypot(...f.renderHead.map((v,i)=>v-headBefore[i]));
          }
          return {grasped,maxGap,releaseHeadShift,state:f.state};
        });
        assert(grabContact.grasped,'Actual combat grasp occurs');assert(grabContact.maxGap<1e-5,'Victim shoulder follows the authored hand socket');assert(grabContact.releaseHeadShift<.35,'Release preserves visual continuity');
        row.grabContact=grabContact;
        await page.screenshot({path:path.join(out,name+'-actual-throw.png')});
        // Shield defence and the visible beam endpoint remain in agreement.
        await encounter(page);
        const shield=await page.evaluate(()=>{
          const s=brawl.sim,b=s.boss,f=s.fighters[0],scene=brawl.scene;
          Object.assign(b,{x:0,z:0,yaw:Math.PI,shieldPhase:'active',shieldAge:1});Object.assign(f,{x:0,z:4,inv:0,weaponCooldown:0});
          scene.render(s,1/60,'playing');const hp=b.hp;s.bossFire(f,false);const event=s.drainEvents().find(e=>e.type==='laserShot');
          scene.onEvent(event,s);return {blocked:!!event.shieldBlock,before:hp,after:b.hp,shield:scene.bossShield};
        });
        assert(shield.blocked&&shield.before===shield.after&&shield.shield.every(Number.isFinite));row.shield=shield;
        await page.keyboard.press('Escape');assert.equal(await page.evaluate(()=>brawl.state),'paused');await page.keyboard.press('Escape');assert.equal(await page.evaluate(()=>brawl.state),'playing');
        assert.equal(errors.length,0,errors.join('\n'));assert.equal(await page.evaluate(()=>brawl.scene.R.gl.getError()),0);
      }
      fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));
      await context.close();
    }
  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
