'use client';
import { useEffect, useMemo, useRef } from 'react';
import { PARTS, type PartId } from '@/content/site';
import { DETAILS, SYSTEM_NOTES, detailById, detailCounts, detailHotspots } from '@/content/anatomy24';
import { frame, ui } from '@/experience/director';
import { domRefs } from '@/experience/domRefs';
import { track } from '@/lib/analytics';
import stillAnchors from '@/content/anatomy-anchors.json';
import { anatomyDetailPreview, anatomySystemPreview } from '@/content/previews';
import { usePreview } from './preview/usePreview';
import HotspotPreview from './preview/HotspotPreview';
import { fmt, useM } from '@/i18n';
function pick(part: PartId, detail: string | null = null) {
  const st = ui.get();
  const same = st.part === part && st.anatomyDetail === detail;
  ui.set({part: same && !detail ? null : part, anatomyDetail: same ? null : detail, anatomyAngle:0,anatomyPitch:.65, anatomySubExplode:false, explodeManual: same && !detail ? null : 1, anatomyManualAt:frame.chapters[4]});
  track('anatomy_part',{part});
}
export function HotspotLayer() {
  const part = ui.useStore(s=>s.part), detail = ui.useStore(s=>s.anatomyDetail);
  const motion=ui.useStore(s=>s.motion), webgl=ui.useStore(s=>s.webgl), quality=ui.useStore(s=>s.quality);
  const drag=useRef<{x:number;y:number;id:number}|null>(null);
  const layer=useRef<HTMLDivElement>(null); const live=motion==='cinematic'&&webgl&&quality!=='lite';
  useEffect(()=>{domRefs.hotspotLayer=live?layer.current:null;return()=>{domRefs.hotspotLayer=null;domRefs.hotspots.clear();detailHotspots.clear();}},[live]);
  const anchors=stillAnchors as unknown as Record<string,[number,number]>;
  const preview=usePreview();
  const m=useM();
  // V6: o preview some ao selecionar e quando a seleção muda por outro caminho
  useEffect(()=>{preview.close();},[part,detail]); // eslint-disable-line react-hooks/exhaustive-deps
  return <div ref={layer} className="hotspots anatomy24-hotspots" data-visible={live?'false':'true'} data-mode={live?'live':'still'}>
    {live&&part&&<div className="anatomy25-orbit" role="region" aria-label={m.anatomy.dragAria} tabIndex={0} data-lenis-prevent onPointerDown={e=>{if(e.button!==0)return;drag.current={x:e.clientX,y:e.clientY,id:e.pointerId};e.currentTarget.setPointerCapture(e.pointerId);}} onPointerMove={e=>{const d=drag.current;if(!d||d.id!==e.pointerId)return;const dx=e.clientX-d.x,dy=e.clientY-d.y;d.x=e.clientX;d.y=e.clientY;ui.set(s=>({anatomyAngle:s.anatomyAngle-dx*.008,anatomyPitch:Math.max(-1.43,Math.min(1.43,s.anatomyPitch+dy*.008))}));}} onLostPointerCapture={()=>{drag.current=null;}} onPointerUp={()=>{drag.current=null;}} onPointerCancel={()=>{drag.current=null;}} onKeyDown={e=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;e.preventDefault();ui.set(s=>({anatomyAngle:s.anatomyAngle+(e.key==='ArrowLeft'?.2:e.key==='ArrowRight'?-.2:0),anatomyPitch:Math.max(-1.43,Math.min(1.43,s.anatomyPitch+(e.key==='ArrowUp'?.15:e.key==='ArrowDown'?-.15:0)))}));}}><span>{m.anatomy.drag}</span></div>}
    {PARTS.map(p=>{const a=anchors[p.id];return <button key={p.id} type="button" className="hotspot" style={!live&&a?{transform:'none',left:`${a[0]*100}%`,top:`${a[1]*100}%`}:undefined} ref={el=>{if(el&&live)domRefs.hotspots.set(p.id,el);else domRefs.hotspots.delete(p.id);}} aria-pressed={part===p.id} aria-label={m.anatomy.parts[p.id].label} tabIndex={-1} data-open={preview.state.item?.key===`anatomy:${p.id}`} aria-describedby={preview.state.item?.key===`anatomy:${p.id}`?'anatomy-preview':undefined} {...preview.bind(anatomySystemPreview(p.id,m),()=>pick(p.id))}><i/><span>{m.anatomy.parts[p.id].label}</span></button>;})}
    {live&&part&&!detail&&DETAILS.filter(d=>d.group===part&&d.modeled).map(d=><button key={d.id} className="hotspot anatomy24-subpoint" type="button" ref={el=>{if(el)detailHotspots.set(d.id,el);else detailHotspots.delete(d.id);}} tabIndex={-1} aria-label={m.anatomy.details[d.id as keyof typeof m.anatomy.details]?.label??d.label} data-open={preview.state.item?.key===`anatomy:${d.group}:${d.id}`} {...preview.bind(anatomyDetailPreview(d.id,m)!,()=>pick(d.group,d.id))}><i/><span>{m.anatomy.details[d.id as keyof typeof m.anatomy.details]?.label??d.label}</span></button>)}
    <HotspotPreview id="anatomy-preview" tone="light" state={preview.state} cardRef={preview.cardRef} onConfirm={preview.confirm} onEnter={preview.cancelClose} onLeave={preview.scheduleClose}/>
  </div>;
}
export default function AnatomyPanel(){
 const part=ui.useStore(s=>s.part), detail=ui.useStore(s=>s.anatomyDetail), exploded=ui.useStore(s=>s.anatomyExploded), sub=ui.useStore(s=>s.anatomySubExplode);
 const motion=ui.useStore(s=>s.motion),webgl=ui.useStore(s=>s.webgl),quality=ui.useStore(s=>s.quality); const live=motion==='cinematic'&&webgl&&quality!=='lite';
 const m=useM(), A=m.anatomy; const sel=PARTS.find(p=>p.id===part), d0=detailById(detail); const dt=d0?(A.details[d0.id as keyof typeof A.details]??{label:d0.label,text:d0.text}):null; const d=d0&&dt?{...d0,label:dt.label,text:dt.text}:null; const selL=sel?A.parts[sel.id]:null; const focus=!!part; const canSeparate=!d || d.schematic || !['shell','windshield','glass','fairing','wing-port','wing-starboard','fin','stab','bezels','reveals'].includes(d.id);
 const systemNote = part ? {title:A.parts[part].label,...A.notes[part]} : null;
 const close=()=>ui.set({part:null,anatomyDetail:null,anatomySubExplode:false,anatomyAngle:0,anatomyPitch:.65,explodeManual:ui.get().anatomyExploded?1:0,anatomyManualAt:frame.chapters[4]});
 const headerTitle = d?.label ?? systemNote?.title ?? A.title;
 const headerLead = d ? A.detailLead : systemNote?.lead ?? A.lead;
 const headerKicker = d ? fmt(A.studyOf,{name:selL?.label??A.system}) : systemNote?.kicker ?? A.kicker;
 const meta = useMemo(()=>({items: part ? detailCounts[part] : DETAILS.length, mode: d ? A.partFocus : part ? A.systemFocus : A.overview}),[part,d,A]);
 return <div className="anatomy24-panel anatomy26-panel" data-focused={!!detail}>
  <div className="anatomy26-atlas">
   <span className="anatomy26-eyebrow">{headerKicker}</span>
   <h3>{headerTitle}</h3>
   <p>{headerLead}</p>
   <div className="anatomy26-meta" role="list" aria-label={A.summary}>
    <span role="listitem"><b>{meta.items}</b> {A.components}</span>
    <span role="listitem">{meta.mode}</span>
    <span role="listitem">{live ? A.motionLive : A.motionStill}</span>
   </div>
   {systemNote && !d && <small>{systemNote.cinematic}</small>}
  </div>
  <div className="part-list" role="group" aria-label={A.systems}>{PARTS.map(p=><button key={p.id} type="button" className="chip" aria-pressed={p.id===part} onClick={()=>pick(p.id)}>{A.parts[p.id].label}</button>)}</div>
  {part&&<div className="anatomy26-index"><div className="anatomy26-index__head"><span>{selL?.label}</span><span>{fmt(A.mapped,{n:detailCounts[part]})}</span></div><div className="anatomy24-details" role="group" aria-label={A.systemParts}>{DETAILS.filter(x=>x.group===part).map(x=><button key={x.id} type="button" className="anatomy24-detail" data-modelled={x.modeled} aria-pressed={detail===x.id} onClick={()=>pick(x.group,x.id)}><strong>{A.details[x.id as keyof typeof A.details]?.label??x.label}</strong><small>{x.schematic?A.schematic:A.part}</small></button>)}</div></div>}
  <div className="part-card" aria-live="polite"><h3>{d?.label??selL?.label??A.pick}</h3><p>{d?.text??selL?.text??A.pickText}</p>{d?.schematic&&<small>{A.schematicNote}</small>}</div>
  {focus&&live&&<div className="anatomy24-actions anatomy26-actions" role="group" aria-label={A.view}>{canSeparate&&<button type="button" className="btn btn--ghost btn--small" aria-pressed={sub} onClick={()=>ui.set({anatomySubExplode:!sub})}>{sub?A.join:A.separate}</button>}<button type="button" className="btn btn--ghost btn--small" onClick={()=>detail?ui.set({anatomyDetail:null,anatomySubExplode:false,anatomyAngle:0,anatomyPitch:.65}):close()}>{detail?A.backSystem:A.backAircraft}</button></div>}
  {!focus&&live&&<button type="button" className="btn btn--ghost btn--small anatomy24-assemble" aria-pressed={exploded} onClick={()=>ui.set({part:null,anatomyDetail:null,anatomyAngle:0,anatomyPitch:.65,anatomySubExplode:false,explodeManual:exploded?0:1,anatomyManualAt:frame.chapters[4]})}>{exploded?A.assemble:A.explode}</button>}
  <span className="micro">{A.note}</span>
 </div>;
}
