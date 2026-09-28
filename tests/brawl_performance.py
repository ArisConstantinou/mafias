"""Compare steady Brawl frame pacing on the protected server and a candidate page."""
from pathlib import Path
import json
import sys
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parent.parent
OUT=ROOT/'.qa-run'/'brawl-pressure'/'performance.json'
CHROME=Path(r'C:\Program Files\Google\Chrome\Application\chrome.exe')
BASELINE='http://127.0.0.1:5174/brawl.html'
CANDIDATE=(ROOT/'brawl.html').as_uri()

def sample(browser,label,url,width,height,mobile):
    context=browser.new_context(viewport={'width':width,'height':height},device_scale_factor=1,is_mobile=mobile,has_touch=mobile)
    page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto(url,wait_until='domcontentloaded')
    page.wait_for_function("window.brawl && brawl.state==='menu'",timeout=20000)
    page.evaluate("brawl.start({instant:true,ai:true,seed:7391,selected:0,mode:'score'});brawl.audio.muted=true")
    page.wait_for_timeout(800)
    values=page.evaluate('''() => new Promise(resolve=>{
      const frames=[];let start=0,last=0;
      function tick(now){if(!start)start=now;if(last)frames.push(now-last);last=now;
        if(now-start<5000){requestAnimationFrame(tick);return;}
        const sorted=frames.slice().sort((a,b)=>a-b),gl=brawl.scene.R.gl,ext=gl.getExtension('WEBGL_debug_renderer_info');
        resolve({samples:frames.length,meanMs:frames.reduce((a,b)=>a+b,0)/frames.length,
          p95Ms:sorted[Math.floor(sorted.length*.95)],maxMs:sorted.at(-1),over33Ms:frames.filter(v=>v>33.3).length,
          draws:brawl.scene.R.draws,triangles:brawl.scene.R.tris,pixelRatio:brawl.scene.R.pixelRatio,
          renderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),state:brawl.state});}
      requestAnimationFrame(tick);
    })''')
    page.evaluate('gc()')
    cdp=context.new_cdp_session(page)
    cdp.send('Performance.enable')
    metrics={m['name']:m['value'] for m in cdp.send('Performance.getMetrics')['metrics']}
    values['jsHeapUsedMb']=metrics['JSHeapUsedSize']/1048576
    values['domNodes']=metrics['Nodes']
    values['jsListeners']=metrics['JSEventListeners']
    context.close()
    assert values['state']=='playing' and not errors,(label,values,errors)
    return {'label':label,'viewport':[width,height],'url':url,'errors':errors,**values}

def main():
    OUT.parent.mkdir(parents=True,exist_ok=True)
    results=[]
    with sync_playwright() as pw:
        browser=pw.chromium.launch(executable_path=str(CHROME),headless=True,args=['--js-flags=--expose-gc'])
        for width,height,mobile in ((1280,800,False),(430,932,True)):
            for label,url in (('baseline',BASELINE),('candidate',CANDIDATE)):
                value=sample(browser,label,url,width,height,mobile)
                results.append(value)
                print(json.dumps({k:value[k] for k in ('label','viewport','meanMs','p95Ms','maxMs','over33Ms','draws','triangles','jsHeapUsedMb','domNodes','renderer')}),flush=True)
        browser.close()
    OUT.write_text(json.dumps(results,indent=2),encoding='utf-8')
    return 0

if __name__=='__main__':sys.exit(main())
