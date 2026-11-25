from pathlib import Path
import json,sys,csv
p=Path(__file__).resolve().parents[1]
read=lambda n:json.loads((p/'data'/n).read_text(encoding='utf-8'))
f,c,v,s=map(read,['fleet.json','component-catalog.json','coverage.json','sources.json'])
a={m['id'] for m in f}; b={m['id'] for m in c}
assert len(a)==len(f)==5 and len(b)==len(c)
assert len(v)==len(a)*len(b) and len({(r['aircraft'],r['part']) for r in v})==len(v)
assert all(r['aircraft'] in a and r['part'] in b for r in v)
assert all(k in s for x in f for k in x['refs'])
assert all(k in s for x in c for k in x['source'])
assert all(r['status']=='not-applicable' for r in v if r['aircraft']=='matrix' and (r['part'].startswith('jet.') and r['part']!='jet.reverser' or r['part'] in ['cabin.press','structure.pressure','jet.reverser']))
for q in (p/'.claude/skills').glob('*/SKILL.md'): assert q.read_text().startswith('---\nname:')
for q in (p/'.claude/agents').glob('*.md'): assert q.read_text().startswith('---\nname:')
print(f'OK: {len(f)} aeronaves, {len(c)} conceitos, {len(v)} avaliações; {len(s)} fontes/links.')
