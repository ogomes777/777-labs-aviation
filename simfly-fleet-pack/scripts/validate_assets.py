"""Valida arquivos e nós GLB declarados. Não certifica fidelidade ou qualidade visual."""
from pathlib import Path
import json,struct,sys,argparse
p=argparse.ArgumentParser();p.add_argument('repo');p.add_argument('manifest');p.add_argument('--release',action='store_true');a=p.parse_args()
root=Path(a.repo).resolve(); manifest=json.loads(Path(a.manifest).read_text(encoding='utf-8')); errors=[]
def glb(f):
 data=f.read_bytes(); magic,ver,length=struct.unpack_from('<4sII',data)
 if magic!=b'glTF' or ver!=2 or length!=len(data):raise ValueError('GLB inválido')
 n,k=struct.unpack_from('<II',data,12)
 if k!=0x4e4f534a or n>len(data)-20:raise ValueError('JSON chunk inválido')
 return json.loads(data[20:20+n].decode('utf-8'))
def has_mesh(g,i,seen=None):
 seen=set() if seen is None else seen
 if i in seen:return False
 seen.add(i); node=g['nodes'][i]; mi=node.get('mesh')
 if isinstance(mi,int) and any(p.get('attributes',{}).get('POSITION') is not None for p in g['meshes'][mi].get('primitives',[])):return True
 return any(has_mesh(g,k,seen) for k in node.get('children',[]))
expected={'legacy-450','praetor-500','praetor-600','matrix','citation-cj2-plus'}
if {m['id'] for m in manifest['aircraft']}!=expected or len(manifest['aircraft'])!=5:errors.append('IDs da frota inválidos')
for m in manifest['aircraft']:
 graphs={}; mid=m['id']
 if a.release and (m.get('status')!='ready' or not m.get('license') or not m.get('dimensions')):errors.append(mid+': status/licença/dimensões pendentes')
 for key,rel in m['files'].items():
  f=(root/rel).resolve()
  if root not in f.parents:errors.append(mid+': caminho fora do repo');continue
  if not f.is_file():
   if a.release:errors.append(mid+': ausente '+key)
   continue
  if f.suffix.lower()=='.glb':
   try:graphs[key]=glb(f)
   except Exception as e:errors.append(mid+': '+str(e))
 if a.release and not any(x.get('enabled') for x in m['parts']):errors.append(mid+': sem peças habilitadas')
 for part in m['parts']:
  if not part.get('enabled'):continue
  if not part.get('sourceRefs') or part.get('fidelity') not in ('verified','illustrative-approved'):errors.append(mid+': evidência ausente '+part['id'])
  g=graphs.get(part['asset'],{}); hits=[i for i,n in enumerate(g.get('nodes',[])) if n.get('name')==part['node']]
  try: valid=len(hits)==1 and has_mesh(g,hits[0])
  except Exception:valid=False
  if not valid:errors.append(mid+': nó ausente/ambíguo/sem mesh '+part['id'])
if errors:print('\n'.join(errors));sys.exit(1)
print('Validação estrutural passou; ainda requer inspeção visual, AABB e cobertura por sistema.')
