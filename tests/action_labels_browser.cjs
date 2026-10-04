const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
const publicMode=process.argv.includes('--published'),live=process.argv.includes('--live');
const out=path.join(root,'.qa-run','action-key-labels',publicMode?'public':live?'local':'after');
fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true}),report=[];
 try{
  for(const [name,viewport,mobile] of [['desktop',{width:1280,height:800},false],['short-desktop',{width:844,height:390},false],['mobile',{width:430,height:932},true],['small-mobile',{width:320,height:640},true],['landscape-touch',{width:844,height:390},true]]){
   const context=await browser.newContext({viewport,isMobile:mobile,hasTouch:mobile,serviceWorkers:'block'});
   if(!publicMode&&!live)await context.route('**/brawl.html',r=>r.fulfill({body:fs.readFileSync(path.join(root,'brawl.html')),contentType:'text/html'}));
   const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(String(e)));
   await page.goto(publicMode?'https://arisconstantinou.github.io/mafias/brawl.html':'http://127.0.0.1:5174/brawl.html');
   await page.waitForFunction(()=>window.brawl?.state==='menu',null,{timeout:90000});
   await page.evaluate(()=>{brawl.start({instant:true,ai:false,seed:7391,selected:0,mode:'score'});brawl.testFrozen=true;brawl.audio.muted=true;brawl.updateHUD();});
   const inspect=()=>page.locator('.combat').evaluateAll(buttons=>buttons.filter(b=>b.getBoundingClientRect().width).map(b=>{
    const k=b.querySelector('kbd'),title=b.querySelector('b'),s=getComputedStyle(k),r=k.getBoundingClientRect(),t=title.getBoundingClientRect(),box=b.getBoundingClientRect();
    return{action:title.textContent,key:k.textContent,font:parseFloat(s.fontSize),labelFont:parseFloat(getComputedStyle(title).fontSize),visible:s.display!=='none'&&r.width>0,inside:r.top>=box.top&&r.bottom<=box.bottom&&r.left>=box.left&&r.right<=box.right&&t.bottom<=box.bottom+.5,x:box.x,right:box.right,bottom:box.bottom};
   }));
   const check=keys=>{assert(keys.every(k=>k.visible&&k.font>=16&&k.labelFont>=12&&k.inside),JSON.stringify(keys));};
   const normal=await inspect();check(normal);assert.deepEqual(normal.map(k=>k.key),['1','2','3','4','5']);
   if(!mobile&&viewport.width>=651)assert(normal.every((k,i)=>!i||k.x>normal[i-1].x),'Desktop actions follow numeric order');
   assert(normal.every(k=>k.x>=0&&k.right<=viewport.width&&k.bottom<=viewport.height),'Controls fit viewport');
   await page.screenshot({path:path.join(out,name+'.png')});
   await page.evaluate(()=>{const p=brawl.sim.fighters[0];p.comboReady='heavy';p.comboUntil=brawl.sim.time+4;p.stamina=100;brawl.updateHUD();});
   const combo=await inspect();check(combo);assert.equal(combo[0].action,'HEAVY PUNCH');assert.equal(combo[0].key,'1');
   await page.screenshot({path:path.join(out,name+'-combo.png')});
   await page.evaluate(()=>{const s=brawl.sim,p=s.fighters[0];p.comboReady=null;s.beginBoss(0);for(let i=0;i<290;i++)s.step(1/60);brawl.events();brawl.updateHUD();});
   const boss=await inspect();check(boss);assert.deepEqual(boss.map(k=>[k.key,k.action]),[['1','FIRE'],['2','POWER'],['3','DODGE']]);
   await page.screenshot({path:path.join(out,name+'-boss.png')});
   const pacing=await page.evaluate(()=>new Promise(resolve=>{let last=null;const samples=[];const tick=t=>{if(last!==null)samples.push(t-last);last=t;if(samples.length<90)return requestAnimationFrame(tick);const sorted=samples.slice().sort((a,b)=>a-b);resolve({samples:samples.length,p95:sorted[Math.floor(sorted.length*.95)],max:sorted.at(-1),over33:sorted.filter(n=>n>33.3).length,draws:brawl.scene.R.draws,triangles:brawl.scene.R.tris});};requestAnimationFrame(tick);}));
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.equal(errors.length,0,errors.join('\n'));
   report.push({name,normal,combo,boss,pacing,errors});fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));
   console.log(JSON.stringify({name,keys:normal.map(k=>k.key),font:normal[0].font,pacing}));await context.close();
  }
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
