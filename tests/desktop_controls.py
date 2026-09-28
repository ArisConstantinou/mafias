"""Focused desktop camera and keyboard regression for both game modes."""
from pathlib import Path
import json
import math
import os
import shutil
import statistics
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / '.qa-run' / 'desktop-controls'
OUT.mkdir(parents=True, exist_ok=True)
BROWSER = os.environ.get('CHROMIUM_EXECUTABLE') or next((
    str(path) for path in (
        Path(r'C:\Program Files\Google\Chrome\Application\chrome.exe'),
        Path(r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'),
        Path('/usr/bin/chromium'),
    ) if path.exists()
), shutil.which('chromium'))

with sync_playwright() as pw:
    browser = pw.chromium.launch(executable_path=BROWSER, headless=True)
    page = browser.new_page(viewport={'width': 1280, 'height': 800}, device_scale_factor=1)
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.goto((ROOT / 'index.html').as_uri(), wait_until='domcontentloaded')
    page.wait_for_function("window.voltRoast && voltRoast.state==='menu'", timeout=20000)
    page.set_viewport_size({'width': 844, 'height': 390})
    assert page.locator('#menuKeyboardHint').is_hidden()
    page.screenshot(path=str(OUT / 'scooter-landscape-menu.png'))
    page.set_viewport_size({'width': 1280, 'height': 800})
    page.screenshot(path=str(OUT / 'scooter-menu.png'))
    page.click('#startBtn')
    page.wait_for_function("voltRoast.state==='racing'", timeout=20000)
    page.screenshot(path=str(OUT / 'scooter-after.png'))
    camera = page.evaluate('''() => {
      const g=voltRoast, samples=[];
      g.frame=()=>{};
      g.audio.muted=true;
      g.riders.slice(1).forEach((r,i)=>{r.s=g.player.s+100+i*50;r.lane=5;r.aiNext=1e6;});
      g.controlAI=()=>{};g.world.obstacles=[];g.world.pickups=[];
      g.cameraEye=null;g.cameraTarget=null;g.shake=0;
      // Simulate a 144 Hz display over a 60 Hz fixed physics clock.
      let accumulator=0;
      for(let i=0;i<144;i++){
        const dt=1/144;accumulator+=dt;
        while(accumulator>=1/60){g.update(1/60);accumulator-=1/60;}
        g.render(dt,accumulator*60);
        samples.push({eye:[...g.R.eye],player:[...g.player.pos],shake:g.shake});
      }
      return {samples,health:g.player.hp,hitCount:g.player.hits};
    }''')
    assert camera['health'] == 100 and camera['hitCount'] == 0
    eyes = [sample['eye'] for sample in camera['samples']]
    velocity = [math.dist(eyes[i], eyes[i-1])*144 for i in range(1, len(eyes))]
    step_jitter = statistics.pstdev(velocity[i]-velocity[i-1] for i in range(40, len(velocity)))
    assert step_jitter < .2, step_jitter
    print(json.dumps({'camera_samples': len(eyes), 'step_jitter': step_jitter, 'health': camera['health'], 'hits': camera['hitCount']}))
    # Verify actual keyboard routing, not only the presence of a legend.
    page.evaluate("() => {let g=voltRoast;g.start();g.state='racing';g.audio.muted=true;g.world.obstacles=[];g.world.pickups=[];g.controlAI=()=>{};g.riders.slice(1).forEach((r,i)=>{r.s=g.player.s+100+i*50;r.lane=5;});}")
    page.keyboard.down('KeyW'); page.keyboard.down('KeyD')
    page.evaluate('for(let i=0;i<45;i++)voltRoast.update(1/60)')
    drive = page.evaluate('({lane:voltRoast.player.lane,boost:voltRoast.player.boosting,energy:voltRoast.player.energy})')
    page.keyboard.up('KeyD'); page.keyboard.up('KeyW')
    assert drive['lane'] > 1 and drive['boost'] and drive['energy'] < 100, drive
    page.keyboard.down('KeyI'); page.keyboard.down('KeyL')
    page.evaluate('for(let i=0;i<2;i++)voltRoast.update(1/60)')
    aim = page.evaluate('({vs:voltRoast.player.shotVs,vl:voltRoast.player.shotVl})')
    page.keyboard.up('KeyI'); page.keyboard.up('KeyL')
    assert aim['vs'] > 0 and aim['vl'] > 0, aim
    page.keyboard.press('Space')
    page.evaluate('for(let i=0;i<35;i++)voltRoast.update(1/60)')
    assert page.evaluate('voltRoast.player.shotVs') > 0
    page.keyboard.down('KeyS')
    page.evaluate('for(let i=0;i<50;i++)voltRoast.update(1/60)')
    assert page.evaluate('voltRoast.player.speed') < 6
    page.keyboard.up('KeyS')
    page.keyboard.down('ArrowLeft')
    page.evaluate('for(let i=0;i<35;i++)voltRoast.update(1/60)')
    assert page.evaluate('voltRoast.player.shotVl') < 0
    page.keyboard.up('ArrowLeft')
    for digit, item in enumerate(('banana','pins','oil','box'), 1):
        page.evaluate('voltRoast.player.throwReady=0')
        before_item = page.evaluate('item=>voltRoast.player.inventory[item]', item)
        page.keyboard.press(f'Digit{digit}')
        assert page.evaluate('item=>voltRoast.player.inventory[item]', item) == before_item-1
    page.keyboard.press('Escape')
    assert page.evaluate('voltRoast.state') == 'paused'
    page.keyboard.press('Escape')
    assert page.evaluate('voltRoast.state') == 'racing'
    print(json.dumps({'scooter_keyboard': {'drive': drive, 'aim': aim, 'fire': True, 'brake': True, 'arrow_aim': True, 'items_1_to_4': True, 'pause': True}}))
    page.goto((ROOT / 'brawl.html').as_uri(), wait_until='domcontentloaded')
    page.wait_for_function("window.brawl && brawl.state==='menu'", timeout=20000)
    page.set_viewport_size({'width': 844, 'height': 390})
    assert page.locator('.menu-keyboard').is_hidden()
    page.screenshot(path=str(OUT / 'brawl-landscape-menu.png'))
    page.set_viewport_size({'width': 1280, 'height': 800})
    page.screenshot(path=str(OUT / 'brawl-menu.png'))
    def start_brawl():
        page.evaluate("() => {brawl.start({instant:true,ai:false,seed:7391,selected:0});brawl.testFrozen=true;let s=brawl.sim,p=s.fighters[0],q=s.fighters[1];q.x=p.x+1.15;q.z=p.z;q.inv=0;s.fighters[2].x=8;s.fighters[3].x=9;}")
    for key, action, duration in [('KeyJ','punch',300),('KeyK','kick',550)]:
        start_brawl()
        page.keyboard.press(key)
        page.evaluate('ms=>advanceTime(ms)', duration)
        hp = page.evaluate('brawl.sim.fighters[1].hp')
        assert hp < 100, (action, hp)
        if action == 'punch': page.screenshot(path=str(OUT / 'brawl-keyboard.png'))
    start_brawl()
    page.keyboard.down('KeyD'); page.keyboard.down('KeyW')
    before = page.evaluate('({x:brawl.sim.fighters[0].x,z:brawl.sim.fighters[0].z})')
    page.evaluate('advanceTime(350)')
    after = page.evaluate('({x:brawl.sim.fighters[0].x,z:brawl.sim.fighters[0].z})')
    page.keyboard.up('KeyD'); page.keyboard.up('KeyW')
    assert after['x'] > before['x'] and after['z'] < before['z'], (before, after)
    start_brawl(); page.keyboard.press('Space')
    assert page.evaluate('brawl.sim.fighters[0].stamina') < 100
    start_brawl(); page.evaluate('brawl.sim.dizzy(brawl.sim.fighters[1],2.5)'); page.keyboard.press('KeyL')
    assert page.evaluate('brawl.sim.fighters[0].grabTarget') == 1
    start_brawl()
    page.evaluate("() => {let s=brawl.sim,p=s.fighters[0],o=s.items[0];o.x=p.x+.5;o.z=p.z;o.held=null;o.flying=false;o.broken=false;o.slipUntil=0;}")
    page.keyboard.press('KeyE')
    assert page.evaluate('brawl.sim.fighters[0].held') is not None
    page.evaluate('advanceTime(400)')
    page.keyboard.press('KeyE')
    page.evaluate('advanceTime(250)')
    assert page.evaluate('brawl.sim.fighters[0].throws') == 1
    page.keyboard.press('Escape')
    assert page.evaluate('brawl.state') == 'paused'
    print(json.dumps({'brawl_keyboard': {'move': True, 'punch': True, 'kick': True, 'dizzy_grab': True, 'dodge': True, 'pickup_throw': True, 'pause': True}}))
    assert not errors, errors
    browser.close()
