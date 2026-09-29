"""Browser checks for the shared mode menu and the imported brawl gameplay."""
from pathlib import Path
import json
import os
import shutil
import sys
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parent.parent
OUT=ROOT/'.qa-run'/'brawl-integration'
OUT.mkdir(parents=True,exist_ok=True)
sys.stdout.reconfigure(encoding='utf-8')
BROWSER=os.environ.get('CHROMIUM_EXECUTABLE') or next((str(path) for path in (
 Path(r'C:\Program Files\Google\Chrome\Application\chrome.exe'),
 Path(r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'),
 Path('/usr/lib/chromium/chromium'),
) if path.exists()),shutil.which('chromium'))
BROWSER_ARGS=[] if os.name=='nt' else ['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=gl','--ignore-gpu-blocklist']
results={}

def check(name,value):
 results[name]=value
 print(name,json.dumps(value,ensure_ascii=False),flush=True)

with sync_playwright() as pw:
 browser=pw.chromium.launch(executable_path=BROWSER,headless=True,args=BROWSER_ARGS)
 desktop=browser.new_context(viewport={'width':1280,'height':800},device_scale_factor=1)
 page=desktop.new_page();errors=[]
 page.on('pageerror',lambda error:errors.append(str(error)))
 page.goto((ROOT/'index.html').as_uri(),wait_until='domcontentloaded')
 page.wait_for_function("window.voltRoast && voltRoast.state==='menu'",timeout=20000)
 assert page.locator('.game-mode-card').count()==2
 assert all(page.locator(f'#{name} img').evaluate('(img)=>img.complete && img.naturalWidth>0') for name in ['chooseScooter','chooseBrawl'])
 page.click('.hero:nth-child(3)')
 page.click('#chooseBrawl')
 assert page.evaluate("({fighter:voltRoast.selected,mode:voltRoast.gameMode,scooterSetupHidden:$('scooterSetup').hidden})")=={'fighter':2,'mode':'brawl','scooterSetupHidden':True}
 page.click('#startBtn')
 page.wait_for_function("window.brawl && brawl.state==='menu'",timeout=20000)
 assert page.evaluate('brawl.selected')==2
 check('shared_fighter_to_brawl',{'fighter':2,'url':page.url})

 # The brawl's own fighter picker updates the selection used by the scooter.
 page.click('[data-hero="1"]')
 page.click('#switchModeButton')
 page.wait_for_function("window.voltRoast && voltRoast.state==='menu'",timeout=20000)
 assert page.evaluate('voltRoast.selected')==1
 check('shared_fighter_to_scooter',{'fighter':1,'url':page.url})

 # Start with a clean deterministic bout and exercise visible action buttons.
 page.goto((ROOT/'brawl.html').as_uri(),wait_until='domcontentloaded')
 page.wait_for_function("window.brawl && brawl.state==='menu'",timeout=20000)
 def start(mode='last'):
  page.evaluate("mode=>{brawl.start({mode,instant:true,ai:false,seed:7391,selected:0});brawl.testFrozen=true;}",mode)
  assert page.evaluate('brawl.state')=='playing'
 def target(distance=1.2):
  page.evaluate("distance=>{let a=brawl,s=a.sim,p=s.fighters[0],q=s.fighters[1];q.x=p.x+distance;q.z=p.z;q.inv=0;s.fighters[2].x=8;s.fighters[3].x=9;}",distance)

 for action,elapsed in [('punch',300),('kick',550)]:
  start();target()
  page.click(f'[data-action="{action}"]')
  page.evaluate('ms=>advanceTime(ms)',elapsed)
  hp=page.evaluate('brawl.sim.fighters[1].hp')
  assert hp<100,(action,hp)
  check(action,{'targetHp':hp})

 start();target()
 page.evaluate("() => {let p=brawl.sim.fighters[0];p.comboReady='heavy';p.comboUntil=brawl.sim.time+3.5;}")
 page.click('[data-action="punch"]')
 assert page.evaluate('brawl.sim.fighters[0].state')=='heavy'
 page.evaluate('advanceTime(750)')
 assert page.evaluate('brawl.sim.fighters[1].hp')<100
 check('combo_heavy_punch',True)

 start();target(1.1)
 page.evaluate("() => {let q=brawl.sim.fighters[1];brawl.sim.dizzy(q,2.2);q.inv=0;brawl.scene.render(brawl.sim,0,'playing');brawl.updateHUD();brawl.worldHUD(0);}")
 assert page.locator('.combat.grab').get_attribute('data-action')=='spin'
 page.keyboard.press('l')
 assert page.evaluate('brawl.sim.fighters[0].grabTarget')==1
 page.keyboard.press('l')
 assert page.evaluate('brawl.sim.fighters[1].hp')<100
 check('grab_and_slam',{'targetHp':page.evaluate('brawl.sim.fighters[1].hp')})

 start();target(1.1)
 page.evaluate("() => {let q=brawl.sim.fighters[1];brawl.sim.dizzy(q,2.2);q.inv=0;brawl.scene.render(brawl.sim,0,'playing');brawl.updateHUD();brawl.worldHUD(0);}")
 page.click('[data-action="spin"]')
 assert page.evaluate('brawl.sim.fighters[0].grabTarget')==1
 page.evaluate('advanceTime(500)')
 assert page.evaluate('brawl.sim.fighters[0].state')=='spin'
 assert page.evaluate('brawl.sim.fighters[1].hp')<100
 check('spin_from_dizzy',True)

 start()
 page.click('[data-action="dodge"]')
 assert page.evaluate('brawl.sim.fighters[0].stamina')<100
 check('dodge',{'stamina':page.evaluate('brawl.sim.fighters[0].stamina')})

 start()
 page.evaluate("() => {let s=brawl.sim,p=s.fighters[0],o=s.items[0];o.x=p.x+.5;o.z=p.z;o.held=null;o.flying=false;o.broken=false;o.slipUntil=0;}")
 page.evaluate("() => {brawl.scene.render(brawl.sim,0,'playing');brawl.worldHUD(0);}")
 page.click('[data-action="pick"]')
 assert page.evaluate('brawl.sim.fighters[0].held') is not None
 page.evaluate('advanceTime(400)')
 page.evaluate('brawl.worldHUD(0)')
 page.click('[data-action="pick"]')
 page.evaluate('advanceTime(250)')
 assert page.evaluate('brawl.sim.fighters[0].throws')==1
 check('pick_and_throw',{'throws':1})

 start()
 page.click('#pauseButton')
 assert page.evaluate('brawl.state')=='paused'
 time=page.evaluate('brawl.sim.time')
 page.evaluate('advanceTime(500)')
 assert page.evaluate('brawl.sim.time')==time
 page.click('#pauseSettings')
 assert page.locator('#settingsScreen').evaluate('(el)=>el.classList.contains("visible")')
 page.click('#closeSettings')
 page.click('#resumeButton')
 assert page.evaluate('brawl.state')=='playing'
 check('pause_settings_resume',True)

 for mode,setup in [
  ('last',"s.fighters.slice(1).forEach(f=>{f.ko=true;f.hp=0;f.respawn=Infinity;})"),
  ('score',"s.time=89.99;s.fighters[0].score=1000"),
  ('crown',"s.crown.holder=0;s.crown.time[0]=44.99"),
 ]:
  start(mode)
  page.evaluate('code=>{let s=brawl.sim;eval(code);}',setup)
  page.evaluate('advanceTime(50)')
  assert page.evaluate("brawl.sim.boss?.phase==='arrival' && !brawl.sim.finished"),mode
  page.evaluate('advanceTime(4700)')
  assert page.evaluate("brawl.sim.boss?.phase==='battle'"),mode
  for tier in range(4):
   page.evaluate("() => {let s=brawl.sim,p=s.fighters[0];while(s.boss.phase==='battle')s.bossFire(p,true);brawl.events();}")
   assert page.evaluate('brawl.sim.boss.tier')==tier
   if tier<3:
    assert page.evaluate("brawl.sim.boss.phase==='resurrect'")
    page.evaluate('advanceTime(3600)')
    assert page.evaluate("brawl.sim.boss.phase==='battle'"),tier
  page.evaluate('advanceTime(4500)')
  assert page.evaluate('brawl.sim.finished && brawl.sim.winner===0'),mode
  assert page.evaluate('brawl.state')=='results',mode
  assert page.locator('#scoreTable .scorerow').count()==5
  check('result_'+mode,{'winner':page.evaluate('brawl.sim.winner'),'rows':5})

 desktop.close()
 mobile=browser.new_context(viewport={'width':430,'height':932},device_scale_factor=1,is_mobile=True,has_touch=True)
 page=mobile.new_page();page.on('pageerror',lambda error:errors.append(str(error)))
 page.goto((ROOT/'brawl.html').as_uri(),wait_until='domcontentloaded')
 page.wait_for_function("window.brawl && brawl.state==='menu'",timeout=20000)
 page.evaluate("() => {brawl.start({instant:true,ai:false,seed:7391,selected:0});brawl.testFrozen=true;let s=brawl.sim,p=s.fighters[0],q=s.fighters[1];q.x=p.x+1.25;q.z=p.z;q.inv=0;s.fighters[2].x=8;s.fighters[3].x=9;}")
 joy=page.locator('#joystick').bounding_box();punch=page.locator('[data-action="punch"]').bounding_box()
 x=joy['x']+joy['width']/2;y=joy['y']+joy['height']/2
 px=punch['x']+punch['width']/2;py=punch['y']+punch['height']/2
 cdp=mobile.new_cdp_session(page)
 def point(id,x,y):return {'id':id,'x':x,'y':y}
 cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[point(1,x,y)]})
 cdp.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[point(1,x+40,y)]})
 cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[point(1,x+40,y),point(2,px,py)]})
 active=page.evaluate('VOLT_BRAWL_TEST.input()')
 assert active['joy']['x']>.8 and 'punch' in active['actions']
 before=page.evaluate('brawl.sim.fighters[0].x')
 # Touching Punch acts immediately while the movement pointer remains active.
 cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[point(2,px,py)]})
 assert page.evaluate('VOLT_BRAWL_TEST.input()')['joy']['x']>.8
 page.evaluate('advanceTime(600)')
 after=page.evaluate('brawl.sim.fighters[0].x')
 hp=page.evaluate('brawl.sim.fighters[1].hp')
 assert after>before and hp<100
 page.screenshot(path=str(OUT/'mobile-two-touch.png'))
 cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]})
 assert page.evaluate('VOLT_BRAWL_TEST.input()')['actions']==[]
 check('mobile_move_and_punch',{'moved':after-before,'targetHp':hp,'inputReleased':True})
 mobile.close();browser.close()
 assert not errors,errors

(OUT/'report.json').write_text(json.dumps({'checks':results,'errors':errors},ensure_ascii=False,indent=2),encoding='utf-8')
print('ALL BRAWL INTEGRATION CHECKS PASSED',flush=True)
