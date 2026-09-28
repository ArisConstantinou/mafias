"""Visual and interaction check of the SCARAT finale in real browser time."""
from pathlib import Path
import json
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / '.qa-run' / 'boss-browser'
OUT.mkdir(parents=True, exist_ok=True)
CHROME = r'C:\Program Files\Google\Chrome\Application\chrome.exe'

with sync_playwright() as pw:
    browser = pw.chromium.launch(executable_path=CHROME, headless=True)
    results = []
    for label, width, height, mobile in (
        ('desktop', 1280, 800, False),
        ('mobile', 430, 932, True),
        ('landscape', 844, 390, True),
    ):
        context = browser.new_context(viewport={'width': width, 'height': height},
                                      device_scale_factor=1, is_mobile=mobile,
                                      has_touch=mobile)
        page = context.new_page()
        errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.goto((ROOT / 'brawl.html').as_uri(), wait_until='domcontentloaded')
        page.wait_for_function("window.brawl && brawl.state === 'menu'")
        page.evaluate("brawl.start({instant:true,ai:false,seed:7391,selected:0,mode:'last'}); brawl.sim.finish(0); brawl.events(); brawl.audio.muted=true")
        page.wait_for_timeout(1750)
        if label == 'desktop':
            page.screenshot(path=str(OUT / 'arrival.png'))
        page.wait_for_timeout(3100)
        page.screenshot(path=str(OUT / f'{label}-battle.png'))
        state = page.evaluate("""() => {
            const hud=document.querySelector('#bossHud').getBoundingClientRect();
            const canvas=document.querySelector('canvas').getBoundingClientRect();
            const b=brawl.sim.boss, r=brawl.scene.R;
            return {phase:b.phase,tier:b.tier,hp:b.hp,crew:brawl.sim.fighters.map(f=>({hp:f.hp,ko:f.ko,state:f.state})),
                hud:{x:hud.x,y:hud.y,w:hud.width,h:hud.height},canvas:{w:canvas.width,h:canvas.height},
                draws:r.draws,triangles:r.tris};
        }""")
        assert state['phase'] == 'battle', (label, state)
        assert state['hud']['x'] >= 0 and state['hud']['x'] + state['hud']['w'] <= width + 1, (label, state)
        assert all(not f['ko'] and f['hp'] > 0 for f in state['crew']), (label, state)
        if label == 'mobile':
            old_hp = page.evaluate('brawl.sim.boss.hp')
            assert page.locator('[data-action="kick"]').is_visible()
            assert page.locator('#kickLabel').inner_text() == 'POWER'
            page.locator('[data-action="punch"]').tap()
            page.wait_for_timeout(150)
            assert page.evaluate('brawl.sim.boss.hp') < old_hp
            page.evaluate('brawl.sim.fighters[0].weaponCooldown=0')
            old_hp = page.evaluate('brawl.sim.boss.hp')
            page.locator('[data-action="kick"]').tap()
            page.wait_for_timeout(150)
            assert page.evaluate('brawl.sim.boss.hp') < old_hp
        pacing = page.evaluate("""() => new Promise(resolve => {
            let frames=[],start=0,last=0;
            function tick(now){if(!start)start=now;if(last)frames.push(now-last);last=now;
                if(now-start<2000){requestAnimationFrame(tick);return;}
                const sorted=frames.slice().sort((a,b)=>a-b);
                resolve({samples:frames.length,meanMs:frames.reduce((a,b)=>a+b,0)/frames.length,
                    p95Ms:sorted[Math.floor(sorted.length*.95)],maxMs:sorted.at(-1),
                    over33Ms:frames.filter(v=>v>33.3).length});}
            requestAnimationFrame(tick);
        })""")
        state['pacing'] = pacing
        if label == 'desktop':
            page.evaluate("""() => {let b=brawl.sim.boss;b.attack='charge';b.attackAge=.72;b.targetIds=[0,1,2];b.targetPoints=brawl.sim.fighters.slice(0,3).map(f=>({x:f.x,z:f.z}));brawl.scene.render(brawl.sim,0,'playing');}""")
            page.screenshot(path=str(OUT / 'cannon-charge.png'))
            page.evaluate("""() => {let b=brawl.sim.boss;b.attack='claw';b.attackAge=.55;b.targetIds=[0];brawl.scene.render(brawl.sim,0,'playing');}""")
            page.screenshot(path=str(OUT / 'claw-reach.png'))
            # Drive the collapse and powered rebuild at two different animation times.
            page.evaluate("""() => {let s=brawl.sim;while(s.boss.phase==='battle')s.bossFire(s.fighters[0],true);brawl.events();}""")
            page.wait_for_timeout(400)
            page.screenshot(path=str(OUT / 'collapse.png'))
            page.wait_for_timeout(2000)
            page.screenshot(path=str(OUT / 'resurrection.png'))
            assert page.evaluate("brawl.sim.boss.phase === 'resurrect'")
        assert not errors, (label, errors)
        results.append({'label': label, 'viewport': [width, height], **state, 'errors': errors})
        print(json.dumps(results[-1]), flush=True)
        context.close()
    browser.close()

(OUT / 'report.json').write_text(json.dumps(results, indent=2), encoding='utf-8')
