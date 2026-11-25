'use client';
import {useEffect} from 'react';
export default function Cursor(){
 useEffect(()=>{
  const root=document.documentElement;delete root.dataset.cursor;
  // Retain the original card light and button magnetism, but never draw a synthetic cursor.
  let mag:HTMLElement|null=null;
  const move=(e:PointerEvent)=>{
   if(e.pointerType!=='mouse'||matchMedia('(prefers-reduced-motion: reduce)').matches)return;
   const target=e.target instanceof Element?e.target:null;
   const card=target?.closest<HTMLElement>('.fcard,.card,.dest-card,.inspect,.form');
   if(card){const b=card.getBoundingClientRect();if(b.width)card.style.setProperty('--gx',`${((e.clientX-b.left)/b.width*100).toFixed(0)}%`);}
   const m=target?.closest<HTMLElement>('.btn')??null;
   if(mag&&mag!==m){mag.style.transform='';mag=null;}
   if(m){const b=m.getBoundingClientRect();m.style.transform=`translate(${((e.clientX-b.left-b.width/2)*.18).toFixed(1)}px,${((e.clientY-b.top-b.height/2)*.28).toFixed(1)}px)`;mag=m;}
  };
  const reset=()=>{if(mag){mag.style.transform='';mag=null;}};
  window.addEventListener('pointermove',move,{passive:true});window.addEventListener('blur',reset);
  return()=>{window.removeEventListener('pointermove',move);window.removeEventListener('blur',reset);reset();delete root.dataset.cursor;};
 },[]);
 return <style jsx global>{`
 @media (any-pointer:fine){
 html body,html body *{cursor:url('/media/simfly-cursor-v11.png') 69 14,url('/media/simfly-cursor-v11.cur'),auto!important;}
 html body a,html body button,html body [role='button']{cursor:url('/media/simfly-cursor-v11.png') 69 14,url('/media/simfly-cursor-v11.cur'),pointer!important;}
 html body canvas.simfly-routes__canvas,html body .globe-surface,html body .globe-surface *{cursor:grab!important;}
 html body canvas.simfly-routes__canvas:active,html body .globe-surface:active,html body .globe-surface:active *{cursor:grabbing!important;}
 }
 html body .cursor{display:none!important;pointer-events:none!important;}
 `}</style>;
}
