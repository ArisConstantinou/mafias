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
for name in ['engine','world','game']:
    s=s.replace('/*'+name.upper()+'*/',(ROOT/'src'/f'{name}.js').read_text(encoding='utf-8'))
(ROOT/'index.html').write_bytes(s.encode('utf-8'))
print(f'Built {len(s.encode())/1024/1024:.2f} MB single-file index.html')
