'use client';
import {useEffect,useRef,useState} from 'react';
import {GALLERY} from '@/content/site';
import {ui} from '@/experience/director';
import {nav} from './navigation';
import {useM} from '@/i18n';

const split=(t:string):[string,string]=>{const i=t.indexOf(' ');return i<0?['',t]:[t.slice(0,i),t.slice(i+1)];};
export default function CabinCinema27(){
 const m=useM();const E=m.experience;const chapters=[{kicker:'',p:[E.t1,E.t2] as [string,string]},...GALLERY.map(g=>({kicker:E.gallery[g.id].kicker,p:split(E.gallery[g.id].title)}))];
 const motion=ui.useStore(s=>s.motion), webgl=ui.useStore(s=>s.webgl), quality=ui.useStore(s=>s.quality);
 const live=motion==='cinematic'&&webgl&&quality!=='lite';
 const root=useRef<HTMLDivElement>(null), unlocked=useRef(false), [atGate,setAtGate]=useState(false);
 useEffect(()=>{
  if(!live)return;
  const el=root.current, ch=el?.closest<HTMLElement>('[data-chapter="6"]');
  if(!el||!ch)return;
  let last=window.scrollY, raf=0, showing=false;
  const bounds=()=>{const start=ch.getBoundingClientRect().top+window.scrollY;const range=Math.max(1,ch.offsetHeight-innerHeight);return {start,limit:start+range*.997,range};};
  const jump=(y:number)=>{if(nav.lenis)nav.lenis.scrollTo(y,{immediate:true,force:true});else window.scrollTo({top:y,behavior:'auto'});};
  const update=()=>{raf=0;const {start,limit,range}=bounds();let y=window.scrollY;
   // Only intercept normal forward passage through the cabin. Deep links and return journeys remain available.
   if(!unlocked.current&&last>=start-2&&last<=limit+3&&y>limit&&y>last){jump(limit);y=limit;}
   last=y;const gate=!unlocked.current&&y>=start+range*.965&&y<=limit+5;
   if(gate!==showing){showing=gate;setAtGate(gate);}
  };
  const schedule=()=>{if(!raf)raf=requestAnimationFrame(update);};
  const forward=(delta:number,event:Event)=>{if(!unlocked.current&&delta>0&&Math.abs(window.scrollY-bounds().limit)<4&&event.cancelable){event.preventDefault();}};
  const wheel=(e:WheelEvent)=>forward(e.deltaY,e);
  let touchY=0;const down=(e:TouchEvent)=>{touchY=e.touches[0]?.clientY??0;};const move=(e:TouchEvent)=>{const y=e.touches[0]?.clientY??touchY;forward(touchY-y,e);touchY=y;};
  const key=(e:KeyboardEvent)=>{if(['ArrowDown','PageDown','End',' '].includes(e.key)&&!e.shiftKey&&!(e.target instanceof HTMLElement&&e.target.closest('button,a,input,textarea,select,[contenteditable]')))forward(1,e);};
  const explicitNav=(e:MouseEvent)=>{const a=(e.target as HTMLElement)?.closest?.('a[href^="#"]');if(a){const dest=document.getElementById((a.getAttribute('href')??'').slice(1));if(dest && (ch.compareDocumentPosition(dest)&Node.DOCUMENT_POSITION_FOLLOWING) && !ch.contains(dest)){unlocked.current=true;setAtGate(false);}}};
  window.addEventListener('scroll',schedule,{passive:true});window.addEventListener('resize',schedule);window.addEventListener('wheel',wheel,{passive:false,capture:true});window.addEventListener('touchstart',down,{passive:true});window.addEventListener('touchmove',move,{passive:false,capture:true});window.addEventListener('keydown',key);document.addEventListener('click',explicitNav,true);schedule();
  return()=>{cancelAnimationFrame(raf);window.removeEventListener('scroll',schedule);window.removeEventListener('resize',schedule);window.removeEventListener('wheel',wheel,true);window.removeEventListener('touchstart',down);window.removeEventListener('touchmove',move,true);window.removeEventListener('keydown',key);document.removeEventListener('click',explicitNav,true);};
 },[live]);
 const enter=()=>{unlocked.current=true;setAtGate(false);const el=document.getElementById('frota');if(!el)return;const y=el.getBoundingClientRect().top+window.scrollY+Math.max(0,(el.offsetHeight-innerHeight)*.065);if(nav.lenis)nav.lenis.scrollTo(y,{duration:1.55,force:true});else window.scrollTo({top:y,behavior:'smooth'});};
 if(!live)return null;
 return <div ref={root} className="sf27-cabin-cinema"><div className="sf27-copy-stack">{chapters.map((c,i)=><div key={i} className="sf27-cinema-line" data-sf27-copy={i} onPointerMove={e=>{const b=e.currentTarget.getBoundingClientRect();e.currentTarget.style.setProperty('--sf27-pointer',`${Math.max(0,Math.min(100,(e.clientX-b.left)/Math.max(1,b.width)*100))}%`);}}>{c.kicker&&<span>{c.kicker}</span>}<h2><strong>{c.p[0]}</strong>{c.p[0]?' ':''}<em>{c.p[1]}</em></h2></div>)}</div><div className="sf27-hangar-gate" data-open={atGate}><h2><em>{m.fleet.title}</em></h2><button type="button" disabled={!atGate} onClick={enter}>{E.enter}</button></div></div>;
}
