import * as THREE from 'three';
import { DETAILS, detailById, detailHotspots } from '@/content/anatomy24';
import type { PartId } from '@/content/site';
import type { JetBuild } from './jet/buildJet';
import { makeAnatomyModel, schematicIds } from './anatomy25Models';
import { damp } from '@/experience/director';

type Mesh = THREE.Mesh<THREE.BufferGeometry, THREE.Material | THREE.Material[]>;
const asMeshes=(o:THREE.Object3D|undefined)=>{const a:Mesh[]=[];o?.traverse(x=>{if((x as Mesh).isMesh)a.push(x as Mesh)});return a};
const named=(o:THREE.Object3D,name:string)=>{const a:Mesh[]=[];o.traverse(x=>{if(x.name===name)a.push(...asMeshes(x))});return [...new Set(a)]};
const firstNamed=(o:THREE.Object3D,name:string)=>{const n=o.getObjectByName(name);return asMeshes(n);};
export function createAnatomy24(jet:JetBuild){
 const groups=jet.parts, all=Object.values(groups).flatMap(asMeshes);
 const cabin=groups.cabine;
 const table:Record<string,Mesh[]>={shell:named(groups.fuselagem,'shell'),windshield:named(groups.fuselagem,'windshield'),glass:named(groups.fuselagem,'glass'),fairing:named(groups.fuselagem,'fairing'), 'wing-port':named(groups.asas,'wing--1'),'wing-starboard':named(groups.asas,'wing-1'), fan:[...named(groups.motores,'rotor'),...named(groups.motores,'fan-disc')], 'gear-nose':named(groups.trem,'gear-nose'),'gear-main':named(groups.trem,'gear-main'),strut:named(groups.trem,'strut'),axle:named(groups.trem,'axle'),wheel:[...named(groups.trem,'wheel'),...named(groups.trem,'hub')],seat:firstNamed(cabin,'seat'),table:named(cabin,'table'),bezels:named(cabin,'bezels'),reveals:named(cabin,'reveals')};
 for(const id of ['nacelle','lip','duct','pylon','exhaust-duct','exhaust-cone'])table[id]=firstNamed(groups.motores,id);
 table.fan=[...firstNamed(groups.motores,'rotor'),...firstNamed(groups.motores,'fan-disc')];
 for(const id of ['fin','stab'])table[id]=named(groups.empenagem,id);
 const original=new Map<Mesh,Mesh['material']>(), tinted=new Map<THREE.Material,THREE.Material>();
 const hidden=new Map<Mesh,boolean>(), shifted=new Map<Mesh,THREE.Vector3>();
 const models=new Map<string,ReturnType<typeof makeAnatomyModel>>();
 let selected:Mesh[]=[], signature='', blend=0, sep=0, angle=0, pitch=.65;
 const box=new THREE.Box3(), b=new THREE.Box3(), center=new THREE.Vector3(), extent=new THREE.Vector3(), point=new THREE.Vector3(), eye=new THREE.Vector3(), target=new THREE.Vector3(), right=new THREE.Vector3(), direction=new THREE.Vector3();
 const up=new THREE.Vector3(0,1,0);
 const color=new THREE.Color('#146aff');
 function restoreFrame(){for(const [m,v] of hidden)m.visible=v;hidden.clear();for(const [m,v] of shifted)m.position.copy(v);shifted.clear();}
 function clearTint(){for(const [m,v] of original)m.material=v;original.clear();for(const m of tinted.values())m.dispose();tinted.clear();}
 function tint(m:THREE.Material){let q=tinted.get(m);if(q)return q; q=m.clone();q.onBeforeCompile=m.onBeforeCompile;q.customProgramCacheKey=m.customProgramCacheKey;q.clippingPlanes=m.clippingPlanes;const s=q as THREE.MeshStandardMaterial;if(s.emissive){s.emissive.copy(color);s.emissiveIntensity=.78;}tinted.set(m,q);return q;}
 function setSelection(part:PartId|null,detail:string|null){const d=detailById(detail);const sig=part?`${part}/${detail??''}`:'';if(sig===signature)return;signature=sig;clearTint();for(const m of models.values())m.group.visible=false; if(d && (schematicIds.has(d.id) || !table[d.id]?.length)){let m=models.get(d.id);if(!m){m=makeAnatomyModel(d.id,jet);models.set(d.id,m);table[d.id]=asMeshes(m.group);}m.group.visible=true;} selected=part?(d?.modeled?table[d.id]??[]:asMeshes(groups[part])):[];if(part==='cabine'&&!d)selected=selected.filter(m=>m.material!==jet.cabin.materials[0]&&!['ceiling','lining','cove-light','ceiling-lip','downlight'].includes(m.name));for(const m of selected){if(d?.schematic || (d && models.has(d.id)))continue;original.set(m,m.material);m.material=Array.isArray(m.material)?m.material.map(tint):tint(m.material);}}
 function bounds(meshes:Mesh[]){box.makeEmpty();for(const m of meshes){if(!m.geometry.boundingBox)m.geometry.computeBoundingBox();if(m.geometry.boundingBox){b.copy(m.geometry.boundingBox).applyMatrix4(m.matrixWorld);box.union(b)}}return box;}
 return { restoreFrame,dispose(){restoreFrame();clearTint();for(const m of models.values())m.dispose();models.clear();}, apply(cam:THREE.PerspectiveCamera,part:PartId|null,detail:string|null,requestedAngle:number,requestedPitch:number,explode:boolean,dt:number,time:number,w:number,h:number){
   setSelection(part,detail);const active=selected.length>0;blend=damp(blend,active?1:0,5,dt);sep=damp(sep,active&&explode?1:0,5,dt);angle=damp(angle,requestedAngle,9,dt);pitch=damp(pitch,requestedPitch,9,dt);
   if(!active)return false;
   // Reuse the real geometry; no extra WebGL canvas and no duplicate model.
   jet.group.updateMatrixWorld(true);
   if(sep>.001&&selected.length>1){bounds(selected).getCenter(center);for(let i=0;i<selected.length;i++){const m=selected[i];const base=m.position.clone();shifted.set(m,base);if(!m.geometry.boundingBox)continue;m.geometry.boundingBox.getCenter(point).applyMatrix4(m.matrixWorld);const offset=point.sub(center);if(offset.lengthSq()<.00001)offset.set(0,1,0);if(detail==='core'){offset.set(offset.x*.85,offset.y*.12,offset.z*.12).multiplyScalar(sep);}else{offset.normalize().multiplyScalar(sep*Math.min(1.25,.10+selected.length*.025));}if(m.parent){const world=m.getWorldPosition(eye);target.copy(world).add(offset);m.parent.worldToLocal(world);m.parent.worldToLocal(target);m.position.add(target.sub(world));}}jet.group.updateMatrixWorld(true);}
   if(blend>.20){const keep=new Set(selected);for(const m of all)if(!keep.has(m)){hidden.set(m,m.visible);m.visible=false;}}
   for(const m of tinted.values()){const mat=m as THREE.MeshStandardMaterial;if(mat.emissive)mat.emissiveIntensity=.72+.16*Math.sin(time*3.1);}
   bounds(selected);if(box.isEmpty())return false;box.getCenter(center);box.getSize(extent);const span=Math.max(.55,extent.length());const aspect=Math.max(.3,w/h);const portrait=aspect<1;const dist=Math.max(2.5,span*(portrait?2.3:1.58));const cabinPlan=part==='cabine'&&!detail;const p=cabinPlan?Math.min(1.55,pitch+.65):pitch;direction.set(Math.cos(angle-.78)*Math.cos(p),Math.sin(p),Math.sin(angle-.78)*Math.cos(p)).normalize();eye.copy(center).addScaledVector(direction,dist);right.crossVectors(up,direction).normalize();target.copy(center).addScaledVector(right,portrait?0:dist*.14);if(portrait)target.y-=span*.10;cam.getWorldDirection(point);point.multiplyScalar(dist).add(cam.position);cam.position.lerp(eye,blend);cam.lookAt(point.lerp(target,blend));cam.fov=THREE.MathUtils.lerp(cam.fov,37,blend);cam.updateProjectionMatrix();cam.updateMatrixWorld(true);return true;
 }, project(cam:THREE.Camera,part:PartId|null,detail:string|null,w:number,h:number){
  const used:{x:number;y:number}[]=[]; for(const [id,el] of detailHotspots){const d=DETAILS.find(x=>x.id===id);const meshes=table[id];if(!d||d.group!==part||detail||!meshes?.length){el.style.display='none';continue;}bounds([meshes[0]]).getCenter(point);point.project(cam);const x=(point.x*.5+.5)*w,y=(-point.y*.5+.5)*h;const show=point.z>=-1&&point.z<=1&&x>24&&x<w-24&&y>65&&y<h-24&&!used.some(p=>Math.hypot(p.x-x,p.y-y)<25);el.style.display=show?'':'none';if(show){used.push({x,y});el.style.transform=`translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0)`;}}
 }};
}
