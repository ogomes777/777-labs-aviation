'use client';
import {useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {gsap} from 'gsap';
import dots from '@/content/globe-dots.json';
import {useM} from '@/i18n';
const clamp=(x:number)=>Math.min(1,Math.max(0,x));
const ramp=(x:number,a:number,b:number)=>{const t=clamp((x-a)/(b-a));return t*t*(3-2*t);};
const mix=(a:number,b:number,t:number)=>a+(b-a)*t;
// Monotone cubic Hermite timing: continuous speed, with no stop at an interior keyframe.
const flightKeys=[[.13,0,0],[.43,.23,1.08],[.68,.53,1.45],[.84,.86,1.75],[.94,.96,.80],[1,1,.55]];
function flightTiming(p:number){if(p<=flightKeys[0][0])return 0;for(let i=1;i<flightKeys.length;i++){const [a,x,dx]=flightKeys[i-1],[b,y,dy]=flightKeys[i];if(p<=b){const t=(p-a)/(b-a),t2=t*t,t3=t2*t;return clamp((2*t3-3*t2+1)*x+(t3-2*t2+t)*(b-a)*dx+(-2*t3+3*t2)*y+(t3-t2)*(b-a)*dy);}}return 1;}
type Vec=[number,number,number];const rad=Math.PI/180;
function world(lat:number,lon:number):Vec{const a=lat*rad,b=lon*rad;return[Math.cos(a)*Math.sin(b),Math.sin(a),Math.cos(a)*Math.cos(b)];}
const cities=[{name:'São Paulo',country:'BRASIL',lat:-23.55,lon:-46.63},{name:'Nova York',country:'ESTADOS UNIDOS',lat:40.71,lon:-74.01},{name:'Lisboa',country:'PORTUGAL',lat:38.72,lon:-9.14},{name:'Paris',country:'FRANÇA',lat:48.86,lon:2.35},{name:'Dubai',country:'EMIRADOS ÁRABES',lat:25.2,lon:55.27}];
const land=(dots as [number,number][]).map(([a,b])=>world(a,b));const geo=cities.map(c=>world(c.lat,c.lon));
function arc(a:Vec,b:Vec,t:number):Vec{const angle=Math.acos(Math.max(-1,Math.min(1,a[0]*b[0]+a[1]*b[1]+a[2]*b[2]))),den=Math.sin(angle)||1,l=Math.sin((1-t)*angle)/den,r=Math.sin(t*angle)/den,alt=1+.23*Math.sin(Math.PI*t);return[(a[0]*l+b[0]*r)*alt,(a[1]*l+b[1]*r)*alt,(a[2]*l+b[2]*r)*alt];}
const routes=geo.slice(1).map(b=>Array.from({length:97},(_,i)=>arc(geo[0],b,i/96)));
const grids:Vec[][]=[];for(let la=-60;la<=60;la+=30)grids.push(Array.from({length:121},(_,i)=>world(la,i*3-180)));for(let lo=-180;lo<180;lo+=30)grids.push(Array.from({length:61},(_,i)=>world(i*3-90,lo)));

// Deterministic micro-specks. No halos, sprites or second canvas.
const skyDust=Array.from({length:48},(_,i)=>({x:3+((i*37.719)%94),y:7+((i*29.317)%87),size:.75+(i%5)*.19,delay:-(i%11)*.71,duration:5.5+(i%7)*.8}));
// Both scroll chapters share ONE viewport, ONE aircraft and ONE geometric path.
// Original anchors and director chapter indices remain unchanged.
export function SimFlyRoutesGlobe(){return <div className="simfly-route-anchor" aria-hidden="true"/>;}
export function SimFlyAviationSection(){
 const stage=useRef<HTMLDivElement>(null),canvas=useRef<HTMLCanvasElement>(null),plane=useRef<HTMLDivElement>(null),track=useRef<SVGPathElement>(null),measure=useRef<SVGPathElement>(null),trail=useRef<SVGPathElement>(null),ahead=useRef<SVGPathElement>(null),halo=useRef<SVGPathElement>(null),svg=useRef<SVGSVGElement>(null),copy=useRef<HTMLDivElement>(null),globeCopy=useRef<HTMLDivElement>(null),night=useRef<HTMLDivElement>(null),meta=useRef<HTMLDivElement>(null),dust=useRef<HTMLDivElement>(null),wordmark=useRef<HTMLDivElement>(null),optical=useRef<HTMLDivElement>(null),pearl=useRef<HTMLDivElement>(null),worldLayer=useRef<HTMLDivElement>(null),orbitTrail=useRef<SVGGElement>(null);
 const glow=useRef(0),progress=useRef(0),offset=useRef(0),pitch=useRef(0),drag=useRef<{x:number;y:number}|null>(null),tween=useRef<gsap.core.Tween|null>(null),ambient=useRef(0);
 const m=useM();const [mounted,setMounted]=useState(false);const choice=useRef(0);
 useEffect(()=>{setMounted(true);},[]);
 const paint=()=>{const c=canvas.current;if(!c)return;const ctx=c.getContext('2d');if(!ctx)return;const w=c.clientWidth,h=c.clientHeight;if(w<1||h<1)return;const dpr=Math.min(devicePixelRatio||1,1.75);if(c.width!==Math.round(w*dpr)||c.height!==Math.round(h*dpr)){c.width=Math.round(w*dpr);c.height=Math.round(h*dpr);}ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);
 const p=progress.current,angle=mix(.52,-.22,p)+offset.current,cs=Math.cos(angle),sn=Math.sin(angle),tilt=.13+pitch.current,ct=Math.cos(tilt),st=Math.sin(tilt),R=Math.min(w,h)*.39,cx=w*.5,cy=h*.51;
 const project=(v:Vec)=>{const x=v[0]*cs+v[2]*sn,z=-v[0]*sn+v[2]*cs,y=v[1]*ct-z*st,depth=v[1]*st+z*ct;return{x:cx+x*R,y:cy-y*R,z:depth,rho:x*x+y*y};};
 const disk=(r:number)=>{ctx.beginPath();ctx.arc(cx,cy,r,0,Math.PI*2);};
 // Optical atmosphere + directional sphere illumination, independent of the original global WebGL scene.
 // halo sempre DENTRO do canvas (sem recorte nas bordas) e apagando em degradê quando o avião assume a cena
const fade=1-glow.current,HR=Math.min(R*1.4,Math.min(w-cx,cx,h-cy,cy)-1);let g=ctx.createRadialGradient(cx,cy,R*.97,cx,cy,HR);g.addColorStop(0,`rgba(140,205,255,${.42*fade})`);g.addColorStop(.22,`rgba(92,170,255,${.2*fade})`);g.addColorStop(.6,`rgba(60,140,240,${.05*fade})`);g.addColorStop(1,'rgba(24,118,223,0)');ctx.fillStyle=g;disk(HR);ctx.fill();
 g=ctx.createRadialGradient(cx-R*.35,cy-R*.46,R*.02,cx+R*.16,cy+R*.13,R*1.23);g.addColorStop(0,'#386f9e');g.addColorStop(.33,'#1b426b');g.addColorStop(.68,'#102b48');g.addColorStop(1,'#061322');ctx.fillStyle=g;disk(R);ctx.fill();
 ctx.save();disk(R);ctx.clip();const trace=(vs:Vec[],color:string,width:number)=>{ctx.beginPath();let pen=false;for(const v of vs){const q=project(v);if(q.z<0){pen=false;continue;}if(!pen)ctx.moveTo(q.x,q.y);else ctx.lineTo(q.x,q.y);pen=true;}ctx.strokeStyle=color;ctx.lineWidth=width;ctx.stroke();};for(const vs of grids)trace(vs,'#a2d1ff17',.55);
 const bins:Array<Array<{x:number;y:number;s:number}>>=Array.from({length:5},()=>[]);for(let j=0;j<land.length;j++){const q=project(land[j]);if(q.z<=.015)continue;const shimmer=j%9===0?.13*Math.sin(ambient.current*.85+j*.73):0;const light=clamp(.45+q.z*.52-(q.x-cx)/R*.13-(q.y-cy)/R*.1+shimmer);bins[Math.min(4,Math.floor(light*5))].push({x:q.x,y:q.y,s:.7+q.z*1.1});}bins.forEach((bin,i)=>{ctx.beginPath();for(const q of bin){ctx.moveTo(q.x+q.s,q.y);ctx.arc(q.x,q.y,q.s,0,Math.PI*2);}ctx.fillStyle=`rgba(153,201,245,${.32+i*.12})`;ctx.fill();});
 const shade=ctx.createRadialGradient(cx-R*.30,cy-R*.36,R*.12,cx+R*.1,cy+R*.15,R*1.16);shade.addColorStop(0,'#07132200');shade.addColorStop(.65,'#07132200');shade.addColorStop(1,'#0713228c');ctx.fillStyle=shade;disk(R);ctx.fill();ctx.restore();
 {ctx.save();disk(R);ctx.clip();const rim=ctx.createRadialGradient(cx-R*.12,cy-R*.1,R*.62,cx,cy,R*1.01);rim.addColorStop(0,'rgba(150,210,255,0)');rim.addColorStop(.82,'rgba(150,210,255,.06)');rim.addColorStop(1,`rgba(190,230,255,${.5*fade})`);ctx.fillStyle=rim;disk(R);ctx.fill();ctx.restore();}ctx.strokeStyle=`rgba(200,232,255,${.62*(.35+.65*fade)})`;ctx.lineWidth=1.2;disk(R);ctx.stroke();
 const reveal=ramp(p,.06,.74);const visible=(q:ReturnType<typeof project>)=>q.z>=0||q.rho>1.002;
 // Restore V10 stroke weights. One scroll-controlled, tapered light INSIDE each stroke.
 routes.forEach((vs,k)=>{
  const i=k+1,extent=ramp(reveal,k*.11,.66+k*.11)*96,active=choice.current===0||choice.current===i;
  if(extent<.001)return;
  const n=Math.floor(extent),pts=vs.slice(0,n+1).map(project);
  if(n<96&&extent>n){const a=vs[n],b=vs[n+1],f=extent-n;pts.push(project([mix(a[0],b[0],f),mix(a[1],b[1],f),mix(a[2],b[2],f)]));}
  const path=()=>{ctx.beginPath();let pen=false;for(const q of pts){if(!visible(q)){pen=false;continue;}if(!pen)ctx.moveTo(q.x,q.y);else ctx.lineTo(q.x,q.y);pen=true;}};
  ctx.save();ctx.lineJoin='round';ctx.lineCap='round';
  path();ctx.strokeStyle=active?'#3e9dff45':'#2770b525';ctx.lineWidth=active?6:3;ctx.stroke();
  path();ctx.strokeStyle=active?'#b6e3ff':'#5897ce8a';ctx.lineWidth=active?1.9:1;ctx.stroke();
  // Absolute scroll position, not wall-clock time: reversing scroll reverses the light.
  const center=Math.min(extent,96*clamp((p-(.06+k*.052))/(.94-k*.052)));
  const light=(j:number)=>{const u=clamp(1-Math.abs(j-center)/15);return u*u*(3-2*u)*(active?.95:.55);};
  ctx.lineCap='butt';ctx.lineWidth=active?1.9:1;
  for(let j=1;j<pts.length;j++){
   const a=pts[j-1],b=pts[j];if(!visible(a)||!visible(b))continue;
   const aa=light(j-1),bb=light(Math.min(j,extent));if(Math.max(aa,bb)<.008||Math.hypot(b.x-a.x,b.y-a.y)<.001)continue;
   const shine=ctx.createLinearGradient(a.x,a.y,b.x,b.y);
   shine.addColorStop(0,`rgba(240,251,255,${aa})`);shine.addColorStop(1,`rgba(240,251,255,${bb})`);
   ctx.strokeStyle=shine;ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();
  }
  ctx.restore();
 });
 geo.forEach((v,i)=>{if(i!==0&&reveal<.12+(i-1)*.11)return;const q=project(v);if(q.z<.035)return;const active=i===choice.current||i===0;const a=active?1:.76;const halo=ctx.createRadialGradient(q.x,q.y,0,q.x,q.y,active?14:8);halo.addColorStop(0,'#8bcaffb0');halo.addColorStop(1,'#8bcaff00');ctx.fillStyle=halo;ctx.beginPath();ctx.arc(q.x,q.y,active?14:8,0,Math.PI*2);ctx.fill();ctx.globalAlpha=a;ctx.fillStyle='#e4f5ff';ctx.beginPath();ctx.arc(q.x,q.y,active?3.6:2.5,0,Math.PI*2);ctx.fill();if(active||reveal>.8){ctx.font='500 11px system-ui';ctx.fillStyle='#e2effb';ctx.fillText(cities[i].name,q.x+8,q.y-7);}ctx.globalAlpha=1;});
 };

 const paintRef=useRef(paint);paintRef.current=paint;
 useEffect(()=>{
  if(!mounted)return;
  const el=stage.current,first=document.getElementById('portal'),second=document.getElementById('rotas-preview'),next=document.getElementById('engenharia');
  if(!el||!first||!second||!next)return;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  let raf=0,geometry='',length=0,approach=0,lastPaint=-1,wasVisible=false;
  const configure=()=>{
   const W=el.clientWidth,H=el.clientHeight,c=canvas.current,mp=measure.current,path=track.current;if(!c||!mp||!path||!W||!H)return false;
   const key=[W,H,c.offsetLeft,c.offsetTop,c.clientWidth,c.clientHeight].join(':');if(key===geometry)return true;geometry=key;
   svg.current?.setAttribute('viewBox',`0 0 ${W} ${H}`);
   const mobile=W<=700, cx=c.offsetLeft+c.clientWidth*.5,cy=c.offsetTop+c.clientHeight*.51,R=Math.min(c.clientWidth,c.clientHeight)*.39;
   // A true quarter-circle turn, tangent to the horizontal approach and the clockwise orbit.
   // No reverse-facing control points, no cusp, no crossing at the join.
   const rx=R*1.115,ry=R*1.08,ex=cx+rx,ey=cy;
   const radius=Math.min(H*.145,W*.19,ey*.40);
   const tx=ex-radius,ty=ey-radius;
   const midX=tx*.48,midY=mobile?ty+H*.035:H*.615;
   const h1=tx*.22,h2=tx*.20;
   const d=`M ${-W*.14} ${H*.67}
     C ${-W*.015} ${H*.67} ${midX-h1} ${midY} ${midX} ${midY}
     C ${midX+h1} ${midY} ${tx-h2} ${ty} ${tx} ${ty}
     A ${radius} ${radius} 0 0 1 ${ex} ${ey}`.replace(/\s+/g,' ');
   const all=`${d} A ${rx} ${ry} 0 0 1 ${cx} ${cy+ry} A ${rx} ${ry} 0 0 1 ${cx-rx} ${cy} A ${rx} ${ry} 0 0 1 ${cx} ${cy-ry}`;
   mp.setAttribute('d',d);path.setAttribute('d',all);
   [trail.current,ahead.current,halo.current,...Array.from(orbitTrail.current?.querySelectorAll('path')??[])].forEach(n=>n?.setAttribute('d',all));
   approach=mp.getTotalLength();length=path.getTotalLength();lastPaint=-1;return length>0;
  };
  const alpha=(node:HTMLElement|null,a:number,y=0)=>{if(node){node.style.opacity=String(a);node.style.transform=`translate3d(0,${y}px,0)`;}};
  let ambientRaf=0,lastAmbient=0,lastRender=0,dustRaf=0,px=0,py=0;
  const stopAmbient=()=>{if(ambientRaf)cancelAnimationFrame(ambientRaf);ambientRaf=0;};
  const tickAmbient=(now:number)=>{ambientRaf=0;if(el.dataset.dust!=='true'||reduced.matches||document.hidden)return;if(now-lastAmbient>=66&&now-lastRender>=50){ambient.current=now*.001;paintRef.current();lastAmbient=now;lastRender=now;}ambientRaf=requestAnimationFrame(tickAmbient);};
  const startAmbient=()=>{if(!ambientRaf&&!reduced.matches&&!document.hidden)ambientRaf=requestAnimationFrame(tickAmbient);};
  const moveDust=(e:PointerEvent)=>{if(el.dataset.dust!=='true'||reduced.matches)return;px=(e.clientX/Math.max(1,el.clientWidth)-.5)*9;py=(e.clientY/Math.max(1,el.clientHeight)-.5)*7;if(!dustRaf)dustRaf=requestAnimationFrame(()=>{dustRaf=0;dust.current?.style.setProperty('--dx',`${px}px`);dust.current?.style.setProperty('--dy',`${py}px`);});};
  const resetDust=()=>{px=py=0;dust.current?.style.setProperty('--dx','0px');dust.current?.style.setProperty('--dy','0px');};
  const onVisibility=()=>{if(document.hidden)stopAmbient();else if(el.dataset.dust==='true')startAmbient();};
  const draw=()=>{
   raf=0;const H=el.clientHeight||innerHeight,W=el.clientWidth||innerWidth;
   const a=first.getBoundingClientRect(),b=second.getBoundingClientRect(),n=next.getBoundingClientRect();
   // Keep this fixed stage mounted through the entire seam; no separate sticky layers to cut the line.
   const visible=a.top<=H&&n.top>0;
   if(!visible){delete second.dataset.simflyHandoff;delete el.dataset.handoff;stopAmbient();el.dataset.dust='false';resetDust();el.style.visibility='hidden';el.style.opacity='0';el.style.pointerEvents='none';el.inert=true;wasVisible=false;el.dataset.visible='false';if(document.documentElement.dataset.simflyZone==='aircraft'||document.documentElement.dataset.simflyZone==='globe')delete document.documentElement.dataset.simflyZone;return;}
   if(!configure())return;
   const p=reduced.matches?(b.top>0?.44:1):clamp(-a.top/Math.max(1,first.offsetHeight));
   const g=reduced.matches?(b.top>0?0:1):clamp(-b.top/Math.max(1,second.offsetHeight-H));
   // V18: the existing last viewport of the globe is the optical handoff.
   // All beats use absolute scroll, so touch, reverse and direct navigation agree.
   const u=clamp(1-n.top/H),handoff=reduced.matches?0:u;
   // V21: faster continuous departure; no static portrait hold.
   // then accelerates out of frame before the pearl studio reveal.
   const copyExit=1-ramp(handoff,.16,.43),spaceExit=1-ramp(handoff,.18,.46);
   const push=ramp(handoff,0,.32),recede=ramp(handoff,.01,.44);
   const depart=clamp((handoff-.32)/.275),acceleration=depart*depart*depart;
   const white=ramp(handoff,.60,.79),uncover=ramp(handoff,.79,1);
   const exit=reduced.matches?clamp(n.top/H):1-uncover;
   const bridging=handoff>0;
   el.dataset.handoff=String(bridging);
   // Remove the outgoing section's navy paint only while the pearl frame is opaque.
   // Otherwise a strip of the old section is visible above the fixed studio canvas.
   if(handoff>=.79||(reduced.matches&&u>0))second.dataset.simflyHandoff='true';else delete second.dataset.simflyHandoff;
   if(optical.current){optical.current.style.opacity=String(ramp(handoff,.48,.66)*(1-ramp(handoff,.72,.79))*.42);optical.current.style.setProperty('--sf-light-x',`${mix(130,43,ramp(handoff,.48,.79))}%`);}
   if(pearl.current)pearl.current.style.opacity=String(white);glow.current=reduced.matches?0:ramp(handoff,.03,.42);
   const dark=ramp(p,.76,.985),globeAlpha=ramp(p,.84,1),cityAlpha=ramp(g,0,.25)*globeAlpha;
   el.style.visibility='visible';el.style.opacity=String(exit);el.inert=false;el.dataset.visible='true';el.style.transform='translate3d(0,0,0)';
   if(a.top<=1){document.documentElement.dataset.simflyZone=handoff>=.79?'aircraft':dark>.55?'globe':'aircraft';}
   if(night.current)night.current.style.opacity=String(dark);
   if(worldLayer.current)worldLayer.current.style.transform=`scale(${mix(1,.24,recede)})`;
   const dustAlpha=ramp(p,.88,1)*mix(.68,1,ramp(g,.04,.27))*spaceExit;
   el.dataset.dust=String(dustAlpha>.02);
   if(dust.current){dust.current.style.opacity=String(dustAlpha);dust.current.style.setProperty('--scroll-drift',`${(1-g)*7}px`);}
   if(wordmark.current)wordmark.current.style.opacity=String(.72*ramp(g,.16,.48)*globeAlpha*copyExit);
   if(dustAlpha>.02&&!bridging)startAmbient();else stopAmbient();
   const firstCopy=reduced.matches&&b.top>0?1:ramp(p,.012,.115)*(1-ramp(p,.37,.47)),secondCopy=reduced.matches?0:ramp(p,.43,.55)*(1-ramp(p,.76,.86));
   const articles=copy.current?.children;alpha(articles?.[0] as HTMLElement|null,firstCopy,(1-firstCopy)*19);alpha(articles?.[1] as HTMLElement|null,secondCopy,(1-secondCopy)*19);
   alpha(meta.current,ramp(p,.02,.12)*(1-ramp(p,.73,.86)));
   // A single scroll-derived distance drives the plane, its tangent and both strokes.
   const path=track.current;
   // Start orbital travel as soon as the globe chapter begins so the aircraft never parks mid-transition.
   const approachFrac=flightTiming(p);
   // Match the derivative across the seam in physical scroll pixels. No dwell at entry.
   const entrySlope=Math.min(2.4,Math.max(.001,.55*approach/Math.max(1,first.offsetHeight)*Math.max(1,second.offsetHeight-H)/Math.max(1,length-approach)));
   const orbit=clamp((entrySlope-2)*g*g*g+(3-2*entrySlope)*g*g+entrySlope*g);
   const distance=approach*approachFrac+(length-approach)*orbit;
   const t=clamp(distance/length),q=path!.getPointAtLength(distance),q0=path!.getPointAtLength(Math.max(0,distance-3)),q1=path!.getPointAtLength(Math.min(length,distance+3));
   const heading=Math.atan2(q1.y-q0.y,q1.x-q0.x)*180/Math.PI+12;
   const settle=ramp(g,.86,1);
   const planeAlpha=reduced.matches&&b.top<=0?0:ramp(p,.10,.19);const shrink=ramp(p,.61,1),planeW=mix(Math.min(W*(W<=700?.65:.38),610),Math.max(60,Math.min(W*.10,155)),shrink);
   if(plane.current){
    const jet=plane.current,baseScale=1-settle*.08;
    // The full portrait stays sharp; never zoom into the source pixels or crop the asset.
    const maxWidth=Math.min(1657,W*(W<=700?.92:.82));
    const approachWidth=mix(planeW*baseScale,maxWidth,push);
    const x=mix(q.x,W*.5,push)+(W*.5+approachWidth*.58)*acceleration;
    const y=mix(q.y,H*.47,push)-H*.075*acceleration-3*Math.sin(Math.PI*depart);
    const angle=mix(heading+settle*4,0,push)-3*ramp(handoff,.30,.59);
    const flightLife=ramp(handoff,.05,.24)*(1-ramp(handoff,.56,.61));
    jet.dataset.landed=String(g>=.999);jet.dataset.approach=String(bridging);
    jet.dataset.flying=String(bridging&&handoff<.61&&!reduced.matches);
    jet.style.setProperty('--bob',`${1-settle}`);
    jet.style.setProperty('--sf-flight-life',String(flightLife));
    // V23: actual on/off texture states, no additive halo or permanent baked green core.
    jet.dataset.navActive=String(!reduced.matches&&handoff>=.12&&handoff<.595);
    jet.style.setProperty('--sf-glint',String(ramp(handoff,.08,.25)*(1-ramp(handoff,.46,.60))*.26));
    jet.style.setProperty('--sf-sweep',`${mix(125,-35,ramp(handoff,.08,.58))}%`);
    jet.style.width=`${approachWidth}px`;
    // Keep the aircraft opaque until it is completely outside the viewport.
    jet.style.opacity=String(planeAlpha*(1-ramp(handoff,.61,.64)));
    jet.style.transform=`translate3d(${x}px,${y}px,0) translate(-50%,-50%) rotate(${angle}deg)`;
   }
   // During descent, erase the approach from the back toward the aircraft. Finish before globe UI.
   const lineAlpha=reduced.matches?0:ramp(p,.20,.30)*spaceExit;
   const wipe=ramp(p,.65,.88),finishWipe=ramp(p,.88,1);
   const shortTail=Math.min(distance,Math.min(W,H)*.19);
   const remainingApproach=p<1?mix(distance,shortTail,wipe)*(1-finishWipe):0;
   const orbitalDistance=Math.max(0,distance-approach);
   const orbitalTail=orbitalDistance*(1-ramp(g,.46,1));
   const tailStart=clamp(Math.max(0,(p<1?distance-remainingApproach:distance-orbitalTail))/length);
   const leading=Math.min(1-t,mix(.045,.115,ramp(p,.42,.76))*(1-ramp(g,.78,.99)));
   const setDash=(node:SVGPathElement|null,start:number,amount:number,opacity:number)=>{if(!node)return;node.setAttribute('stroke-dasharray',`${Math.max(0,amount)} 2`);node.setAttribute('stroke-dashoffset',String(-start));node.style.opacity=String(amount>0.00001?opacity:0);};
   setDash(trail.current,tailStart,p<1?t-tailStart:0,lineAlpha*mix(1,.66,ramp(p,.54,.91)));
   setDash(halo.current,tailStart,p<1?t-tailStart:0,lineAlpha*.11);
   // Fade along arc length rather than through a screen-space gradient. The
   // trailing edge dissolves first; at touchdown every segment is exactly zero.
   const orbitFade=1-ramp(g,.70,1),segment=(t-tailStart)/12;
   orbitTrail.current?.querySelectorAll('path').forEach((node,i)=>{
    const at=tailStart+i*segment,amount=p>=1?Math.min(t-at,segment+.00035):0;
    setDash(node,at,amount,lineAlpha*orbitFade*(.12+.78*ramp((i+.5)/12,0,1)));
   });
   setDash(ahead.current,t,leading,lineAlpha*mix(.18,.90,ramp(p,.43,.84)));
   const future=path!.getPointAtLength(Math.min(length,distance+leading*length)),past=path!.getPointAtLength(tailStart*length);
   const grad=(id:string,x1:number,y1:number,x2:number,y2:number)=>{const el=svg.current?.querySelector(`#${id}`);if(!el)return;el.setAttribute('x1',String(x1));el.setAttribute('y1',String(y1));el.setAttribute('x2',String(x2));el.setAttribute('y2',String(y2));};
   // An orbit returns to its starting point: use a stable globe-height gradient instead of a zero-length gradient.
   if(p>=1)grad('sf-trail',0,H,0,0);else grad('sf-trail',past.x,past.y,q.x,q.y);grad('sf-ahead',q.x,q.y,future.x,future.y);
   // Sphere and its routes emerge in the same viewport, with arcs staggered after arrival.
   if(canvas.current){canvas.current.style.opacity=String(globeAlpha*spaceExit);canvas.current.style.transform='none';canvas.current.style.pointerEvents=cityAlpha>.8&&!bridging?'auto':'none';}
   if(globeCopy.current){
    const box=globeCopy.current;box.style.opacity=String(globeAlpha*copyExit);box.inert=cityAlpha<.65||bridging;box.style.pointerEvents=cityAlpha>.65&&!bridging?'auto':'none';
    const beats=[ramp(g,.01,.085),ramp(g,.035,.13),ramp(g,.115,.205),ramp(g,.19,.33),ramp(g,.28,.39)];
    Array.from(box.children).forEach((child,i)=>{const a=reduced.matches?1:beats[i]??1;alpha(child as HTMLElement,a,(1-a)*15);});
    const title=box.querySelector('h2');if(title){const a=reduced.matches?1:ramp(g,.035,.115),b=reduced.matches?1:ramp(g,.075,.18);alpha(title.children[0] as HTMLElement,a,(1-a)*10);alpha(title.children[1] as HTMLElement,b,(1-b)*12);}
   }
   progress.current=g;
   if(globeAlpha*spaceExit>.001&&(lastPaint!==g+glow.current*7||!wasVisible)){if(!reduced.matches)ambient.current=performance.now()*.001;paintRef.current();lastPaint=g+glow.current*7;lastRender=performance.now();}
   wasVisible=true;
  };
  const queue=()=>{if(!raf)raf=requestAnimationFrame(draw);};const resize=()=>{geometry='';lastPaint=-1;queue();};
  window.addEventListener('pointermove',moveDust,{passive:true});window.addEventListener('pointercancel',resetDust);document.documentElement.addEventListener('pointerleave',resetDust);document.addEventListener('visibilitychange',onVisibility);
  window.addEventListener('scroll',queue,{passive:true});window.addEventListener('resize',resize);reduced.addEventListener('change',queue);const ro=new ResizeObserver(resize);ro.observe(el);queue();
  return()=>{delete second.dataset.simflyHandoff;cancelAnimationFrame(raf);stopAmbient();cancelAnimationFrame(dustRaf);window.removeEventListener('pointermove',moveDust);window.removeEventListener('pointercancel',resetDust);document.documentElement.removeEventListener('pointerleave',resetDust);document.removeEventListener('visibilitychange',onVisibility);ro.disconnect();window.removeEventListener('scroll',queue);window.removeEventListener('resize',resize);reduced.removeEventListener('change',queue);tween.current?.kill();if(['aircraft','globe'].includes(document.documentElement.dataset.simflyZone??''))delete document.documentElement.dataset.simflyZone;};
 },[mounted]);


 // Localized reflection on glyphs only. No backdrop, panel or pointer-capturing overlay.
 const shineTitle=(e:import('react').PointerEvent<HTMLElement>)=>{const h=e.currentTarget;h.dataset.shine='true';const parts=((h.children.length?Array.from(h.children):[h]) as HTMLElement[]);for(const part of parts){const r=part.getBoundingClientRect();part.style.setProperty('--sx',`${e.clientX-r.left}px`);part.style.setProperty('--sy',`${e.clientY-r.top}px`);}};
 const resetTitle=(e:import('react').PointerEvent<HTMLElement>)=>{delete e.currentTarget.dataset.shine;};
 return <>{mounted&&createPortal(<div className="simfly-continuum" ref={stage}>
  <div className="simfly-continuum__light"/><div className="simfly-continuum__night" ref={night}/>
  <div className="simfly-routes__world" ref={worldLayer}>
  <div className="simfly-routes__dust" ref={dust} aria-hidden="true">{skyDust.map((pt,i)=><span key={i} style={{left:`${pt.x}%`,top:`${pt.y}%`,width:pt.size,height:pt.size,animationDelay:`${pt.delay}s`,animationDuration:`${pt.duration}s`}}/>)}</div>
  <div className="simfly-routes__wordmark" ref={wordmark} aria-hidden="true">SIMFLY</div>
 <div className="simfly-routes__copy" ref={globeCopy}><h2 id="rotas-preview-title" data-focus-target><span className="simfly-title-auto" data-text={m.routes.t1}>{m.routes.t1}</span><em className="simfly-title-hover" onPointerMove={shineTitle} onPointerDown={shineTitle} onPointerEnter={shineTitle} onPointerLeave={resetTitle} onPointerUp={e=>{if(e.pointerType!=='mouse')resetTitle(e);}} onPointerCancel={resetTitle}><i data-text={m.routes.t2}>{m.routes.t2}</i><i data-text={m.routes.t3}>{m.routes.t3}</i></em></h2><p>{m.routes.p}</p></div>
 <canvas ref={canvas} className="simfly-routes__canvas" aria-label={m.routes.globe} role="img" onPointerDown={e=>{tween.current?.kill();drag.current={x:e.clientX,y:e.clientY};if(e.pointerType==='mouse')e.currentTarget.setPointerCapture(e.pointerId);}} onPointerMove={e=>{if(drag.current){offset.current+=(e.clientX-drag.current.x)*.006;if(e.pointerType==='mouse')pitch.current=Math.max(-.6,Math.min(.6,pitch.current+(e.clientY-drag.current.y)*.004));drag.current={x:e.clientX,y:e.clientY};paintRef.current();}}} onPointerUp={()=>{drag.current=null;}} onPointerCancel={()=>{drag.current=null;}} style={{touchAction:'pan-y',cursor:'grab'}}/>

  </div>
  <svg ref={svg} className="simfly-continuum__route" aria-hidden="true"><defs><linearGradient id="sf-trail" gradientUnits="userSpaceOnUse"><stop stopColor="#85b7ef" stopOpacity=".18"/><stop offset=".48" stopColor="#367ed4"/><stop offset="1" stopColor="#9dd8ff"/></linearGradient><linearGradient id="sf-ahead" gradientUnits="userSpaceOnUse"><stop stopColor="#91c6ff"/><stop offset=".48" stopColor="#478ce7" stopOpacity=".65"/><stop offset="1" stopColor="#a8d8ff" stopOpacity="0"/></linearGradient></defs>
   <path ref={measure} fill="none" stroke="none"/><path ref={track} fill="none" stroke="none"/>
   <path ref={halo} pathLength="1" fill="none" stroke="#5aabff" strokeWidth="7" strokeLinecap="round" opacity="0"/>
   <path ref={trail} pathLength="1" fill="none" stroke="url(#sf-trail)" strokeWidth="2.2" strokeLinecap="round" opacity="0"/>
   <g ref={orbitTrail}>{Array.from({length:12},(_,i)=><path key={i} pathLength="1" fill="none" stroke="#9dd8ff" strokeWidth="2.2" strokeLinecap="butt" opacity="0"/>)}</g>
   <path ref={ahead} pathLength="1" fill="none" stroke="url(#sf-ahead)" strokeWidth="1.9" strokeLinecap="round" opacity="0"/>
  </svg>
  <div className="simfly-continuum__aircopy" ref={copy}><article><h2 id="sobre-title" data-focus-target>{m.about.a1}<br/>{m.about.a2} <em>{m.about.a3}</em></h2><p>{m.about.ap}</p></article><article><h2>{m.about.b1}<br/>{m.about.b2} <em>{m.about.b3}</em></h2><p>{m.about.bp}</p></article></div>
  <div className="simfly-continuum__plane" ref={plane}><img src="/media/simfly-plane-cutout.webp" alt="" decoding="async"/><div className="simfly-approach-rig"><img className="simfly-approach-source" src="/media/simfly-plane-approach-3840.webp" alt="" decoding="async"/><img className="simfly-approach-source simfly-approach-lamp-off" src="/media/simfly-plane-approach-lamp-off.webp" alt="" decoding="async" aria-hidden="true"/></div></div>
  <div className="simfly-continuum__meta" ref={meta}/>

 <div className="simfly-handoff__optical" ref={optical} aria-hidden="true"/>
 <div className="simfly-handoff__pearl" ref={pearl} aria-hidden="true"/>
 </div>,document.body)}<style jsx global>{`
 #portal.simfly-aircraft-chapter{height:345svh;background:#f5f7fa!important;}#rotas-preview.simfly-routes-chapter{height:255svh;background:#091525!important;}
 #portal.simfly-aircraft-chapter,#rotas-preview.simfly-routes-chapter{border:0!important;outline:0!important;margin:0!important;box-shadow:none!important;}
 #portal.simfly-aircraft-chapter .chapter__sticky,#rotas-preview.simfly-routes-chapter .chapter__sticky{position:sticky;top:0;height:100svh;min-height:0;padding:0;display:block;border:0!important;outline:0!important;}




 #rotas-preview.simfly-routes-chapter[data-simfly-handoff='true']{background:transparent!important;}
 .simfly-routes__world{position:absolute;inset:0;z-index:2;pointer-events:none;transform-origin:50% 50%;}
 .simfly-continuum__plane .simfly-approach-rig{display:none;}
 .simfly-continuum__plane[data-approach=true]>img:first-child{visibility:hidden;}
 .simfly-continuum__plane[data-approach=true] .simfly-approach-rig{display:block;position:absolute;left:0;top:0;width:100%;aspect-ratio:3840/1168;transform-origin:50% 52%;}
 .simfly-continuum__plane[data-approach=true] .simfly-approach-source{display:block;width:100%;height:100%;object-fit:contain;filter:none;animation:none!important;transform:none;}
 /* V23: switch the two registered textures, never composite them together. */
 .simfly-continuum__plane[data-approach=true] .simfly-approach-lamp-off{position:absolute;inset:0;visibility:hidden;pointer-events:none;}
 .simfly-continuum[data-visible=true] .simfly-continuum__plane[data-nav-active=true] .simfly-approach-source:not(.simfly-approach-lamp-off){animation:sf-v23-lamp-on 1.25s step-end infinite!important;}
 .simfly-continuum[data-visible=true] .simfly-continuum__plane[data-nav-active=true] .simfly-approach-lamp-off{animation:sf-v23-lamp-off 1.25s step-end infinite!important;}
 @keyframes sf-v23-lamp-on{0%{visibility:visible}32%,100%{visibility:hidden}}
 @keyframes sf-v23-lamp-off{0%{visibility:hidden}32%,100%{visibility:visible}}
 @media(prefers-reduced-motion:reduce){.simfly-continuum[data-visible=true] .simfly-continuum__plane[data-nav-active=true] .simfly-approach-source{animation:none!important;}.simfly-continuum__plane .simfly-approach-lamp-off{visibility:hidden!important;}}
 .simfly-handoff__optical,.simfly-handoff__pearl{position:absolute;inset:0;pointer-events:none;opacity:0;}
 .simfly-handoff__optical{z-index:7;background:radial-gradient(ellipse at var(--sf-light-x,110%) 47%,#f3fafff0 0%,#cde7fa99 29%,#578ec940 53%,#15365400 79%);}
 .simfly-handoff__pearl{z-index:8;background:#f4f1ea;}
 .simfly-continuum__plane::after{content:'';position:absolute;inset:0;pointer-events:none;opacity:var(--sf-glint,0);background:linear-gradient(110deg,transparent 32%,#85c9ff55 43%,#f9fdff 50%,#c1e5ff80 57%,transparent 68%);background-size:250% 100%;background-position:var(--sf-sweep,125%) 50%;mask:url('/media/simfly-plane-cutout.webp') center / 100% 100% no-repeat;-webkit-mask:url('/media/simfly-plane-cutout.webp') center / 100% 100% no-repeat;}
 .simfly-continuum__plane[data-approach=true]::after{mask-image:url('/media/simfly-plane-approach-3840.webp');-webkit-mask-image:url('/media/simfly-plane-approach-3840.webp');}
 .simfly-continuum{position:fixed;inset:0;z-index:35;isolation:isolate;overflow:hidden;visibility:hidden;opacity:0;pointer-events:none;background:#f5f7fa;}
 .simfly-continuum__light,.simfly-continuum__night{position:absolute;inset:0;pointer-events:none;}.simfly-continuum__light{background:radial-gradient(ellipse at 74% 55%,#e4edf7,#f5f7fa 76%);}.simfly-continuum__night{background:radial-gradient(ellipse at 70% 52%,#173753,#0d2036 38%,#091525 74%);opacity:0;}
 .simfly-routes__dust{position:absolute;inset:0;z-index:1;pointer-events:none;opacity:0;transform:translate3d(var(--dx,0px),calc(var(--dy,0px) + var(--scroll-drift,0px)),0);transition:transform .35s ease-out;}
 .simfly-routes__dust span{position:absolute;display:block;border-radius:50%;background:#c0def9;opacity:.18;animation:sf-dust 7s ease-in-out infinite;animation-play-state:paused;}
 .simfly-continuum[data-dust=true] .simfly-routes__dust span{animation-play-state:running;}
 @keyframes sf-dust{0%,100%{opacity:.12;transform:translate3d(0,0,0)}50%{opacity:.46;transform:translate3d(1px,-2px,0)}}
 .simfly-routes__wordmark{position:absolute;left:50%;bottom:1.8vh;transform:translateX(-50%);z-index:1;pointer-events:none;white-space:nowrap;user-select:none;opacity:0;font:500 clamp(92px,24vw,450px)/.86 var(--font-sans);letter-spacing:-.075em;color:transparent;-webkit-text-fill-color:transparent;-webkit-text-stroke:1px rgba(150,198,242,.19);}
 @media(prefers-reduced-motion:reduce){.simfly-routes__dust span{animation:none!important;opacity:.22;}.simfly-routes__dust{transition:none;transform:none;}}
 .simfly-continuum__route{position:absolute;inset:0;width:100%;height:100%;z-index:3;pointer-events:none;overflow:visible;}
 .simfly-continuum__aircopy{position:absolute;inset:0;z-index:4;pointer-events:none;text-align:left;}.simfly-continuum__aircopy article{position:absolute;left:7vw;top:27%;width:min(59vw,850px);color:#14253e;opacity:0;}.simfly-continuum__aircopy small,.simfly-continuum__meta{font:500 10px/1.4 var(--font-sans);letter-spacing:.2em;}.simfly-continuum__aircopy h2{margin:20px 0;font-family:var(--font-sans);font-size:clamp(44px,7vw,112px);font-weight:400;letter-spacing:-.065em;line-height:.94;}.simfly-continuum__aircopy em{font:italic 400 1.02em/1 var(--font-serif);color:#225b9b;}.simfly-continuum__aircopy p{max-width:35ch;font-size:clamp(14px,1.3vw,19px);color:#536477;}
 .simfly-continuum__plane{position:absolute;left:0;top:0;z-index:3;opacity:0;pointer-events:none;will-change:transform,opacity;transform-origin:50% 50%;}.simfly-continuum__plane img{display:block;width:100%;height:auto;filter:drop-shadow(0 13px 16px #122c5230);animation:sf-v4-float 4.8s ease-in-out infinite;animation-play-state:paused;}.simfly-continuum[data-visible=true] .simfly-continuum__plane img{animation-play-state:running;}@keyframes sf-v4-float{0%,100%{transform:translateY(0) rotate(calc(-.65deg * var(--bob,1)))}50%{transform:translateY(calc(-5px * var(--bob,1))) rotate(calc(.65deg * var(--bob,1)))}}
 .simfly-continuum__meta{position:absolute;left:7vw;right:7vw;bottom:30px;display:flex;justify-content:space-between;color:#526479;z-index:4;opacity:0;}
.simfly-routes__copy{position:absolute;left:7vw;top:19%;width:min(38vw,460px);z-index:5;opacity:0;pointer-events:none}.simfly-routes__copy>small{font-size:10px;letter-spacing:.2em;color:#a5bdd5}.simfly-routes__copy h2{margin:18px 0;font-family:var(--font-sans);font-weight:400;font-size:clamp(38px,5.5vw,88px);line-height:.95;letter-spacing:-.065em;color:#eff6fd;touch-action:pan-y}.simfly-routes__copy h2 .simfly-title-auto,.simfly-routes__copy h2 .simfly-title-hover,.simfly-routes__copy h2 .simfly-title-hover i{display:block;--sx:50%;--sy:50%;--ink:#eff6fd;color:var(--ink)}.simfly-routes__copy h2 .simfly-title-auto{position:relative;isolation:isolate;text-shadow:0 0 18px rgba(128,197,255,.18),0 0 34px rgba(89,176,255,.16);animation:sf-title-breathe 2.9s ease-in-out infinite}.simfly-routes__copy h2 .simfly-title-hover{--ink:#a3ccf3;font-family:var(--font-serif);font-weight:400;font-style:italic;transition:filter .22s ease}
 .simfly-routes__copy h2 .simfly-title-auto{animation:none;color:#eff6fd;text-shadow:0 0 14px #8ecbff25;position:relative;width:max-content;max-width:100%;}
 .simfly-routes__copy h2 .simfly-title-hover i{--ink:#a3ccf3;position:relative;width:max-content;max-width:100%;}
 .simfly-routes__copy h2 [data-text]::after{content:attr(data-text);position:absolute;inset:0;pointer-events:none;color:transparent;-webkit-text-fill-color:transparent;background-clip:text;-webkit-background-clip:text;}
 .simfly-title-auto::after{background-image:linear-gradient(108deg,transparent 32%,#4ca8ff 43%,#b6ecff 49%,#fff 51%,#6bbdff 56%,transparent 68%);background-size:270% 100%;background-position:110% 0;filter:drop-shadow(0 0 5px #73c6ffb0) drop-shadow(0 0 12px #408dff65);animation:sf-title-drift 3.8s linear infinite;animation-play-state:paused;}
 .simfly-continuum[data-visible=true] .simfly-title-auto::after{animation-play-state:running;}
 @keyframes sf-title-drift{0%{background-position:110% 0}66%,100%{background-position:-90% 0}}
 .simfly-title-hover i::after{opacity:0;background-image:radial-gradient(ellipse 112px 85px at var(--sx) var(--sy),#fff 0%,#9edcff 30%,#6dbbff 49%,transparent 75%);transition:opacity .18s;filter:drop-shadow(0 0 5px #74bfff80);}
 .simfly-title-hover[data-shine=true] i::after{opacity:1;}
 .simfly-continuum[data-visible=true] .simfly-continuum__plane[data-landed=true] img{animation:none!important;transform:none;}
 .simfly-continuum[data-visible=true] .simfly-continuum__plane[data-flying=true] .simfly-approach-rig{animation:sf-v21-flight 2.3s ease-in-out infinite!important;transform-origin:50% 52%;}
 @keyframes sf-v21-flight{0%,100%{transform:translate3d(0,0,0) rotate(calc(-.65deg * var(--sf-flight-life,0)))}50%{transform:translate3d(0,calc(-3px * var(--sf-flight-life,0)),0) rotate(calc(.65deg * var(--sf-flight-life,0)))}}
 @media(prefers-reduced-motion:reduce){.simfly-continuum[data-visible=true] .simfly-continuum__plane[data-flying=true] .simfly-approach-rig{animation:none!important;}}
 @media(prefers-reduced-motion:reduce){.simfly-title-auto::after{animation:none!important;opacity:0;}}

 .simfly-routes__copy p{font-size:clamp(13px,1.2vw,17px);max-width:34ch;color:#b4c5d7}
 .simfly-routes__cities{position:relative;z-index:1;display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:22px}.simfly-routes__cities button{cursor:pointer;position:relative;overflow:hidden;text-align:left;padding:14px 16px;border:1px solid rgba(225,241,255,.18);background:linear-gradient(180deg,rgba(255,255,255,.20) 0%,rgba(188,221,255,.08) 12%,rgba(89,131,175,.18) 55%,rgba(10,27,45,.42) 100%);border-radius:20px;color:#eef7ff;font-size:13px;display:flex;justify-content:space-between;align-items:center;gap:8px;box-shadow:inset 0 1px 0 rgba(255,255,255,.58),inset 0 -1px 0 rgba(132,191,255,.12),0 20px 44px rgba(4,16,31,.34),0 0 0 1px rgba(255,255,255,.05);backdrop-filter:blur(22px) saturate(170%);-webkit-backdrop-filter:blur(22px) saturate(170%);transition:background .2s,border-color .2s,transform .2s,box-shadow .2s}.simfly-routes__cities button::before{content:'';position:absolute;inset:1px;border-radius:inherit;background:linear-gradient(180deg,rgba(255,255,255,.28),rgba(255,255,255,.06) 34%,rgba(255,255,255,0) 55%);pointer-events:none}.simfly-routes__cities button::after{content:'';position:absolute;left:-35%;top:-55%;width:58%;height:220%;transform:rotate(28deg);background:linear-gradient(90deg,rgba(255,255,255,0),rgba(255,255,255,.18),rgba(255,255,255,0));opacity:.7;pointer-events:none}.simfly-routes__cities button:hover{border-color:rgba(226,242,255,.52);transform:translateY(-1px);box-shadow:inset 0 1px 0 rgba(255,255,255,.68),0 24px 48px rgba(7,23,45,.46),0 0 18px rgba(121,190,255,.22)}.simfly-routes__cities button[aria-pressed=true]{background:linear-gradient(180deg,rgba(255,255,255,.28) 0%,rgba(208,234,255,.14) 12%,rgba(94,146,201,.26) 54%,rgba(15,41,71,.58) 100%);border-color:rgba(190,224,255,.82);box-shadow:inset 0 1px rgba(255,255,255,.72),0 0 0 1px rgba(181,220,255,.20),0 22px 50px rgba(7,23,45,.55),0 0 30px rgba(90,174,255,.28)}.simfly-routes__cities b{font-size:12px;font-weight:400;color:#d1e8ff}.simfly-routes__cities small{display:block;color:#d2e3f2;font-size:8px;letter-spacing:.08em}.simfly-routes__note{position:relative;z-index:1;font-size:10px!important}.simfly-routes__canvas{position:absolute;left:37%;top:5%;width:63%;height:90%;z-index:2;cursor:grab;pointer-events:none;touch-action:pan-y;opacity:0}.simfly-routes__canvas:active{cursor:grabbing}.simfly-continuum__aircopy,.simfly-continuum__meta,.simfly-routes__copy{cursor:inherit}

 html[data-simfly-zone='aircraft'] .site-header{--fg:#13243b;--fg-soft:#536477;--header-tint:#f5f7fa;color:#13243b}html[data-simfly-zone='globe'] .site-header{--fg:#fff;--fg-soft:#b4c5d7;--header-tint:#091525;color:#fff}html[data-simfly-zone='aircraft'] .scene-index,html[data-simfly-zone='globe'] .scene-index{display:none}
 @media(max-width:700px){.simfly-routes__wordmark{font-size:24vw;bottom:1.4vh;-webkit-text-stroke:.7px rgba(150,198,242,.19)}#portal.simfly-aircraft-chapter{height:300svh}#rotas-preview.simfly-routes-chapter{height:240svh}.simfly-continuum__aircopy article{left:6vw;top:18%;width:88vw}.simfly-continuum__aircopy h2{font-size:clamp(43px,10vw,72px)}.simfly-continuum__meta{font-size:8px}.simfly-routes__copy{left:6vw;top:12%;width:88vw}.simfly-routes__copy h2{font-size:clamp(35px,8vw,57px)}.simfly-routes__canvas{left:0;top:48%;width:100%;height:51%}.simfly-routes__cities{grid-template-columns:repeat(2,1fr);margin-top:10px}.simfly-routes__cities button{font-size:11px;padding:6px 8px}.simfly-routes__cities small{font-size:7px}.simfly-routes__copy p{margin:8px 0}}
 .simfly-continuum[data-handoff=true] .simfly-title-auto::after,.simfly-continuum[data-handoff=true] .simfly-routes__dust span{animation-play-state:paused;}
 @media(prefers-reduced-motion:reduce){#portal.simfly-aircraft-chapter,#rotas-preview.simfly-routes-chapter{height:100svh}.simfly-continuum__plane img{animation:none!important}}
 `}</style></>;
}
