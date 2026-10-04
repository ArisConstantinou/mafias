const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
const html=process.env.BRAWL_VIEWER_HTML||path.join(root,'brawl-viewer.html');
const out=path.join(root,'.qa-run','brawl-viewer');
fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  for(const [label,viewport,mobile] of [['desktop',{width:1280,height:800},false],['mobile',{width:430,height:932},true]]){
   const context=await browser.newContext({viewport,isMobile:mobile,hasTouch:mobile});
   await context.route('**/brawl-viewer.html',route=>route.fulfill({body:fs.readFileSync(html),contentType:'text/html'}));
   const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(String(e)));
   const urlIndex=process.argv.indexOf('--url');await page.goto(urlIndex<0?'http://127.0.0.1:5174/brawl-viewer.html':process.argv[urlIndex+1]);
   await page.waitForFunction(()=>window.brawlModelViewer?.ready,{timeout:30000});
   const clips=await page.evaluate(()=>brawlModelViewer.scene.crimson.asset.clips.map(c=>c.name));
   assert.equal(clips.length,23);assert(clips.includes('Walk')&&clips.includes('Run')&&clips.includes('Guard'));
   const allActions=await page.evaluate(()=>{const v=brawlModelViewer,failures=[];for(const clip of v.scene.crimson.asset.clips){try{v.setSubject('boss');v.setAction(clip.name,'rig');v.time=clip.extras.duration*.5;v.render();}catch(e){failures.push(clip.name+': '+e.message);}}for(const a of VIEWER_BOSS_ACTIONS){try{v.setSubject('boss');v.setAction(a.id,'gameplay');v.time=a.duration*.5;v.render();}catch(e){failures.push(a.id+': '+e.message);}}for(const a of VIEWER_CREW_ACTIONS){try{v.setSubject('0');v.setAction(a.id,'gameplay');v.time=a.duration*.5;v.render();}catch(e){failures.push(a.id+': '+e.message);}}v.setSubject('all');v.render();return{boss:VIEWER_BOSS_ACTIONS.length,crew:VIEWER_CREW_ACTIONS.length,failures};});
   assert.deepEqual(allActions.failures,[]);
   await page.screenshot({path:path.join(out,`${label}-lineup.png`),fullPage:mobile});
   const select=async(subject,action,group='gameplay',time=.5)=>page.evaluate(({subject,action,group,time})=>{const v=brawlModelViewer;v.setSubject(subject);v.setAction(action,group);v.time=time;v.playing=false;v.render();return window.__brawlViewer;},{subject,action,group,time});
   const walk=await select('boss','Walk','rig',.4);assert.equal(walk.boss.clip,'Walk');
   await page.screenshot({path:path.join(out,`${label}-boss-walk.png`)});
   const run=await select('boss','Run','rig',.4);assert.equal(run.boss.clip,'Run');
   await page.screenshot({path:path.join(out,`${label}-boss-run.png`)});
   const motion=await page.evaluate(()=>{const v=brawlModelViewer,out={};for(const clip of ['Walk','Run']){v.setAction(clip,'rig');v.playing=false;v.time=.12;v.render();const first=Array.from(v.scene.crimson.rig.palette);v.time=.58;v.render();const second=v.scene.crimson.rig.palette;out[clip]=first.reduce((sum,x,i)=>sum+Math.abs(x-second[i]),0);}return out;});
   assert(motion.Walk>1&&motion.Run>1,JSON.stringify(motion));
   const shield=await select('boss','shield','gameplay',2);assert.equal(shield.boss.shieldPhase,'active');assert.equal(shield.boss.clip,'Guard');assert.equal(shield.boss.attack,'idle');
   await page.screenshot({path:path.join(out,`${label}-shield.png`)});
   const grab=await select('boss','grab','gameplay',1.7);assert.equal(grab.boss.clip,'Grab_Throw');
   await page.screenshot({path:path.join(out,`${label}-throw.png`)});
   const resurrection=await select('boss','resurrect','gameplay',2.1);assert.equal(resurrection.boss.clip,'Resurrect');
   await page.screenshot({path:path.join(out,`${label}-resurrection.png`)});
   const fighter=await select('0','spin','gameplay',.6);assert.equal(fighter.boss,null);
   await page.screenshot({path:path.join(out,`${label}-fighter-spin.png`)});
   const before=await page.evaluate(()=>window.__brawlViewer.azimuth);const box=await page.locator('#viewerCanvas').boundingBox();
   await page.mouse.move(box.x+box.width*.5,box.y+box.height*.5);await page.mouse.down();await page.mouse.move(box.x+box.width*.62,box.y+box.height*.5,{steps:4});await page.mouse.up();
   assert.notEqual(await page.evaluate(()=>window.__brawlViewer.azimuth),before);
   const radius=await page.evaluate(()=>window.__brawlViewer.radius);await page.mouse.wheel(0,200);assert.notEqual(await page.evaluate(()=>window.__brawlViewer.radius),radius);
   const pacing=await page.evaluate(()=>new Promise(resolve=>{const gaps=[];let first=0,last=0;const tick=now=>{if(!first)first=now;if(last)gaps.push(now-last);last=now;if(now-first<1000){requestAnimationFrame(tick);return;}gaps.sort((a,b)=>a-b);resolve({samples:gaps.length,p95Ms:gaps[Math.floor(gaps.length*.95)],over33Ms:gaps.filter(x=>x>33.3).length});};requestAnimationFrame(tick);}));
   const ui=await page.evaluate(()=>({status:document.getElementById('loadStatus').textContent,overflow:document.documentElement.scrollWidth-innerWidth,draws:window.__brawlViewer.draws,tris:window.__brawlViewer.triangles,buttons:[...document.querySelectorAll('.subjects button')].map(b=>({w:b.getBoundingClientRect().width,h:b.getBoundingClientRect().height}))}));
   assert.equal(ui.status,'READY');assert(ui.overflow<=1,JSON.stringify(ui));assert(ui.buttons.every(b=>b.h>=44));assert.equal(errors.length,0,errors.join('\n'));
   console.log(label,JSON.stringify({clips:clips.length,allActions,ui,pacing,shield,walk,run}));await context.close();
  }
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
