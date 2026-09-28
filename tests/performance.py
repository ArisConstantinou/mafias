from pathlib import Path
import os, shutil, sys
from playwright.sync_api import sync_playwright
import json
ROOT=Path(__file__).resolve().parent.parent
BROWSER=os.environ.get('CHROMIUM_EXECUTABLE') or next((str(path) for path in (
 Path(r'C:\Program Files\Google\Chrome\Application\chrome.exe'),
 Path(r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'),
 Path('/usr/lib/chromium/chromium'),
) if path.exists()),shutil.which('chromium'))
BROWSER_ARGS=[] if os.name=='nt' else ['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=gl','--ignore-gpu-blocklist']
out=[]
with sync_playwright() as p:
 b=p.chromium.launch(executable_path=BROWSER,headless=True,args=BROWSER_ARGS)
 for width,height in [(1280,800),(430,932)]:
  ctx=b.new_context(viewport={'width':width,'height':height},device_scale_factor=1,offline=True)
  page=ctx.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.set_content((ROOT/'index.html').read_text(encoding='utf-8'),wait_until='domcontentloaded')
  page.wait_for_function("window.voltRoast && voltRoast.state!=='loading'",timeout=20000)
  assert page.evaluate("voltRoast.state==='menu'")
  page.click('#startBtn')
  page.evaluate("voltRoast.state='racing';document.getElementById('countdown').style.display='none';voltRoast.audio.muted=true")
  page.wait_for_timeout(8000)
  result=page.evaluate('''() => {let g=voltRoast,gl=g.R.gl,e=gl.getExtension('WEBGL_debug_renderer_info');return {viewport:[innerWidth,innerHeight],fps:g.fps,pixelRatio:g.R.pixelRatio,triangles:g.R.tris,drawCalls:g.R.draws,renderer:e?gl.getParameter(e.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),state:g.state,voicesDecoded:Object.keys(g.audio.buffers).length};}''')
  result['offline_load_passed']=True;result['js_errors']=errors;out.append(result);print(json.dumps(result),flush=True)
  ctx.close()
 b.close()
(ROOT/'tests'/'performance.json').write_text(json.dumps(out,indent=2),encoding='utf-8')
