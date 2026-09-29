const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
const out=path.join(root,'.qa-run','keypad-actions');
fs.mkdirSync(out,{recursive:true});

(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1280,height:800}}),errors=[];
  page.on('pageerror',error=>errors.push(String(error)));
  await page.goto(pathToFileURL(path.join(root,'brawl.html')).href);
  await page.waitForFunction(()=>window.brawl?.state==='menu');
  await page.screenshot({path:path.join(out,'brawl-menu-desktop.png')});
  await page.evaluate(()=>{
   brawl.start({instant:true,ai:false,seed:7391,selected:0,mode:'score'});
   brawl.testFrozen=true;brawl.audio.muted=true;
   window.keypadActions=[];
   const act=brawl.act.bind(brawl);
   brawl.act=type=>{keypadActions.push(type);return act(type);};
  });
  await page.screenshot({path:path.join(out,'brawl-desktop.png')});
  for(const [key,action] of [['Numpad1','punch'],['Numpad2','kick'],['Numpad3','dodge'],['Numpad4','grab'],['Numpad5','pick']]){
   await page.keyboard.press(key);
   const seen=await page.evaluate(()=>keypadActions.at(-1));
   assert.equal(seen,action,`${key} routes to ${action}`);
  }
  await page.evaluate(()=>{
   const s=brawl.sim,p=s.fighters[0],q=s.fighters[1];
   s.state(p,'idle');p.stamina=100;p.grabTarget=null;p.grabbedBy=null;p.spinGrabTarget=null;
   q.x=p.x+1.3;q.z=p.z;q.inv=0;s.dizzy(q,2.5);
   brawl.updateHUD();
  });
  assert.equal(await page.locator('.combat.grab').getAttribute('data-action'),'spin');
  await page.keyboard.press('Numpad4');
  assert.equal(await page.evaluate(()=>keypadActions.at(-1)),'spin','Numpad4 follows the contextual Spin button');
  assert.equal(await page.evaluate(()=>brawl.sim.fighters[0].spinGrabTarget),1,'Numpad4 starts the actual spin grab');
  await page.evaluate(()=>{
   brawl.start({instant:true,ai:false,seed:7391,selected:0,mode:'score'});
   brawl.testFrozen=true;
   const s=brawl.sim,p=s.fighters[0],item=s.items[0];
   item.x=p.x+.5;item.z=p.z;item.y=0;item.held=null;item.flying=false;item.broken=false;item.slipUntil=0;
  });
  await page.keyboard.press('Numpad5');
  assert.notEqual(await page.evaluate(()=>brawl.sim.fighters[0].held),null,'Numpad5 picks up a nearby prop');
  await page.evaluate(()=>advanceTime(400));
  await page.keyboard.press('Numpad5');
  await page.evaluate(()=>advanceTime(250));
  assert.equal(await page.evaluate(()=>brawl.sim.fighters[0].throws),1,'Numpad5 throws the held prop');
  await page.evaluate(()=>{
   const s=brawl.sim;s.beginBoss(0);for(let i=0;i<290;i++)s.step(1/60);
   const b=s.boss,p=s.fighters[0];b.x=0;b.z=0;p.x=0;p.z=4;p.weaponCooldown=0;
   s.fighters.slice(1).forEach(f=>f.weaponCooldown=1000);
   brawl.events();brawl.updateHUD();
  });
  const shots=await page.evaluate(()=>brawl.sim.fighters[0].bossShots);
  await page.keyboard.press('Numpad1');
  assert.equal(await page.evaluate(()=>brawl.sim.fighters[0].bossShots),shots+1,'Numpad1 fires in the boss battle');
  await page.evaluate(()=>{const p=brawl.sim.fighters[0];p.weaponCooldown=0;p.stamina=100;});
  await page.keyboard.press('Numpad2');
  assert.equal(await page.evaluate(()=>brawl.sim.fighters[0].bossShots),shots+2,'Numpad2 fires a power shot');
  assert.equal(await page.evaluate(()=>brawl.sim.fighters[0].stamina),75,'power shot spends stamina');
  await page.evaluate(()=>{const p=brawl.sim.fighters[0];p.inv=0;p.weaponCooldown=0;});
  await page.keyboard.press('Numpad3');
  assert.equal(await page.evaluate(()=>brawl.sim.fighters[0].state),'dodge','Numpad3 dodges');
  await page.evaluate(()=>{const p=brawl.sim.fighters[0];p.inv=0;p.weaponCooldown=0;brawl.testFrozen=false;});
  const beforeHold=await page.evaluate(()=>brawl.sim.fighters[0].bossShots);
  await page.keyboard.down('Numpad1');
  await page.waitForTimeout(950);
  await page.keyboard.up('Numpad1');
  assert(await page.evaluate(()=>brawl.sim.fighters[0].bossShots)>=beforeHold+2,'held Numpad1 repeats fire');
  await page.goto(pathToFileURL(path.join(root,'index.html')).href);
  await page.waitForFunction(()=>window.voltRoast?.state==='menu');
  await page.evaluate(()=>{voltRoast.start();voltRoast.state='racing';voltRoast.audio.muted=true;});
  await page.screenshot({path:path.join(out,'scooter-desktop.png')});
  for(const [digit,item] of ['banana','pins','oil','box'].entries()){
   await page.evaluate(()=>{voltRoast.player.throwReady=0;});
   const before=await page.evaluate(item=>voltRoast.player.inventory[item],item);
   await page.keyboard.press('Numpad'+(digit+1));
   assert.equal(await page.evaluate(item=>voltRoast.player.inventory[item],item),before-1,
    `Numpad${digit+1} throws ${item}`);
  }
  await page.evaluate(()=>{voltRoast.player.throwReady=0;});
  const before=await page.evaluate(()=>voltRoast.player.inventory.banana);
  await page.keyboard.press('Digit1');
  assert.equal(await page.evaluate(()=>voltRoast.player.inventory.banana),before-1,'top-row item shortcut is preserved');
  assert.equal(errors.length,0,errors.join('\n'));
  const mobile=await browser.newContext({viewport:{width:430,height:932},isMobile:true,hasTouch:true});
  const touch=await mobile.newPage();
  touch.on('pageerror',error=>errors.push(String(error)));
  await touch.goto(pathToFileURL(path.join(root,'brawl.html')).href);
  await touch.waitForFunction(()=>window.brawl?.state==='menu');
  await touch.evaluate(()=>{brawl.start({instant:true,ai:false,seed:7391,selected:0,mode:'score'});brawl.testFrozen=true;brawl.audio.muted=true;});
  await touch.locator('[data-action="punch"]').tap();
  assert.equal(await touch.evaluate(()=>brawl.sim.fighters[0].state),'punch','mobile Brawl tap still attacks');
  await touch.goto(pathToFileURL(path.join(root,'index.html')).href);
  await touch.waitForFunction(()=>window.voltRoast?.state==='menu');
  await touch.evaluate(()=>{voltRoast.start();voltRoast.state='racing';voltRoast.audio.muted=true;});
  const mobileStock=await touch.evaluate(()=>voltRoast.player.inventory.banana);
  await touch.locator('#item-banana').tap();
  assert.equal(await touch.evaluate(()=>voltRoast.player.inventory.banana),mobileStock-1,'mobile Scooter tap still throws');
  await mobile.close();
  assert.equal(errors.length,0,errors.join('\n'));
  console.log('Brawl Numpad 1–5, contextual Spin, boss Fire/Power/Dodge and held fire; Scooter Numpad 1–4, top-row digits, and both mobile touch actions passed.');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
