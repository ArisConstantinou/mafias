const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),live=process.argv.includes('--live'),published=process.argv.includes('--published');
const out=path.join(root,'.qa-run','scooter-pc-controls',published?'public':live?'local':'after');fs.mkdirSync(out,{recursive:true});
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true}),report=[];try{
 for(const [name,viewport,mobile] of [['desktop',{width:1280,height:800},false],['desktop-short',{width:844,height:390},false],['desktop-narrow',{width:600,height:780},false],['portrait',{width:430,height:932},true],['landscape',{width:844,height:390},true]]){
  const c=await browser.newContext({viewport,isMobile:mobile,hasTouch:mobile,serviceWorkers:'block'});
  if(!live&&!published)await c.route(/http:\/\/127\.0\.0\.1:5174\/(?:index\.html)?(?:\?.*)?$/,r=>r.fulfill({body:fs.readFileSync(path.join(root,'index.html')),contentType:'text/html'}));
  const p=await c.newPage(),errors=[];p.on('pageerror',e=>errors.push(String(e)));p.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await p.goto(published?'https://arisconstantinou.github.io/mafias/':'http://127.0.0.1:5174/');await p.waitForFunction(()=>window.voltRoast?.state==='menu');
  await p.evaluate(()=>{
   const g=voltRoast;g.frame=()=>{};g.selected=0;g.controlAI=()=>{};g.world.obstacles=[];g.world.pickups=[];
   window.prepare=()=>{g.start();g.state='racing';g.audio.muted=true;document.getElementById('countdown').style.display='none';g.riders.slice(1).forEach((q,i)=>{q.s=200+i*60;q.lane=5;q.speed=0;});g.render(1/60);window.playerShots=[];};
   const fire=g.fire.bind(g);g.fire=function(...args){const ok=fire(...args);if(ok&&args[0]===g.player&&!args[4])playerShots.push({...g.bullets.at(-1)});return ok;};
   window.step=n=>{for(let i=0;i<n;i++){g.update(1/60);g.render(1/60);}};prepare();
  });
  assert.equal(await p.locator('#leftStick').isVisible(),mobile);assert.equal(await p.locator('#rightStick').isVisible(),mobile);assert.equal(await p.locator('#desktopControls').isVisible(),!mobile);
  assert.deepEqual(await p.locator('.item-key').allTextContents(),['1','2','3','4']);
  for(const label of await p.locator('.item-key').evaluateAll(nodes=>nodes.map(n=>({font:parseFloat(getComputedStyle(n).fontSize),box:n.getBoundingClientRect().toJSON()})))){assert(label.font>=16);assert(label.box.width>=24&&label.box.height>=24);assert(label.box.x>=0&&label.box.y>=0&&label.box.x+label.box.width<=viewport.width&&label.box.y+label.box.height<=viewport.height);}
  if(!mobile){
   const keys=await p.locator('.drive-key').evaluateAll(nodes=>nodes.map(n=>({font:parseFloat(getComputedStyle(n.querySelector('span')).fontSize),box:n.getBoundingClientRect().toJSON()})));for(const key of keys){assert(key.font>=12);assert(key.box.x>=0&&key.box.y>=0&&key.box.x+key.box.width<=viewport.width&&key.box.y+key.box.height<=viewport.height);}
   await p.keyboard.down('KeyW');await p.keyboard.down('KeyD');await p.evaluate(()=>step(35));
   assert.equal(await p.locator('.drive-key.pressed').count(),2);assert(await p.evaluate(()=>voltRoast.player.boosting&&voltRoast.player.lane>1));
   await p.screenshot({path:path.join(out,name+'-keys.png')});await p.keyboard.up('KeyD');await p.keyboard.up('KeyW');assert.equal(await p.locator('.drive-key.pressed').count(),0);
   await p.keyboard.down('KeyA');await p.keyboard.down('KeyS');assert.equal(await p.locator('.drive-key.pressed').count(),2);await p.evaluate(()=>step(50));assert(await p.evaluate(()=>voltRoast.player.speed)<6);await p.keyboard.up('KeyA');await p.keyboard.up('KeyS');
   // Immediate click must create a real bolt and damage the rider under the cursor.
   await p.evaluate(()=>{prepare();const g=voltRoast,q=g.riders[1];q.s=g.player.s+10;q.lane=3;g.render(1/60);});
   let target=await p.evaluate(()=>voltRoast.R.project(voltRoast.riders[1].headPos));assert(target.visible);
   await p.mouse.click(target.x,target.y);assert.equal(await p.evaluate(()=>playerShots.length),1);assert.equal(await p.evaluate(()=>playerShots[0].target),1);await p.evaluate(()=>step(24));assert.equal(await p.evaluate(()=>voltRoast.riders[1].hp),96);
   // Hold-to-fire while W/D are held; release must stop firing.
   await p.evaluate(()=>prepare());await p.mouse.move(viewport.width*.6,viewport.height*.3);await p.keyboard.down('KeyW');await p.keyboard.down('KeyD');await p.mouse.down();await p.evaluate(()=>step(80));
   assert(await p.evaluate(()=>playerShots.length)>=3);assert(await p.evaluate(()=>voltRoast.player.boosting&&voltRoast.player.lane>2));assert.equal(await p.locator('#mouseFire.pressed').count(),1);await p.screenshot({path:path.join(out,name+'-fire.png')});
   await p.mouse.up();await p.keyboard.up('KeyD');await p.keyboard.up('KeyW');const shots=await p.evaluate(()=>playerShots.length);await p.evaluate(()=>step(40));assert.equal(await p.evaluate(()=>playerShots.length),shots);assert.equal(await p.locator('#mouseFire.pressed').count(),0);
   // Road-plane aiming works on straight and curved parts, in both lateral directions.
   for(const portion of [0,.25,.65])for(const lane of [-4,4]){
    const aim=await p.evaluate(({portion,lane})=>{prepare();const g=voltRoast;g.player.s=portion*g.track.length+2;g.cameraEye=g.cameraTarget=null;g.render(1/60);const pt=g.track.frame(g.player.s+12,lane).p;pt[1]=1.04;return g.R.project(pt);},{portion,lane});assert(aim.visible);
    await p.mouse.click(aim.x,aim.y);const shot=await p.evaluate(()=>playerShots[0]);assert(shot&&shot.vs>0&&Math.sign(shot.vl)===Math.sign(lane),JSON.stringify({portion,lane,shot}));
   }
   await p.evaluate(()=>prepare());await p.mouse.click(viewport.width*.9,viewport.height*.92);assert(await p.evaluate(()=>playerShots[0]?.vs<0),'Mouse can aim behind the scooter');
   // Menu/item clicks do not leak into shooting; top-row and numpad shortcuts agree.
   await p.evaluate(()=>prepare());for(const [number,item] of [[1,'banana'],[2,'pins'],[3,'oil'],[4,'box']])for(const prefix of ['Digit','Numpad']){
    await p.evaluate(t=>{voltRoast.player.throwReady=0;voltRoast.player.inventory[t]=3;},item);const count=await p.evaluate(t=>voltRoast.player.inventory[t],item);await p.keyboard.down(prefix+number);assert.equal(await p.locator('#item-'+item+'.key-held').count(),1);await p.keyboard.up(prefix+number);assert.equal(await p.evaluate(t=>voltRoast.player.inventory[t],item),count-1);
   }
   await p.evaluate(()=>{voltRoast.player.throwReady=0;voltRoast.player.inventory.banana=3;voltRoast.updateHUD();});await p.locator('#item-banana').click();assert.equal(await p.evaluate(()=>playerShots.length),0);assert.equal(await p.evaluate(()=>voltRoast.player.inventory.banana),2);
   await p.evaluate(()=>prepare());await p.mouse.move(viewport.width*.6,viewport.height*.3);await p.mouse.down();await p.keyboard.down('KeyW');await p.keyboard.press('Escape');assert.equal(await p.evaluate(()=>voltRoast.state),'paused');assert.equal(await p.evaluate(()=>voltRoast.mouse.down),false);assert.equal(await p.locator('.drive-key.pressed').count(),0);await p.mouse.up();await p.keyboard.up('KeyW');await p.locator('#resumeBtn').click();const pausedShots=await p.evaluate(()=>playerShots.length);await p.evaluate(()=>step(40));assert.equal(await p.evaluate(()=>playerShots.length),pausedShots);
   await p.evaluate(()=>prepare());await p.mouse.move(viewport.width*.6,viewport.height*.3);await p.mouse.down();await p.evaluate(()=>window.dispatchEvent(new Event('blur')));assert.equal(await p.evaluate(()=>voltRoast.mouse.down),false);assert.equal(await p.evaluate(()=>voltRoast.state),'paused');await p.mouse.up();
  }else{
   const left=await p.locator('#leftStick').boundingBox(),right=await p.locator('#rightStick').boundingBox(),cdp=await c.newCDPSession(p);await cdp.send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:5});
   await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:left.x+left.width*.73,y:left.y+left.height*.2,id:1},{x:right.x+right.width*.5,y:right.y+right.height*.2,id:2}]});await p.evaluate(()=>step(35));assert(await p.evaluate(()=>voltRoast.player.boosting&&voltRoast.player.lane>.5&&playerShots.length>0));assert.equal(await p.evaluate(()=>voltRoast.desktopControls),false);await p.screenshot({path:path.join(out,name+'-touch.png')});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
   await p.evaluate(()=>{voltRoast.player.throwReady=0;});await p.locator('#item-banana').tap();assert.equal(await p.evaluate(()=>voltRoast.player.inventory.banana),2);
  }
  await p.evaluate(()=>prepare());await p.screenshot({path:path.join(out,name+'.png')});assert.deepEqual(errors,[]);report.push({name,viewport,mobile,mouseAiming:mobile?'not applicable':'passed',heldInputAndRelease:'passed',numberedItems:'passed',deviceControls:'passed',errors});console.log(JSON.stringify(report.at(-1)));await c.close();
 }fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
