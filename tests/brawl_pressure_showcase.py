"""Browser checks for the live move guide and compact touch combat controls."""
from pathlib import Path
import json
import sys
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parent.parent
OUT=ROOT/'.qa-run'/'brawl-pressure'
OUT.mkdir(parents=True,exist_ok=True)
sys.stdout.reconfigure(encoding='utf-8')
CHROME=Path(r'C:\Program Files\Google\Chrome\Application\chrome.exe')
errors=[]

def ready(page):
    page.goto((ROOT/'brawl.html').as_uri(),wait_until='domcontentloaded')
    page.wait_for_function("window.brawl && brawl.state==='menu'",timeout=20000)
    page.on('pageerror',lambda error:errors.append(str(error)))

def demo(page,index,seconds):
    return page.evaluate('([index,seconds])=>{brawl.showDemo(index);advanceTime(seconds*1000);let s=brawl.demoSim,p=s.fighters[0],q=s.fighters[1];return {title:document.getElementById("helpTitle").textContent,time:s.time,x:p.x,hp:p.hp,blocks:p.blocks,throws:p.throws,state:p.state,grab:p.grabTarget,grabbed:p.grabbedBy,targetState:q.state,targetHp:q.hp,targetLeg:q.leg};}',[index,seconds])

with sync_playwright() as pw:
    browser=pw.chromium.launch(executable_path=str(CHROME),headless=True)
    mobile=browser.new_context(viewport={'width':430,'height':932},device_scale_factor=1,is_mobile=True,has_touch=True)
    page=mobile.new_page();ready(page)
    page.click('#helpButton')
    assert page.evaluate('brawl.state')=='tutorial'
    assert page.locator('#showcaseSelect option').count()==11
    checks=[
        (0,1.2,lambda v:v['x']>-.3 and v['targetHp']==100),
        (1,1.0,lambda v:v['targetHp']<100),
        (2,1.2,lambda v:v['targetState']=='down'),
        (3,1.0,lambda v:v['targetLeg']>0),
        (4,1.5,lambda v:v['targetHp']<100),
        (5,.7,lambda v:v['state']=='dodge'),
        (6,.9,lambda v:v['blocks']==1 and v['targetHp']<100),
        (7,1.25,lambda v:v['grabbed'] is None and v['grab'] is None and v['targetHp']==100),
        (8,1.5,lambda v:v['throws']==1 and v['targetHp']<100),
        (9,1.7,lambda v:v['state']=='push' and v['targetState']=='shoved'),
        (10,2.45,lambda v:v['grab']==1 and v['targetState']=='groundGrabbed'),
    ]
    demo_results=[]
    for index,seconds,check in checks:
        value=demo(page,index,seconds)
        assert check(value),(index,value)
        demo_results.append(value['title'])
    visible=json.loads(page.evaluate('render_game_to_text()'))
    assert visible['showcase']=='GROUND GRAB' and visible['player']['grabTarget']==1
    assert visible['rivals'][0]['state']=='groundGrabbed'
    page.screenshot(path=str(OUT/'after-ground-mobile.png'))
    page.click('#closeHelp')
    assert page.evaluate('brawl.state')=='menu'

    page.evaluate("brawl.scenario('combat')")
    assert page.locator('.actions .combat:visible').count()==4
    boxes=[page.locator(f'[data-action="{action}"]').bounding_box() for action in ('punch','kick','dodge','grab')]
    assert min(min(box['width'],box['height']) for box in boxes)>=70
    page.screenshot(path=str(OUT/'after-game-mobile.png'))

    page.evaluate("brawl.start({instant:true,ai:false,seed:7391,selected:0});brawl.testFrozen=true;let s=brawl.sim,p=s.fighters[0],q=s.fighters[1];q.x=p.x+1.2;q.z=p.z;q.inv=0;s.fighters[2].x=8;s.fighters[3].x=9")
    punch=page.locator('[data-action="punch"]').bounding_box()
    px=punch['x']+punch['width']/2;py=punch['y']+punch['height']/2
    page.touchscreen.tap(px,py)
    page.evaluate('advanceTime(300)')
    assert page.evaluate('brawl.sim.fighters[1].hp')==93

    page.evaluate("brawl.start({instant:true,ai:false,seed:7391,selected:0});brawl.testFrozen=true;let s=brawl.sim,p=s.fighters[0],q=s.fighters[1];q.x=p.x+1.2;q.z=p.z;q.inv=0;s.fighters[2].x=8;s.fighters[3].x=9")
    cdp=mobile.new_cdp_session(page)
    cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'id':3,'x':px,'y':py}]})
    page.wait_for_timeout(480)
    assert page.evaluate('brawl.sim.fighters[0].state')=='heavy'
    cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[{'id':3,'x':px,'y':py}]})
    page.evaluate('advanceTime(800)')
    assert page.evaluate('brawl.sim.fighters[1].hp')<=83

    page.evaluate("brawl.start({instant:true,ai:false,seed:7391,selected:0});brawl.testFrozen=true;let s=brawl.sim,p=s.fighters[0],q=s.fighters[1];q.x=p.x+1.2;q.z=p.z;s.state(q,'down',1.5);q.y=0;q.inv=0;s.fighters[2].x=8;s.fighters[3].x=9;brawl.updateHUD()")
    assert page.locator('#grabLabel').inner_text()=='GROUND GRAB'
    assert page.locator('[data-action="grab"] use').get_attribute('href')=='#i-grab'
    page.locator('[data-action="grab"]').tap()
    assert page.evaluate('brawl.sim.fighters[0].grabTarget')==1
    page.evaluate('brawl.updateHUD()')
    assert page.locator('#grabLabel').inner_text()=='SLAM'
    page.locator('[data-action="grab"]').tap()
    assert page.evaluate('brawl.sim.fighters[1].hp')<100

    page.evaluate("brawl.start({instant:true,ai:false,seed:7391,selected:0});brawl.testFrozen=true;let s=brawl.sim,p=s.fighters[0];for(let f of s.fighters.slice(1)){f.x=8;f.z=6;}let o=s.items[0];o.x=p.x+.5;o.z=p.z;o.held=null;o.flying=false;o.broken=false;o.slipUntil=0;brawl.updateHUD()")
    assert page.locator('#grabLabel').inner_text()=='PICK UP'
    assert page.locator('[data-action="grab"] use').get_attribute('href')=='#i-pick'
    page.locator('[data-action="grab"]').tap()
    assert page.evaluate('brawl.sim.fighters[0].held') is not None
    page.evaluate('advanceTime(400)')
    assert page.locator('#grabLabel').inner_text()=='THROW'
    page.locator('[data-action="grab"]').tap()
    page.evaluate('advanceTime(250)')
    assert page.evaluate('brawl.sim.fighters[0].throws')==1
    print('mobile controls and all 11 live showcases passed',flush=True)
    mobile.close()

    for width,height,name in ((360,780,'small'),(844,390,'landscape')):
        context=browser.new_context(viewport={'width':width,'height':height},device_scale_factor=1,is_mobile=True,has_touch=True)
        page=context.new_page();ready(page)
        page.click('#helpButton')
        page.select_option('#showcaseSelect','10')
        page.wait_for_timeout(2400)
        page.screenshot(path=str(OUT/f'after-ground-{name}.png'))
        panel=page.locator('.showcase-info').bounding_box()
        assert panel['x']>=0 and panel['x']+panel['width']<=width+1
        assert panel['y']>=0 and panel['y']+panel['height']<=height+1
        page.click('#closeHelp')
        page.evaluate("brawl.scenario('combat')")
        assert page.locator('.actions .combat:visible').count()==4
        page.screenshot(path=str(OUT/f'after-game-{name}.png'))
        context.close()

    desktop=browser.new_context(viewport={'width':1280,'height':800},device_scale_factor=1)
    page=desktop.new_page();ready(page)
    page.click('#helpButton');page.select_option('#showcaseSelect','10')
    page.wait_for_timeout(2400);page.screenshot(path=str(OUT/'after-ground-desktop.png'))
    page.click('#closeHelp');page.evaluate("brawl.scenario('combat')")
    assert page.locator('.actions .combat:visible').count()==6
    page.screenshot(path=str(OUT/'after-game-desktop.png'))
    page.click('#pauseButton');before=page.evaluate('brawl.sim.time')
    page.click('#pauseHelp');assert page.evaluate('brawl.state')=='tutorial'
    page.click('#closeHelp');assert page.evaluate('brawl.state')=='paused'
    assert page.evaluate('brawl.sim.time')==before
    page.click('#resumeButton');assert page.evaluate('brawl.state')=='playing'
    desktop.close();browser.close()

assert not errors,errors
(OUT/'showcase-report.json').write_text(json.dumps({'showcases':demo_results,'errors':errors,'viewports':['430x932','360x780','844x390','1280x800']},indent=2),encoding='utf-8')
print('BRAWL PRESSURE SHOWCASE BROWSER CHECKS PASSED',flush=True)
