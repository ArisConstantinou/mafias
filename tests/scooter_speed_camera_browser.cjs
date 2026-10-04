const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{createHash}=require('node:crypto'),{execFileSync}=require('node:child_process'),{chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),baselineArg=process.argv.indexOf('--baseline-ref'),baseline=baselineArg>=0,live=process.argv.includes('--live'),published=process.argv.includes('--published'),record=process.argv.includes('--record');
const out=path.join(root,'.qa-run','scooter-speed-shake',baseline?'before':published?'public':live?'local':'after');fs.mkdirSync(out,{recursive:true});
const html=baseline?execFileSync('git',['show',process.argv[baselineArg+1]+':index.html'],{cwd:root,maxBuffer:8*1024*1024}):fs.readFileSync(path.join(root,'index.html'));
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true}),report=[],failures=[];
try{for(const [name,viewport,mobile] of [['desktop',{width:1280,height:800},false],['portrait',{width:430,height:932},true],['landscape',{width:844,height:390},true]]){
 const c=await browser.newContext({viewport,isMobile:mobile,hasTouch:mobile,serviceWorkers:'block',...(record?{recordVideo:{dir:out,size:viewport}}:{})});
 if(!live&&!published)await c.route(/http:\/\/127\.0\.0\.1:5174\/(?:index\.html)?(?:\?.*)?$/,r=>r.fulfill({body:html,contentType:'text/html'}));
 const p=await c.newPage(),errors=[];p.on('pageerror',e=>errors.push(String(e)));p.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
 await p.addInitScript(()=>{let seed=7391;Math.random=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296);});
 const start=Date.now();await p.goto(published?'https://arisconstantinou.github.io/mafias/':'http://127.0.0.1:5174/');await p.waitForFunction(()=>window.voltRoast?.state==='menu',null,{timeout:45000});const loadMs=Date.now()-start;
 const data=await p.evaluate(()=>{
  const g=voltRoast,drive=g.frame.bind(g);g.frame=()=>{};g.selected=0;g.settings.quality='high';requestAnimationFrame=()=>0;
  // Disable damage only in this controlled test; render the original city and scooters.
  g.world.obstacles=[];g.world.pickups=[];g.controlAI=()=>{};
  const samples=[];
  for(const hz of [60,144])for(const boost of [false,true]){
   g.mode='survival';g.start();g.state='racing';g.audio.muted=true;document.getElementById('countdown').style.display='none';
   g.riders.slice(1).forEach((r,i)=>{r.s=200+i*80;r.speed=0;});g.player.speed=boost?26:18;if(boost)g.keys.add('KeyW');
   g.lastClock=0;g.lastFpsTime=0;g.frameCount=0;let clock=0;g.render(0,1);const frames=[];
   for(let i=0;i<hz*10;i++){
    clock+=1000/hz;drive(clock);frames.push({t:g.raceTime,s:g.player.s,lane:g.player.lane,speed:g.player.speed,energy:g.player.energy,boost:g.player.boosting,fov:g.R.fov,lines:Number(document.getElementById('speedLines').style.opacity),driveLabel:g.sticks.left.el.parentElement.querySelector('.stick-title').textContent,engaged:g.sticks.left.el.parentElement.classList.contains('engaged'),shake:g.shake,hp:g.player.hp,hits:g.player.hits});
   }
   const deltas=key=>frames.slice(1).map((r,i)=>Math.abs(r[key]-frames[i][key])),depleted=frames.filter(r=>r.t>7),range=key=>Math.max(...depleted.map(r=>r[key]))-Math.min(...depleted.map(r=>r[key]));
   samples.push({hz,boost,maxFovStep:Math.max(...deltas('fov')),maxLineStep:Math.max(...deltas('lines')),depletedFovRange:range('fov'),depletedLineRange:range('lines'),feedbackFlickers:depleted.slice(1).filter((r,i)=>r.driveLabel!==depleted[i].driveLabel||r.engaged!==depleted[i].engaged).length,boostTransitions:frames.slice(1).filter((r,i)=>r.boost!==frames[i].boost).length,minHp:Math.min(...frames.map(r=>r.hp)),maxShake:Math.max(...frames.map(r=>r.shake)),hits:g.player.hits,maxSpeed:Math.max(...frames.map(r=>r.speed)),fullBoostFov:frames[Math.floor(hz*3)].fov,physics:frames.map(({t,s,lane,speed,energy,boost,hp,hits})=>({t,s,lane,speed,energy,boost,hp,hits}))});
  }
  return samples;
 });
 await p.screenshot({path:path.join(out,name+'.png')});
 for(const s of data){s.physicsSha256=createHash('sha256').update(JSON.stringify(s.physics)).digest('hex');delete s.physics;try{
  assert.equal(s.minHp,100);assert.equal(s.hits,0);assert.equal(s.maxShake,0);assert(s.maxFovStep<.5,JSON.stringify(s));assert(s.maxLineStep<.04,JSON.stringify(s));assert(s.depletedFovRange<.12,JSON.stringify(s));assert(s.depletedLineRange<.01,JSON.stringify(s));assert.equal(s.feedbackFlickers,0,JSON.stringify(s));
  if(s.boost){assert(s.boostTransitions>100);assert(s.maxSpeed>25.9);if(name!=='portrait')assert(s.fullBoostFov>65.9);}
 }catch(e){failures.push({name,hz:s.hz,boost:s.boost,message:e.message});}}
 assert.deepEqual(errors,[]);
 if(record){
  // Real-time input sequence with depleted boost energy, recorded without a synthetic animation.
  await p.evaluate(()=>{const g=voltRoast;g.start();g.state='racing';g.audio.muted=true;document.getElementById('countdown').style.display='none';g.player.speed=26;g.player.energy=.8;g.riders.slice(1).forEach((r,i)=>{r.s=200+i*80;r.speed=0;});});
  if(mobile){const box=await p.locator('#leftStick').boundingBox(),cdp=await c.newCDPSession(p);await cdp.send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:5});await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:box.x+box.width*.5,y:box.y+box.height*.18,id:1}]});}else await p.keyboard.down('KeyW');
  await p.evaluate(()=>new Promise(resolve=>{const g=voltRoast;let previous=performance.now(),start=previous,acc=0;function tick(){const now=performance.now(),dt=Math.min(.05,(now-previous)/1000);previous=now;acc+=dt;while(acc>=1/60){g.update(1/60);acc-=1/60;}g.render(dt,acc*60);if(now-start>=2500)return resolve();setTimeout(tick,1000/60);}tick();}));
 }
 report.push({name,viewport,mobile,loadMs,samples:data,errors});fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({report,failures},null,2));console.log(JSON.stringify({name,loadMs,maxFovStep:Math.max(...data.map(s=>s.maxFovStep)),maxLineStep:Math.max(...data.map(s=>s.maxLineStep)),failedScenarios:failures.filter(f=>f.name===name).length,errors}));
 const video=record?p.video():null;await c.close();if(video){const source=await video.path(),target=path.join(out,name+'.webm');assert(source.startsWith(out+path.sep));fs.renameSync(source,target);}
 }assert.equal(failures.length,0,'Speed camera regression; see report.json');}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
