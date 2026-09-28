from playwright.sync_api import sync_playwright
from pathlib import Path
import os, shutil, sys
import json,time
ROOT=Path(__file__).resolve().parent.parent
BROWSER=os.environ.get('CHROMIUM_EXECUTABLE') or next((str(path) for path in (
 Path(r'C:\Program Files\Google\Chrome\Application\chrome.exe'),
 Path(r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'),
 Path('/usr/lib/chromium/chromium'),
) if path.exists()),shutil.which('chromium'))
BROWSER_ARGS=[] if os.name=='nt' else ['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=gl','--ignore-gpu-blocklist']
results={}; errors=[]
def check(name,value):
 results[name]=value
 print(name,json.dumps(value,ensure_ascii=False),flush=True)
with sync_playwright() as p:
 b=p.chromium.launch(executable_path=BROWSER,headless=True,args=BROWSER_ARGS)
 page=b.new_page(viewport={'width':1280,'height':800},device_scale_factor=1)
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.set_content((ROOT/'index.html').read_text(encoding='utf-8'),wait_until='domcontentloaded')
 page.wait_for_function("window.voltRoast && voltRoast.state!=='loading'",timeout=20000)
 assert page.evaluate("voltRoast.state==='menu'")
 check('load',{'ready':True,'photos':page.locator('#heroes img').count(),'buttons':page.locator('#itemButtons button').count()})
 page.evaluate('voltRoast.frame=()=>{}')
 page.wait_for_timeout(350)
 page.locator('.hero').nth(3).click()
 assert page.evaluate('voltRoast.player.id')==3
 page.locator('.hero').nth(0).click()
 page.click('#startBtn')
 page.wait_for_function('Object.keys(voltRoast.audio.buffers).length===24',timeout=20000)
 check('voices',{'decoded':24})
 page.evaluate('voltRoast.audio.muted=true; for(let i=0;i<230;i++)voltRoast.update(1/60)')
 assert page.evaluate('voltRoast.state')=='racing'
 check('countdown',page.evaluate('({state:voltRoast.state,time:voltRoast.raceTime})'))
 # Exact collision cooldown and escalation are isolated from other road hazards.
 collision=page.evaluate('''() => {let g=voltRoast;g.start();g.state='racing';g.time=5;let a=g.riders[0],b=g.riders[1];a.s=b.s=50;a.lane=0;b.lane=.5;a.speed=b.speed=15;g.updatePositions();let values=[];for(let i=0;i<7;i++){g.time+=1.31;let before=a.hp;g.collide(a,b);values.push({hits:a.hits,heat:heatFor(a.hits),damage:before-a.hp});}let before=a.hp;let prevented=!g.collide(a,b);return {values,cooldownPrevented:prevented,unchanged:before===a.hp,bolts:g.bullets.length};}''')
 assert [x['heat'] for x in collision['values']]==[1,1,2,2,3,3,4]
 assert collision['cooldownPrevented'] and collision['unchanged'] and collision['bolts']>=2
 check('collision_and_heat',collision)
 item_tests=page.evaluate('''() => {let g=voltRoast,out={};let ai=g.controlAI,cp=g.controlPlayer,obs=g.world.obstacles,pks=g.world.pickups;g.controlAI=()=>{};g.controlPlayer=()=>{};g.world.obstacles=[];g.world.pickups=[];for(let type of ITEM_TYPES){g.start();g.state='racing';g.time=10;g.riders.forEach((r,i)=>{r.s=100+i*100;r.lane=0;r.speed=0;r.aiNext=999;r.aiFire=999;r.aiThrow=999;});let a=g.player,target=g.riders[1];g.updatePositions();let before=a.inventory[type];let fired=g.throwItem(a,type);let t=g.traps[0];target.s=t.startS-t.distance;let rear=t.s<a.s,cd=!g.throwItem(a,type);for(let i=0;i<62;i++)g.update(1/60);let hp=target.hp;for(let i=0;i<30;i++)g.update(1/60);out[type]={fired,rear,cooldown:cd,stockUsed:before-a.inventory[type],damage:100-hp,noRepeat:target.hp===hp,heat:heatFor(target.hits),skid:target.skidUntil>g.time,puncture:target.punctureUntil>g.time,itemHits:a.itemHits};}g.controlAI=ai;g.controlPlayer=cp;g.world.obstacles=obs;g.world.pickups=pks;return out;}''')
 for name,damage in [('banana',8),('pins',16),('oil',5),('box',23)]:
  it=item_tests[name]; assert it['fired'] and it['rear'] and it['cooldown'] and it['stockUsed']==1 and it['damage']==damage and it['noRepeat'] and it['itemHits']==1,it
 assert item_tests['banana']['skid'] and item_tests['oil']['skid'] and item_tests['pins']['puncture']
 check('rear_throw_items',item_tests)
 pause=page.evaluate('''() => {let g=voltRoast;g.start();g.state='racing';g.pause();let s=g.player.s,t=g.time;for(let i=0;i<90;i++)g.update(1/60);let frozen=g.time===t&&g.player.s===s;g.resume();return {frozen,state:g.state};}''')
 assert pause['frozen'] and pause['state']=='racing';check('pause_resume',pause)
 # Keyboard event routing through the actual controls.
 page.keyboard.down('KeyD');page.keyboard.down('KeyW')
 page.evaluate('for(let i=0;i<45;i++)voltRoast.update(1/60)')
 controls=page.evaluate('({lane:voltRoast.player.lane,boost:voltRoast.player.boosting,energy:voltRoast.player.energy,speed:voltRoast.player.speed})')
 page.keyboard.up('KeyD');page.keyboard.up('KeyW')
 assert controls['lane']>1 and controls['boost'] and controls['energy']<100;check('keyboard_controls',controls)
 pickups=page.evaluate('''() => {let g=voltRoast;let ai=g.controlAI,cp=g.controlPlayer,obs=g.world.obstacles,pks=g.world.pickups;g.start();g.state='racing';g.controlAI=()=>{};g.controlPlayer=()=>{};g.world.obstacles=[];g.player.s=75;g.player.hp=94;g.player.energy=70;g.player.inventory={banana:0,pins:0,oil:0,box:0};g.riders.slice(1).forEach((r,i)=>r.s=200+i*50);g.world.pickups=[{s:75,lane:g.player.lane,type:'repair',ready:0}];g.update(1/60);let repaired=g.player.hp;g.world.pickups=[{s:75,lane:g.player.lane,type:'boost',ready:0}];g.update(1/60);let boost=g.player.energy;g.world.pickups=[{s:75,lane:g.player.lane,type:'supply',ready:0}];g.update(1/60);let supply=Object.values(g.player.inventory).reduce((a,b)=>a+b,0);g.controlAI=ai;g.controlPlayer=cp;g.world.obstacles=obs;g.world.pickups=pks;return {repaired,boost,supply};}''')
 assert pickups=={'repaired':100,'boost':100,'supply':2};check('pickups',pickups)
 winners=page.evaluate('''() => {let g=voltRoast;g.start();g.state='racing';g.player.s=g.track.length*2+.1;g.update(1/60);let race={state:g.state,winner:g.winner};g.mode='survival';g.start();g.state='racing';g.riders.slice(1).forEach(r=>g.damage(r,100,g.player));g.update(1/60);let last={state:g.state,winner:g.winner};return {race,last};}''')
 assert winners['race']=={'state':'results','winner':0} and winners['last']=={'state':'results','winner':0};check('win_conditions',winners)
 # Let the real AI and all game systems run, with no player interventions.
 sim=page.evaluate('''() => {let g=voltRoast;g.mode='clash';g.start();g.state='racing';let samples=[];for(let i=0;i<9000&&g.state==='racing';i++){g.update(1/60);if(i%1200===0)samples.push({t:g.raceTime,alive:g.riders.filter(r=>r.hp>0).length});}return {samples,...g.snapshot(),aiThrows:g.riders.slice(1).reduce((n,r)=>n+r.items,0)};}''')
 assert sim['aiThrows']>0 and sim['state']=='results';check('full_ai_match',sim)
 # Mobile multi-touch: two independently captured fingers and an actual image-button tap.
 page.set_viewport_size({'width':430,'height':932})
 page.evaluate('voltRoast.resize();voltRoast.mode="clash";voltRoast.start();voltRoast.state="racing";voltRoast.render(1/60)')
 page.wait_for_timeout(200)
 left=page.locator('#leftStick').bounding_box();right=page.locator('#rightStick').bounding_box()
 touch=[{'x':left['x']+left['width']*.76,'y':left['y']+left['height']*.36,'id':1}, {'x':right['x']+right['width']*.5,'y':right['y']+right['height']*.22,'id':2}]
 cdp=page.context.new_cdp_session(page);cdp.send('Emulation.setTouchEmulationEnabled',{'enabled':True,'maxTouchPoints':5})
 cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':touch})
 dual=page.evaluate('({left:{x:voltRoast.sticks.left.x,y:voltRoast.sticks.left.y},right:{x:voltRoast.sticks.right.x,y:voltRoast.sticks.right.y}})')
 assert dual['left']['x']>.2 and dual['right']['y']<-.2;check('two_finger_joysticks',dual)
 cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]})
 page.locator('#item-banana').dispatch_event('pointerdown',{'pointerId':5,'clientX':140,'clientY':695})
 assert page.evaluate('voltRoast.player.inventory.banana')==2
 check('item_image_button',{'bananaStock':2,'activeTrap':page.evaluate('voltRoast.traps[0].type')})
 # A controlled live-engine scene for layout and collision screenshot verification.
 page.evaluate('''() => {let g=voltRoast;g.start();g.state='racing';$('countdown').style.display='none';g.time=15;g.raceTime=12;let coords=[[96,0],[104,-3],[101,2.5],[112,.4]];g.riders.forEach((r,i)=>{r.s=coords[i][0];r.lane=coords[i][1];r.speed=16;r.hp=[84,76,69,92][i];r.hits=[5,5,3,1][i];});g.updatePositions();g.say(g.player);g.say(g.riders[1]);g.traps=[{id:1,type:'banana',s:104,lane:.1,owner:2,age:2,landed:true,y:0,life:18},{id:2,type:'pins',s:114,lane:-1.7,owner:3,age:2,landed:true,y:0,life:18},{id:3,type:'oil',s:121,lane:3,owner:2,age:2,landed:true,y:0,life:18}];g.settings.quality='high';g.resize();g.render(1/60);}''')
 page.wait_for_timeout(400)
 page.screenshot(path=str(ROOT/'tests'/'mobile-game.png'))
 boxes=page.evaluate('''() => [...document.querySelectorAll('.bubble')].filter(e=>Number(e.style.opacity)>0).map(e=>{let r=e.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height};})''')
 if len(boxes)==2:
  a,bb=boxes;assert not(a['x']<bb['x']+bb['w'] and a['x']+a['w']>bb['x'] and a['y']<bb['y']+bb['h'] and a['y']+a['h']>bb['y']),boxes
 check('mobile_bubble_layout',boxes)
 page.set_viewport_size({'width':1280,'height':800});page.evaluate('voltRoast.resize();voltRoast.render(1/60)');page.wait_for_timeout(250);page.screenshot(path=str(ROOT/'tests'/'desktop-action.png'))
 page.set_viewport_size({'width':844,'height':390});page.evaluate('voltRoast.resize();voltRoast.render(1/60)');page.wait_for_timeout(250);page.screenshot(path=str(ROOT/'tests'/'mobile-landscape.png'))
 page.evaluate('voltRoast.garage();voltRoast.render(1/60)')
 page.set_viewport_size({'width':430,'height':932});page.evaluate('voltRoast.resize();voltRoast.render(1/60)');page.wait_for_timeout(250);page.screenshot(path=str(ROOT/'tests'/'mobile-menu.png'))
 assert not errors,errors
 check('javascript_errors',errors)
 results['full_ai_match'].pop('fps',None)
 results['full_ai_match']['test_note']='Accelerated fixed-step simulation, not a frame-rate measurement.'
 (ROOT/'tests'/'regression.json').write_text(json.dumps(results,ensure_ascii=False,indent=2),encoding='utf-8')
 b.close()
print('ALL REGRESSION CHECKS PASSED',flush=True)
