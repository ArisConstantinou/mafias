"""Live browser checks for the compact Brawl controls and target actions."""
from pathlib import Path
import os
import sys
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / '.qa-run' / 'brawl-context'
OUT.mkdir(parents=True, exist_ok=True)
sys.stdout.reconfigure(encoding='utf-8')
BROWSER = r'C:\Program Files\Google\Chrome\Application\chrome.exe'

def scene(page):
    page.evaluate("""() => {let a=brawl,s=a.sim;a.scene.render(s,0,'playing');a.updateHUD();a.worldHUD(0);}""")

with sync_playwright() as pw:
    browser = pw.chromium.launch(executable_path=BROWSER, headless=True)
    for label, width, height, mobile in [('mobile',430,932,True),('small',360,780,True),('landscape',844,390,True),('desktop',1280,800,False)]:
        context = browser.new_context(viewport={'width':width,'height':height}, device_scale_factor=1, is_mobile=mobile, has_touch=mobile)
        page = context.new_page()
        errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.goto((ROOT / 'brawl.html').as_uri(), wait_until='domcontentloaded')
        page.wait_for_function("window.brawl && brawl.state==='menu'", timeout=20000)
        page.evaluate("brawl.start({instant:true,ai:false,seed:7391,selected:0});brawl.testFrozen=true")
        scene(page)
        assert page.locator('#actions [data-action]').count() == 5
        assert page.locator('#actions [data-action="heavy"]').count() == 0
        if mobile:
            assert page.locator('#actionGuide').is_visible()
        assert page.locator('[data-action="grab"]').is_visible()
        assert page.locator('[data-action="pick"]').is_visible()
        page.screenshot(path=str(OUT / f'normal-{label}.png'))
        page.evaluate("""() => {let s=brawl.sim,p=s.fighters[0],q=s.fighters[1];p.x=0;p.z=0;q.x=1.3;q.z=0;s.fighters[2].x=8;s.fighters[3].x=-8;s.dizzy(q,2.5);q.inv=0;}""")
        scene(page)
        assert page.locator('.dizzy-stars').nth(1).is_visible()
        assert page.locator('.combat.grab').get_attribute('data-action') == 'spin'
        assert page.locator('#grabLabel').inner_text() == 'SPIN'
        assert not page.locator('.combat.grab').evaluate('(e) => e.classList.contains("unavailable")')
        page.screenshot(path=str(OUT / f'dizzy-grab-{label}.png'))
        page.locator('.combat.grab').tap() if mobile else page.locator('.combat.grab').click()
        scene(page)
        assert page.evaluate('brawl.sim.fighters[0].grabTarget') == 1
        assert page.locator('#grabLabel').inner_text() == 'SPIN'
        page.screenshot(path=str(OUT / f'spin-choice-{label}.png'))
        page.evaluate("""() => {for(let i=0;i<28;i++)brawl.sim.step(1/60)}""")
        assert page.evaluate('brawl.sim.fighters[0].state') == 'spin'
        page.evaluate("""() => {let s=brawl.sim,p=s.fighters[0],q=s.fighters[1];s.state(p,'idle');p.held=null;q.x=7;q.z=0;let o=s.items[0];o.x=p.x+.5;o.z=p.z;o.y=0;o.held=null;o.flying=false;o.broken=false;o.slipUntil=0;}""")
        scene(page)
        assert page.locator('[data-action="pick"]').is_visible()
        page.screenshot(path=str(OUT / f'pick-over-prop-{label}.png'))
        page.locator('[data-action="pick"]').tap() if mobile else page.locator('[data-action="pick"]').click()
        assert page.evaluate('brawl.sim.fighters[0].held') is not None
        page.evaluate("brawl.sim.state(brawl.sim.fighters[0],'idle')")
        scene(page)
        assert page.locator('#pickLabel').inner_text() == 'THROW'
        page.evaluate("""() => {let s=brawl.sim,p=s.fighters[0],q=s.fighters[1];p.held=null;p.stamina=100;s.state(p,'idle');q.x=1.3;q.z=0;q.y=0;q.hp=100;q.stamina=100;q.dizzyUntil=0;q.demoIdle=true;q.pushCooldown=Infinity;s.state(q,'idle');for(let type of ['punch','kick','punch']){p.state=type;p.attackHit=true;q.inv=0;if(!s.hit(q,p,3,'head',0,false,'melee'))throw Error('combo setup failed');}p.state='idle';}""")
        scene(page)
        assert page.locator('#punchLabel').inner_text() == 'HEAVY PUNCH'
        assert page.locator('[data-action="punch"]').get_attribute('aria-label').startswith('Heavy Punch ready')
        page.screenshot(path=str(OUT / f'combo-{label}.png'))
        assert not errors, (label, errors)
        context.close()
    browser.close()
print('PASS: 5 buttons, dizzy stars, grab/spin/pick, combo upgrade at 4 viewports')
