const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
const baseline=process.env.BRAWL_BASELINE==='1';
const out=path.join(root,'.qa-run',baseline?'boss-orientation-before':'boss-orientation-after');
fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  for(const[label,viewport,mobile]of[['desktop',{width:1280,height:800},false],['mobile',{width:430,height:932},true]]){
   const context=await browser.newContext({viewport,isMobile:mobile,hasTouch:mobile});
   await context.route('**/brawl-viewer.html',route=>route.fulfill({body:fs.readFileSync(path.join(root,'brawl-viewer.html')),contentType:'text/html'}));
   const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(String(e)));
   await page.goto('http://127.0.0.1:5174/brawl-viewer.html');await page.waitForFunction(()=>window.brawlModelViewer?.ready);
   const pose=async(action,angle=0,time=action==='shield'?2:.45)=>page.evaluate(({action,angle,time,mobile})=>{const v=brawlModelViewer;v.setSubject('boss');v.setAction(action,'gameplay');v.playing=false;v.time=time;v.azimuth=angle;v.radius=action==='sword'?(mobile?10:9.2):(mobile?7.5:7.0);v.render();const r=v.scene.crimson.rig,at=n=>Array.from(r.world[r.asset.byName.get(n)].subarray(12,15)),axes=n=>{const m=r.world[r.asset.byName.get(n)];return[Array.from(m.slice(0,3)),Array.from(m.slice(4,7)),Array.from(m.slice(8,11))];};return{muzzle:v.scene.bossMuzzle,shield:v.scene.bossShield,sword:at('Sword'),hand:at('Hand_R'),handRotation:r.rotations[r.asset.byName.get('Hand_R')],handLeftRotation:r.rotations[r.asset.byName.get('Hand_L')],cannonTranslation:r.translations[r.asset.byName.get('Cannon')],forearmAxes:axes('Forearm_L'),shieldPhase:window.__brawlViewer.boss.shieldPhase};},{action,angle,time,mobile});
   const idle=await pose('idle');await page.screenshot({path:path.join(out,`${label}-idle-front.png`)});
   await pose('shield',0,.4);await page.screenshot({path:path.join(out,`${label}-shield-deploy.png`)});
   const guard=await pose('shield');await page.screenshot({path:path.join(out,`${label}-shield-front.png`)});
   await pose('shield',Math.PI/2);await page.screenshot({path:path.join(out,`${label}-shield-side.png`)});
   await pose('shield',0,11.15);await page.screenshot({path:path.join(out,`${label}-shield-retract.png`)});
   await pose('cannon');await page.screenshot({path:path.join(out,`${label}-cannon-front.png`)});
   await pose('sword');await page.screenshot({path:path.join(out,`${label}-sword-front.png`)});
   await pose('sword',Math.PI/2);await page.screenshot({path:path.join(out,`${label}-sword-side.png`)});
   if(!baseline){assert(guard.muzzle[2]<guard.shield[2]-.20,`cannon muzzle must retract behind the shield: ${JSON.stringify(guard)}`);assert(idle.muzzle[2]>idle.shield[2]+.20,'stowed shield clears the cannon');assert(Math.abs(idle.handRotation[1]-.7071)<.01,'right wrist rotates by 90 degrees');assert(Math.abs(idle.handLeftRotation[1]-.7071)<.01,'left wrist rotates by 90 degrees');assert.equal(guard.shieldPhase,'active');}
   assert.equal(errors.length,0,errors.join('\n'));console.log(label,JSON.stringify({idle,guard}));await context.close();
  }
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
