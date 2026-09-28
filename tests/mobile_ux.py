"""Capture the same mobile race scene and control inputs before/after UX changes."""
import argparse
import json
import os
import shutil
import sys
from pathlib import Path
from playwright.sync_api import sync_playwright

parser = argparse.ArgumentParser()
parser.add_argument('html', type=Path)
parser.add_argument('output', type=Path)
parser.add_argument('--expect-improved', action='store_true')
args = parser.parse_args()
sys.stdout.reconfigure(encoding='utf-8')
args.output.mkdir(parents=True, exist_ok=True)
BROWSER = os.environ.get('CHROMIUM_EXECUTABLE') or next((str(path) for path in (
    Path(r'C:\Program Files\Google\Chrome\Application\chrome.exe'),
    Path(r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'),
    Path('/usr/lib/chromium/chromium'),
) if path.exists()), shutil.which('chromium'))
BROWSER_ARGS = [] if os.name == 'nt' else ['--no-sandbox', '--disable-dev-shm-usage']

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=BROWSER, headless=True, args=BROWSER_ARGS)
    page = browser.new_page(viewport={'width': 430, 'height': 932}, device_scale_factor=1)
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.set_content(args.html.read_text(encoding='utf-8'), wait_until='domcontentloaded')
    page.wait_for_function("window.voltRoast && voltRoast.state==='menu'", timeout=20000)
    page.evaluate('voltRoast.frame=()=>{}')
    scene = page.evaluate('''() => {
      const g=voltRoast;
      g.start();g.state='racing';$('countdown').style.display='none';
      g.time=15;g.raceTime=12;
      const coords=[[96,0],[104,-3],[101,2.5],[112,.4]];
      g.riders.forEach((r,i)=>{r.s=coords[i][0];r.lane=coords[i][1];r.speed=16;r.hp=[84,76,69,92][i];r.hits=[5,5,3,1][i];});
      g.updatePositions();g.registerHit(g.player,g.riders[1]);
      g.settings.quality='high';g.resize();g.render(1/60);
      const boxes=[...document.querySelectorAll('.bubble')].filter(e=>Number(e.style.opacity)>.5).map(e=>{let b=e.getBoundingClientRect();return {x:b.x,y:b.y,w:b.width,h:b.height};});
      const caption=document.getElementById('dialogueCaption');
      let captionBox=null;if(caption){let b=caption.getBoundingClientRect();captionBox={x:b.x,y:b.y,w:b.width,h:b.height,text:caption.innerText};}
      return {boxes,captionBox,speakers:g.riders.filter(r=>r.speechUntil>g.time).length};
    }''')
    page.screenshot(path=str(args.output / 'mobile-dialogue.png'))
    settings = page.evaluate('''() => {
      const g=voltRoast, first=g.nextDialogueAt;
      g.registerHit(g.player,g.riders[1]);
      const throttled=g.nextDialogueAt===first && g.riders.filter(r=>r.speechUntil>g.time).length===1;
      const toggle=document.getElementById('dialogueSetting');
      if(toggle){toggle.checked=false;toggle.dispatchEvent(new Event('change'));g.render(1/60);}
      const hidden=document.getElementById('dialogueCaption').style.opacity==='0';
      if(toggle){toggle.checked=true;toggle.dispatchEvent(new Event('change'));}
      return {throttled,hidden};
    }''')
    layouts = {}
    for name, width, height in [('small-portrait', 360, 780), ('landscape', 844, 390), ('desktop', 1280, 800)]:
        page.set_viewport_size({'width': width, 'height': height})
        page.evaluate('voltRoast.resize();voltRoast.render(1/60)')
        page.screenshot(path=str(args.output / f'{name}.png'))
        layouts[name] = page.locator('#dialogueCaption').bounding_box()
    controls = page.evaluate('''() => {
      const g=voltRoast;
      function run(x,y){
        g.start();g.state='racing';g.world.obstacles=[];g.world.pickups=[];
        g.controlAI=()=>{};g.riders.slice(1).forEach((r,i)=>{r.s=200+i*30;r.lane=0;});
        g.sticks.left.x=x;g.sticks.left.y=y;
        for(let i=0;i<60;i++)g.update(1/60);
        return {speed:g.player.speed,kmh:g.player.speed*3.6,lane:g.player.lane,boost:g.player.boosting,energy:g.player.energy,label:document.querySelector('.stick-wrap.left .stick-title').textContent};
      }
      return {cruise:run(0,0),diagonal:run(.78,-.22),steer:run(.78,0),brake:run(0,.6)};
    }''')
    result = {'scene':scene, 'settings':settings, 'layouts':layouts, 'controls':controls, 'errors':errors}
    (args.output / 'mobile-ux.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps(result,ensure_ascii=False,indent=2))
    if args.expect_improved:
        assert not errors, errors
        assert len(scene['boxes']) == 0, scene
        assert scene['speakers'] <= 1, scene
        assert scene['captionBox'] and scene['captionBox']['h'] < 70, scene
        assert scene['captionBox']['y'] + scene['captionBox']['h'] < 250, scene
        assert settings == {'throttled': True, 'hidden': True}, settings
        assert layouts['landscape'] and layouts['landscape']['y'] < 55, layouts
        assert layouts['small-portrait'] and layouts['small-portrait']['y'] + layouts['small-portrait']['height'] < 245, layouts
        assert controls['cruise']['kmh'] >= 55, controls
        assert controls['diagonal']['boost'] and controls['diagonal']['kmh'] >= 75, controls
        assert controls['steer']['lane'] >= 4, controls
        assert controls['cruise']['label']=='LEFT · DRIVE' and controls['diagonal']['label']=='BOOST + RIGHT', controls
        assert controls['steer']['label']=='STEER RIGHT' and controls['brake']['label']=='BRAKE', controls
    browser.close()
