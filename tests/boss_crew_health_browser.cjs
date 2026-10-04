const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),published=process.argv.includes('--published'),live=process.argv.includes('--live');
const out=path.join(root,'.qa-run','boss-crew-health',published?'public':live?'local':'after');fs.mkdirSync(out,{recursive:true});
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true}),report=[];
try{for(const [name,viewport,mobile] of [['desktop',{width:1280,height:800},false],['portrait',{width:430,height:932},true],['landscape',{width:844,height:390},true]]){
 const c=await browser.newContext({viewport,isMobile:mobile,hasTouch:mobile,serviceWorkers:'block'});
 if(!live&&!published)await c.route('**/brawl.html',r=>r.fulfill({body:fs.readFileSync(path.join(root,'brawl.html')),contentType:'text/html'}));
 const p=await c.newPage(),errors=[];p.on('pageerror',e=>errors.push(String(e)));p.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
 const start=Date.now();await p.goto(published?'https://arisconstantinou.github.io/mafias/brawl.html':'http://127.0.0.1:5174/brawl.html');await p.waitForFunction(()=>window.brawl?.state==='menu',null,{timeout:90000});const loadMs=Date.now()-start;
 if(name==='desktop'){
  await p.locator('#settingsButton').click();await p.locator('#crewStyle').selectOption('stylized');
  assert.equal(await p.evaluate(()=>brawl.scene.crew.style),'stylized');
  await p.reload();await p.waitForFunction(()=>window.brawl?.state==='menu',null,{timeout:90000});
  assert.equal(await p.locator('#crewStyle').inputValue(),'stylized');
  assert.equal(await p.evaluate(()=>brawl.scene.crew.style),'stylized');
  await p.locator('#settingsButton').click();await p.locator('#crewStyle').selectOption('tactical');await p.locator('#closeSettings').click();
 }
 await p.evaluate(()=>{brawl.start({instant:true,ai:false,seed:7391,selected:0,mode:'score'});brawl.audio.muted=true;brawl.testFrozen=true;brawl.scene.center=[0,0];brawl.scene.camera=null;brawl.updateHUD();});
 await p.screenshot({path:path.join(out,name+'-normal.png')});
 const rigs=await p.evaluate(()=>{
  const S=brawl.scene,C=S.crew,rows=[];S.renderState='viewer';
  for(const style of ['tactical','stylized']){C.setStyle(style);const entry=C.styles[style];
   for(const clip of entry.asset.clips)for(const fraction of [0,.25,.5,.75,.99]){
    const f={...brawl.sim.newFighter(0),viewerAnimation:clip.name,viewerTime:clip.extras.duration*fraction};
    const laser=clip.name.startsWith('Laser'),sim={...brawl.sim,boss:laser?{phase:'battle'}:null};S.R.begin([3,2,5],[0,1.4,0],49);S.visualDt=1/60;S.drawFighter(f,sim);
    const contact=C.contacts[0],rig=entry.rigs[0],gap=(a,b)=>Math.hypot(...a.map((x,i)=>x-b[i]));
    rows.push({style,clip:clip.name,fraction,finite:Array.from(rig.palette).every(Number.isFinite),primary:laser?gap(contact.right,contact.grip):0,support:laser?gap(contact.left,contact.support):0,draws:S.R.draws,triangles:S.R.tris});
   }
  }C.setStyle('tactical');S.renderState='playing';return{rows,glError:S.R.gl.getError(),bones:C.styles.tactical.asset.json.skins[0].joints.length};
 });
 assert.equal(rigs.bones,52);assert.equal(rigs.rows.length,200);assert.equal(rigs.glError,0);
 for(const r of rigs.rows){assert(r.finite,JSON.stringify(r));assert(r.primary<.0001&&r.support<.018,JSON.stringify(r));assert(r.triangles<29000,JSON.stringify(r));}
 await p.evaluate(()=>{const s=brawl.sim;s.fighters[0].hp=42;s.fighters[1].ko=true;s.fighters[1].hp=0;s.beginBoss(0);for(let i=0;i<145;i++){s.step(1/60);brawl.scene.render(s,1/60,'playing');}brawl.events();brawl.scene.center=[0,0];brawl.scene.camera=null;brawl.scene.render(s,0,'playing');brawl.updateHUD();});
 const arrival=await p.evaluate(()=>({players:brawl.sim.fighters.map(f=>({hp:f.hp,ko:f.ko,state:f.state,squad:f.bossSquad})),pops:brawl.pops.map(p=>p.n.textContent),clips:Object.values(brawl.scene.crew.contacts).map(c=>c.clip)}));
 assert(arrival.players.every(f=>f.hp===100&&!f.ko&&f.state==='idle'));assert(!arrival.pops.includes('REVIVED'));assert(arrival.clips.every(c=>c.startsWith('Laser')));
 await p.screenshot({path:path.join(out,name+'-arrival.png')});
 await p.evaluate(()=>{for(let i=0;i<145;i++){brawl.sim.step(1/60);brawl.scene.render(brawl.sim,1/60,'playing');}brawl.events();brawl.scene.center=[0,0];brawl.scene.camera=null;brawl.updateHUD();});
 await p.screenshot({path:path.join(out,name+'-boss.png')});
 const metrics=await p.evaluate(()=>new Promise(resolve=>{let last=null;const frames=[],cpu=[];function tick(t){if(last!==null)frames.push(t-last);last=t;cpu.push(brawl.frameMs);if(frames.length<120)return requestAnimationFrame(tick);const stat=a=>{const s=a.slice(20).sort((x,y)=>x-y);return{p95:s[Math.floor(s.length*.95)],max:s.at(-1)};};resolve({raf:stat(frames),cpu:stat(cpu),over33:frames.slice(20).filter(n=>n>33.3).length,draws:brawl.scene.R.draws,triangles:brawl.scene.R.tris,crew:!!brawl.scene.crew,heap:performance.memory?.usedJSHeapSize,pickups:brawl.scene.visibleHealthPickups});}requestAnimationFrame(tick);}));
 assert.equal(metrics.pickups.length,4);
 const framing=await p.evaluate(()=>brawl.sim.fighters.map(f=>brawl.scene.R.project(f.renderHead)));assert(framing.every(v=>v.x>12&&v.x<viewport.width-12),JSON.stringify(framing));assert(metrics.pickups.every(h=>h.y>.7));
 const feedback=await p.evaluate(()=>{const s=brawl.sim,p=s.fighters[0],h=s.healthPickups[0];Object.assign(s.boss,{cooldown:1e6,pursuitClock:-1e6,aimHold:1e6,shieldReadyAt:1e6});s.fighters.slice(1).forEach(f=>f.weaponCooldown=1000);Object.assign(p,{x:h.x-.7,z:h.z,hp:48,inv:0,state:'idle'});s.moveInput(1,0);for(let i=0;i<12;i++)s.step(1/60);s.moveInput(0,0);brawl.events();brawl.updateHUD();brawl.scene.render(s,0,'playing');return{hp:p.hp,pops:brawl.pops.map(p=>p.n.textContent),visible:brawl.scene.visibleHealthPickups.length,state:JSON.parse(render_game_to_text())};});
 assert.equal(feedback.hp,73);assert(feedback.pops.includes('+25 HP'));assert.equal(feedback.visible,3);assert.equal(feedback.state.healthPickups.length,3);assert.equal(feedback.state.crewBody,'tactical');
 await p.screenshot({path:path.join(out,name+'-health-collected.png')});
 await p.evaluate(()=>advanceTime(14100));assert.equal(await p.evaluate(()=>brawl.sim.fighters[0].hp),98,'Actual cooldown respawns and collects health');
 await p.keyboard.press('Escape');assert.equal(await p.evaluate(()=>brawl.state),'paused');await p.locator('#resumeButton').click();assert.equal(await p.evaluate(()=>brawl.state),'playing');
 assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.deepEqual(errors,[]);
 report.push({name,loadMs,arrival,rigSamples:rigs.rows.length,maxGripGap:Math.max(...rigs.rows.map(r=>r.primary)),maxSupportGap:Math.max(...rigs.rows.map(r=>r.support)),feedback,metrics,errors});fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({name,loadMs,rigSamples:rigs.rows.length,health:feedback.hp,metrics}));await c.close();
}}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
