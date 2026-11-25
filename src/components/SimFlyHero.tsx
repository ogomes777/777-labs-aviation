'use client';
import { useEffect, useRef } from 'react';

const clamp = (n: number) => Math.max(0, Math.min(1, n));
const ease = (n: number) => { const x = clamp(n); return x*x*(3-2*x); };
const ramp = (p: number, a: number, b: number) => ease((p-a)/(b-a));
const fade = (p: number, a: number, b: number, c: number, d: number) => ramp(p,a,b)*(1-ramp(p,c,d));

export default function SimFlyHero() {
  const root = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const sim = useRef<HTMLSpanElement>(null);
  const fly = useRef<HTMLSpanElement>(null);
  const words = useRef<HTMLHeadingElement>(null);
  const copies = useRef<HTMLDivElement>(null);
  const cloud = useRef<HTMLDivElement>(null);
  const bar = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el=root.current, v=video.current;
    if (!el || !v) return;
    const section=el.closest('section');
    if (!section) return;
    const reduced=matchMedia('(prefers-reduced-motion: reduce)');
    let raf=0, active=true, target=0, pending=false;
    const seek=() => {
      if (!active || reduced.matches || !Number.isFinite(v.duration) || v.readyState<1 || v.seeking) return;
      const t=Math.min(Math.max(0,v.duration-0.034),target*v.duration);
      if (Math.abs(v.currentTime-t)>0.014) { try { v.currentTime=t; } catch {} }
    };
    const draw=() => {
      raf=0;
      const r=section.getBoundingClientRect(), span=Math.max(1,section.offsetHeight-el.offsetHeight);
      const p=reduced.matches?0:clamp(-r.top/span);
      target=p; seek();
      const enter=ramp(p,0,0.11), join=ramp(p,0.06,0.17), burst=ramp(p,0.17,0.25);
      const vis=(0.8+0.2*enter)*(1-burst);
      if (sim.current) { sim.current.style.transform='translate3d('+(-26*(1-join)-14*burst)+'vw,0,0)'; sim.current.style.opacity=String(vis); }
      if (fly.current) { fly.current.style.transform='translate3d('+(26*(1-join)+14*burst)+'vw,0,0)'; fly.current.style.opacity=String(vis); }
      if (words.current) { words.current.style.transform='scale('+(1+0.16*burst)+')'; words.current.style.filter='blur('+(7*burst)+'px)'; }
      if (copies.current) {
        const bounds=[[.25,.30,.40,.46],[.47,.51,.58,.64],[.69,.74,.86,.92]];
        Array.from(copies.current.children).forEach((node,i)=>{
          const a=fade(p,...bounds[i] as [number,number,number,number]);
          const item=node as HTMLElement; item.style.opacity=String(a); item.style.transform='translate3d(0,'+((1-ramp(p,bounds[i][0],bounds[i][1]))*22-ramp(p,bounds[i][2],bounds[i][3])*18)+'px,0)';
        });
      }
      if(cloud.current){const a=ramp(p,.94,1);cloud.current.style.opacity=String(a*.65);cloud.current.style.transform='translate3d(0,'+((1-a)*42)+'%,0)';}
      if(bar.current)bar.current.style.transform='scaleX('+p+')';
    };
    const schedule=()=>{if(!raf)raf=requestAnimationFrame(draw);};
    const loaded=()=>{v.pause();schedule();};
    const fallback=()=>{if(!pending){pending=true;v.src='/media/simfly-hero-original.mp4';v.load();}else el.dataset.videoError='true';};
    v.addEventListener('loadedmetadata',loaded);v.addEventListener('seeked',seek);v.addEventListener('error',fallback);
    window.addEventListener('scroll',schedule,{passive:true});window.addEventListener('resize',schedule);reduced.addEventListener('change',schedule);
    schedule();
    return()=>{active=false;cancelAnimationFrame(raf);v.removeEventListener('loadedmetadata',loaded);v.removeEventListener('seeked',seek);v.removeEventListener('error',fallback);window.removeEventListener('scroll',schedule);window.removeEventListener('resize',schedule);reduced.removeEventListener('change',schedule);};
  },[]);
  return <div className="simfly-film" ref={root}>
    <video ref={video} src="/media/simfly-hero-scrub.mp4" poster="/media/simfly-hero-poster.webp" muted playsInline preload="auto" aria-hidden="true" />
    <div className="simfly-shade" aria-hidden="true"/>
    <h1 id="hero-title" className="simfly-title" aria-label="SimFly" ref={words} data-focus-target><span ref={sim}>SIM</span><span ref={fly}>FLY</span></h1>
    <div className="simfly-copies" ref={copies}>
      <p>Jeito simples<br/><em>de voar.</em></p>
      <p>O tempo é seu.<br/><em>O céu também.</em></p>
      <p>Liberdade<br/><em>em outra altura.</em></p>
    </div>
    <div className="simfly-cloud" ref={cloud} aria-hidden="true"/>
    <div className="simfly-cue" aria-hidden="true"><span>SCROLL / TOUCH</span><i><b ref={bar}/></i><span>01 / 09</span></div>
    <style jsx global>{`
      #top.simfly-hero.chapter {height: 520svh;}
      #top.simfly-hero .chapter__sticky {position:sticky;top:0;height:100svh;min-height:0;padding:0;display:block;}
      .simfly-film{position:absolute;inset:0;isolation:isolate;overflow:hidden;background:#071c36;}
      .simfly-film video{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;object-position:center;max-width:none;}
      .simfly-shade{position:absolute;inset:0;background:linear-gradient(180deg,rgba(3,16,36,.22),transparent 25%,transparent 75%,rgba(3,16,36,.2));pointer-events:none;}
      .simfly-title{position:absolute;inset:0;margin:0;display:flex;align-items:flex-end;padding-bottom:14svh;justify-content:center;gap:.015em;pointer-events:none;font-family:var(--font-sans);font-weight:750;font-size:clamp(70px,15vw,240px);line-height:.85;letter-spacing:-.065em;}
      .simfly-title span{display:block;will-change:transform,opacity;text-shadow:0 2px 22px rgba(0,18,45,.26);}
      .simfly-title span:first-child{color:#fff;transform:translateX(-26vw);}
      .simfly-title span:last-child{color:#76b4f4;transform:translateX(26vw);}
      .simfly-copies{position:absolute;inset:0;pointer-events:none;}
      .simfly-copies p{position:absolute;left:clamp(24px,6vw,104px);bottom:clamp(75px,14vh,150px);margin:0;opacity:0;font-family:var(--font-serif);font-size:clamp(36px,5.8vw,104px);line-height:.94;letter-spacing:-.045em;color:#fff;text-shadow:0 2px 24px rgba(0,15,40,.55);will-change:opacity,transform;}
      .simfly-copies p:nth-child(2){left:clamp(24px,6vw,104px);right:auto;text-align:left;}.simfly-copies p:nth-child(3){left:auto;right:clamp(24px,6vw,104px);text-align:right;}
      .simfly-copies em{font-weight:400;color:#eaf4ff;}
      .simfly-cloud{position:absolute;inset:0;pointer-events:none;opacity:0;will-change:opacity,transform;background:radial-gradient(ellipse at 15% 90%,#e9f1f7 0%,transparent 57%),radial-gradient(ellipse at 80% 100%,#e6eef4 0%,transparent 62%),linear-gradient(0deg,#eaf2f7 0%,rgba(235,242,248,.72) 32%,transparent 88%);}
      .simfly-cue{position:absolute;left:clamp(20px,5vw,80px);right:clamp(20px,5vw,80px);bottom:26px;display:flex;align-items:center;gap:16px;color:#fff;font-size:10px;letter-spacing:.18em;text-shadow:0 1px 4px #071c36;}
      .simfly-cue i{height:1px;background:rgba(255,255,255,.35);flex:1;overflow:hidden;}.simfly-cue b{display:block;height:100%;background:#fff;transform-origin:left;transform:scaleX(0);}
      .simfly-film[data-video-error=true]::after{content:'Filme indisponível';position:absolute;top:16%;left:5%;color:#fff;font-size:12px;}
      @media(max-width:700px){#top.simfly-hero.chapter{height:440svh}.simfly-title{font-size:18vw;align-items:center;padding-bottom:0}.simfly-title span:first-child{transform:translateX(-15vw)}.simfly-title span:last-child{transform:translateX(15vw)}.simfly-copies p{bottom:18vh;font-size:clamp(30px,8vw,58px)}}
      @media(prefers-reduced-motion:reduce){#top.simfly-hero.chapter{height:100svh}.simfly-title span{transform:none!important;opacity:1!important}.simfly-title{transform:none!important;filter:none!important}.simfly-copies,.simfly-cue,.simfly-cloud{display:none}}
    `}</style>
  </div>;
}
