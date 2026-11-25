'use client';
import {useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
const clamp=(x:number)=>Math.max(0,Math.min(1,x));
const ramp=(x:number,a:number,b:number)=>{const t=clamp((x-a)/(b-a));return t*t*(3-2*t);};
const mix=(a:number,b:number,t:number)=>a+(b-a)*t;
export default function SimFlyHero(){
 const root=useRef<HTMLDivElement>(null),video=useRef<HTMLVideoElement>(null),cloud=useRef<HTMLDivElement>(null),plane=useRef<HTMLImageElement>(null),copies=useRef<HTMLDivElement>(null),bar=useRef<HTMLSpanElement>(null);
 const [mounted,setMounted]=useState(false);useEffect(()=>setMounted(true),[]);
 useEffect(()=>{if(!mounted)return;const el=root.current,v=video.current,section=el?.closest('section'),next=document.getElementById('portal');if(!el||!v||!section||!next)return;
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');let fps=new URLSearchParams(location.search).get('fps')==='30'?30:60,desired=0,raf=0,disposed=false,fallback=fps===30;
 const seek=()=>{if(disposed||reduced.matches||v.seeking||v.readyState<1||!Number.isFinite(v.duration))return;const last=Math.max(0,Math.floor(v.duration*fps)-1);const time=Math.round(desired*last)/fps;if(Math.abs(time-v.currentTime)>=.49/fps)try{v.currentTime=time;}catch{}};
 const draw=()=>{raf=0;const r=section.getBoundingClientRect(),n=next.getBoundingClientRect(),h=el.offsetHeight||innerHeight,span=Math.max(1,section.offsetHeight-h);const p=reduced.matches?0:clamp(-r.top/span);desired=p;if(r.bottom>=0)seek();
 if(r.top<=1&&r.bottom>1)document.documentElement.dataset.simflyZone='hero';else if(document.documentElement.dataset.simflyZone==='hero')delete document.documentElement.dataset.simflyZone;
 const reveal=ramp(p,.012,.065),join=ramp(p,.06,.146),lift=ramp(p,.135,.237),burst=ramp(p,.17,.245),vanish=ramp(p,.23,.28),spread=innerWidth<700?15:22;
 const values:Record<string,string>={'--sim-x':`${-(1-join)*spread-burst*29}vw`,'--fly-x':`${(1-join)*spread+burst*29}vw`,'--title-y':`${(1-reveal)*35-burst*15}px`,'--title-alpha':String(reveal*(1-burst)),'--split-angle':`${burst*4}deg`,'--outline-alpha':String(ramp(p,.147,.17)*(1-ramp(p,.208,.245))),'--fly-glint':String(ramp(p,.112,.143)*(1-ramp(p,.175,.208))),'--fly-sweep':`${mix(135,-35,ramp(p,.12,.205))}%`};Object.entries(values).forEach(([k,val])=>el.style.setProperty(k,val));
 if(plane.current){plane.current.style.opacity=String(ramp(p,.135,.157)*(1-vanish));plane.current.style.transform=`translate3d(-50%,${mix(70,-110,lift)}svh,0) scale(${mix(.86,1.05,lift)})`;}
 const bands=[[.253,.309,.407,.465],[.47,.523,.645,.70],[.715,.765,.872,.925]];Array.from(copies.current?.children??[]).forEach((node,i)=>{const[a,b,c,d]=bands[i],entry=ramp(p,a,b),exit=ramp(p,c,d),item=node as HTMLElement;item.style.opacity=String(entry*(1-exit));item.style.transform=`translate3d(0,${(1-entry)*28-exit*18}px,0)`;item.style.setProperty('--copy-sweep',`${mix(145,-45,ramp(p,b,c))}%`);item.style.setProperty('--copy-glint',String(ramp(p,b,b+.015)*(1-ramp(p,c-.015,c+.015))));});
 // One opaque, viewport-fixed cloud plate covers the entire physical boundary.
 // Do not fade it out until the shared journey has taken over the whole screen.
 const tail=ramp(p,.865,.975),crossing=clamp(1-n.top/h),after=clamp(-n.top/Math.max(1,next.offsetHeight));
 const clearing=ramp(after,.005,.10);const crossingActive=n.top<=h&&n.bottom>0;
 const opacity=reduced.matches?0:crossingActive?1-clearing:r.bottom>0?tail:0;
 const whiten=crossingActive?mix(.12,.94,ramp(crossing,0,1)):.12*tail;
 if(cloud.current){cloud.current.style.opacity=String(opacity);cloud.current.style.visibility=opacity>.002?'visible':'hidden';cloud.current.style.setProperty('--mist',String(whiten));cloud.current.style.setProperty('--cloud-y',`${mix(9,-12,crossingActive?crossing:tail*.22)}%`);cloud.current.style.setProperty('--cloud-zoom',String(mix(1.08,1.35,crossingActive?crossing:tail*.2)));cloud.current.style.setProperty('--cloud-blue',String((1-whiten)*.12));}
 if(bar.current){bar.current.style.transform=`scaleX(${p})`;bar.current.parentElement!.parentElement!.style.opacity=String(1-ramp(p,.9,.98));}
 };
 const queue=()=>{if(!disposed&&!raf)raf=requestAnimationFrame(draw);};const loaded=()=>{v.pause();queue();};const err=()=>{if(!fallback){fallback=true;fps=30;v.src='/media/simfly-hero-original.mp4';v.load();}else el.dataset.videoError='true';};
 v.addEventListener('loadedmetadata',loaded);v.addEventListener('loadeddata',loaded);v.addEventListener('seeked',seek);v.addEventListener('error',err);if(fallback){v.src='/media/simfly-hero-original.mp4';v.load();}window.addEventListener('scroll',queue,{passive:true});window.addEventListener('resize',queue);reduced.addEventListener('change',queue);queue();return()=>{disposed=true;cancelAnimationFrame(raf);v.removeEventListener('loadedmetadata',loaded);v.removeEventListener('loadeddata',loaded);v.removeEventListener('seeked',seek);v.removeEventListener('error',err);window.removeEventListener('scroll',queue);window.removeEventListener('resize',queue);reduced.removeEventListener('change',queue);if(document.documentElement.dataset.simflyZone==='hero')delete document.documentElement.dataset.simflyZone;};},[mounted]);
 return <div ref={root} className="simfly-film">
 <video ref={video} src="/media/simfly-hero-scrub.mp4" poster="/media/simfly-hero-poster.webp" muted playsInline preload="auto" aria-hidden="true"/>
 <div className="simfly-shade" aria-hidden="true"/>
 <h1 id="hero-title" data-focus-target className="simfly-title" aria-label="SimFly"><span>SIM</span><span data-text="FLY">FLY</span></h1>
 <img ref={plane} className="simfly-launch-plane" src="/media/simfly-plane-dorsal.png" alt="" aria-hidden="true" decoding="async"/>
 <div className="simfly-title simfly-title--outline" aria-hidden="true"><span>SIM</span><span>FLY</span></div>
 <div className="simfly-copies" ref={copies}><p>Jeito simples<br/><em data-text="de voar.">de voar.</em></p><p>O tempo é seu.<br/><em data-text="O céu também.">O céu também.</em></p><p>Liberdade<br/><em data-text="em outra altura.">em outra altura.</em></p></div>
 <div className="simfly-cue" aria-hidden="true"><span>SCROLL / TOUCH</span><i><b ref={bar}/></i></div>
 {mounted&&createPortal(<div ref={cloud} className="simfly-cloud-bridge" aria-hidden="true"><div className="simfly-cloud-bridge__photo"/><div className="simfly-cloud-bridge__mist"/></div>,document.body)}
 <style jsx global>{`
 #top.simfly-hero.chapter{height:520svh;background:#f5f7fa}#top.simfly-hero .chapter__sticky{position:sticky;top:0;height:100svh;min-height:0;padding:0;display:block;border:0;outline:0}
 .simfly-film{position:absolute;inset:0;overflow:hidden;isolation:isolate;background:#071c36;--title-alpha:0;--outline-alpha:0;--fly-glint:0}
 .simfly-film video{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:center;max-width:none}
 .simfly-shade{position:absolute;inset:0;pointer-events:none;background:linear-gradient(180deg,#04132624,transparent 24%,transparent 75%,#04132620)}
 .simfly-title{position:absolute;left:0;right:0;bottom:14svh;margin:0;display:flex;justify-content:center;align-items:center;gap:.015em;z-index:2;font-family:var(--font-sans);font-size:clamp(64px,15vw,240px);line-height:.85;font-weight:750;letter-spacing:-.065em;pointer-events:none;opacity:var(--title-alpha)}
 .simfly-title span{display:block;position:relative;will-change:transform}.simfly-title span:first-child{color:#fff;transform:translate3d(var(--sim-x,-22vw),var(--title-y,35px),0) rotate(calc(-1 * var(--split-angle,0deg)))}.simfly-title span:last-child{color:#2059ac;transform:translate3d(var(--fly-x,22vw),var(--title-y,35px),0) rotate(var(--split-angle,0deg));-webkit-text-stroke:.6px #96c5ff55}
 .simfly-title:not(.simfly-title--outline) span:last-child::after,.simfly-copies em::after{content:attr(data-text);position:absolute;inset:0;color:transparent;-webkit-text-fill-color:transparent;background:linear-gradient(108deg,transparent 35%,#8fc7ff 46%,#e4f5ff 50%,#438eff 55%,transparent 66%);background-size:230% 100%;background-position:var(--fly-sweep,150%) center;background-clip:text;-webkit-background-clip:text;opacity:var(--fly-glint,0);filter:drop-shadow(0 0 5px #5b9fff77);pointer-events:none}
 .simfly-title--outline{z-index:4;opacity:var(--outline-alpha);mask-image:linear-gradient(90deg,transparent 26%,#000 43%,#000 57%,transparent 74%)}.simfly-title--outline span{color:transparent!important;-webkit-text-fill-color:transparent;-webkit-text-stroke:1.4px #e4f4ff!important;text-shadow:none!important}
 .simfly-launch-plane{position:absolute;width:clamp(210px,34vw,540px);height:auto;bottom:11svh;left:50%;z-index:3;opacity:0;pointer-events:none;will-change:transform,opacity;filter:drop-shadow(0 8px 12px #071c3633)}
 .simfly-copies{position:absolute;inset:0;pointer-events:none;z-index:5}.simfly-copies p{position:absolute;left:clamp(24px,6vw,104px);bottom:clamp(75px,14vh,150px);margin:0;opacity:0;font-family:var(--font-serif);font-size:clamp(38px,6vw,106px);line-height:.91;letter-spacing:-.045em;color:#fff;text-shadow:0 3px 24px #061b3a90;will-change:opacity,transform}.simfly-copies p:nth-child(3){left:auto;right:6vw;text-align:right}.simfly-copies em{position:relative;display:inline-block;font-weight:400;color:#dceeff;text-shadow:0 2px 15px #071c3644}.simfly-copies em::after{background-position:var(--copy-sweep,150%) center;opacity:var(--copy-glint,0)}
 .simfly-cloud-bridge{position:fixed;inset:0;z-index:45;opacity:0;visibility:hidden;pointer-events:none;overflow:hidden;isolation:isolate;background:#e2edf7;will-change:opacity;contain:paint}.simfly-cloud-bridge__photo{position:absolute;inset:-20%;background:url('/media/simfly-cloud-photo.webp') center/cover no-repeat;transform:translate3d(0,var(--cloud-y,20%),0) scale(var(--cloud-zoom,1.06));will-change:transform;}.simfly-cloud-bridge__photo::after{content:"";position:absolute;inset:0;background:rgba(46,112,190,var(--cloud-blue,0));pointer-events:none}.simfly-cloud-bridge__mist{position:absolute;inset:0;background:#f5f7fa;opacity:var(--mist,0)}
 .simfly-cue{position:absolute;left:5vw;right:5vw;bottom:24px;z-index:6;display:flex;align-items:center;gap:14px;color:#fff;font-size:10px;letter-spacing:.18em}.simfly-cue i{height:1px;background:#ffffff55;flex:1}.simfly-cue b{display:block;height:100%;background:#fff;transform-origin:left;transform:scaleX(0)}
 html[data-simfly-zone='hero'] .site-header,html[data-simfly-zone='hero'] .scene-index{--fg:#fff;--fg-soft:#d5e5fb;--header-tint:#071c36;color:#fff}html[data-simfly-zone='hero'] .scene-index{display:none}
 @media(max-width:700px){#top.simfly-hero.chapter{height:440svh}.simfly-title{font-size:18vw;bottom:24svh}.simfly-launch-plane{width:62vw;bottom:20svh}.simfly-copies p,.simfly-copies p:nth-child(3){left:6vw;right:6vw;bottom:18svh;text-align:left;font-size:clamp(32px,8vw,58px)}}
 @media(prefers-reduced-motion:reduce){#top.simfly-hero.chapter{height:100svh}.simfly-title{opacity:1!important}.simfly-title span{transform:none!important}.simfly-title--outline,.simfly-launch-plane,.simfly-copies,.simfly-cue,.simfly-cloud-bridge{display:none}}
 `}</style></div>;
}
