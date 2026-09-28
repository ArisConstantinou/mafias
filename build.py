#!/usr/bin/env python3
"""Rebuild the single-file game using only Python's standard library."""
from pathlib import Path
import json, base64
ROOT=Path(__file__).resolve().parent

def data(path, mime):
    return f'data:{mime};base64,'+base64.b64encode(path.read_bytes()).decode()
assets={
 'heads':[data(ROOT/'assets'/f'head-{i+1}.png','image/png') for i in range(4)],
 'lines':json.loads((ROOT/'assets'/'dialogue.json').read_text(encoding='utf-8')),
 'voices':{p.stem:data(p,'audio/mpeg') for p in sorted((ROOT/'assets').glob('*.mp3'))},
 'items':{t:data(ROOT/'assets'/f'{t}.png','image/png') for t in ['banana','pins','oil','box']}
}
s=(ROOT/'src'/'template.html').read_text(encoding='utf-8')
s=s.replace('/*ASSETS*/','const ASSETS='+json.dumps(assets,ensure_ascii=False,separators=(',',':'))+';')
s=s.replace('/*MODE_SCOOTER_ICON*/',data(ROOT/'assets'/'mode-scooter.webp','image/webp'))
s=s.replace('/*MODE_BRAWL_ICON*/',data(ROOT/'assets'/'mode-brawl.webp','image/webp'))
for name in ['engine','world','game']:
    s=s.replace('/*'+name.upper()+'*/',(ROOT/'src'/f'{name}.js').read_text(encoding='utf-8'))
(ROOT/'index.html').write_bytes(s.encode('utf-8'))
print(f'Built {len(s.encode())/1024/1024:.2f} MB single-file index.html')

# Keep the imported brawl editable while publishing it as a standalone page.
brawl_mime={'.mp3':'audio/mpeg','.png':'image/png','.svg':'image/svg+xml',
            '.webp':'image/webp','.gz':'application/gzip','.json':'application/json'}
brawl_assets={p.name:data(p,brawl_mime[p.suffix])
              for p in sorted((ROOT/'assets').iterdir())
              if p.suffix in brawl_mime and (p.name.startswith('boss-') or
                 (p.suffix in ('.mp3','.png','.svg') and not p.name.startswith('mode-')))}
brawl=(ROOT/'src'/'brawl'/'template.html').read_text(encoding='utf-8')
brawl=brawl.replace('/*BRAWL_STYLE*/',(ROOT/'src'/'brawl'/'style.css').read_text(encoding='utf-8'))
brawl=brawl.replace('/*BRAWL_ASSETS*/','window.BRAWL_ASSETS='+json.dumps(brawl_assets,ensure_ascii=False,separators=(',',':'))+';')
for name in ['engine','combat','boss','world','app']:
    source=ROOT/'src'/'engine.js' if name=='engine' else ROOT/'src'/'brawl'/f'{name}.js'
    brawl=brawl.replace('/*BRAWL_'+name.upper()+'*/',source.read_text(encoding='utf-8'))
(ROOT/'brawl.html').write_bytes(brawl.encode('utf-8'))
print(f'Built {len(brawl.encode())/1024/1024:.2f} MB single-file brawl.html')
