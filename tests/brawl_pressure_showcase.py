"""Verify the 11 live Brawl demonstrations and their responsive panel."""
from pathlib import Path
import sys
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / '.qa-run' / 'brawl-pressure'
OUT.mkdir(parents=True, exist_ok=True)
sys.stdout.reconfigure(encoding='utf-8')
CHROME = r'C:\Program Files\Google\Chrome\Application\chrome.exe'

def demo(page,index,seconds):
    return page.evaluate("""([i,t])=>{brawl.showDemo(i);advanceTime(t*1000);let s=brawl.demoSim,p=s.fighters[0],q=s.fighters[1];return {title:document.getElementById('helpTitle').textContent,x:p.x,state:p.state,blocks:p.blocks,throws:p.throws,grab:p.grabTarget,ready:p.comboReady,targetHp:q.hp,targetLeg:q.leg,targetState:q.state};}""",[index,seconds])

with sync_playwright() as pw:
    browser = pw.chromium.launch(executable_path=CHROME,headless=True)
    for label,width,height,mobile in [('mobile',430,932,True),('small',360,780,True),('landscape',844,390,True),('desktop',1280,800,False)]:
        context = browser.new_context(viewport={'width':width,'height':height},device_scale_factor=1,is_mobile=mobile,has_touch=mobile)
        page = context.new_page()
        errors=[]
        page.on('pageerror',lambda error:errors.append(str(error)))
        page.goto((ROOT/'brawl.html').as_uri(),wait_until='domcontentloaded')
        page.wait_for_function("window.brawl && brawl.state==='menu'",timeout=20000)
        page.click('#helpButton')
        assert page.locator('#showcaseSelect option').count()==11
        if label=='mobile':
            checks=[
                (0,1.2,lambda v:v['x']>-.3),
                (1,1.0,lambda v:v['targetHp']<100),
                (2,1.0,lambda v:v['targetLeg']>0),
                (3,2.8,lambda v:v['targetState']=='down' and v['targetHp']<70),
                (4,3.3,lambda v:v['targetState']=='down' and v['targetLeg']>30),
                (5,.7,lambda v:v['state']=='dodge'),
                (6,.9,lambda v:v['blocks']>=1),
                (7,1.4,lambda v:v['targetHp']<100),
                (8,1.4,lambda v:v['targetHp']<100),
                (9,1.5,lambda v:v['throws']==1),
                (10,2.45,lambda v:v['grab']==1 and v['targetState']=='groundGrabbed'),
            ]
            for i,seconds,check in checks:
                value=demo(page,i,seconds)
                assert check(value),(i,value)
            assert page.evaluate('JSON.parse(render_game_to_text()).showcase')=='AUTO PUSH / GROUND GRAB'
            demo(page,7,.75)
            page.screenshot(path=str(OUT/'context-dizzy-showcase-mobile.png'))
            demo(page,10,2.45)
        else:
            demo(page,10,2.45)
        page.screenshot(path=str(OUT/f'context-showcase-{label}.png'))
        panel=page.locator('.showcase-info').bounding_box()
        assert panel['x']>=0 and panel['x']+panel['width']<=width+1
        assert panel['y']>=0 and panel['y']+panel['height']<=height+1
        if label=='small':
            actor=page.locator('.showcase-actor').bounding_box()
            partner=page.locator('.showcase-target').bounding_box()
            assert actor['x']+actor['width']<=partner['x']+1
        page.click('#closeHelp')
        assert page.evaluate('brawl.state')=='menu'
        assert not errors,(label,errors)
        context.close()
    browser.close()
print('PASS: 11 live showcases and responsive layouts')
