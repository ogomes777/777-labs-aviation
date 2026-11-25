export type FleetMode = 'browse'|'entering'|'xray'|'exploded'|'system'|'part'|'subpart'|'floorplan'|'interior'|'exiting'|'fallback';
export const IDS = ['legacy-450','praetor-500','praetor-600','matrix','citation-cj2-plus'] as const;
export type AircraftId = typeof IDS[number];
export const clamp = (x:number, min=0,max=1)=>Math.min(max,Math.max(min,Number.isFinite(x)?x:min));
export function fleetIndex(progress:number, previous:number, hysteresis=.045) {
  const n=clamp(progress)*4; const p=Math.round(clamp(previous,0,4));
  if(n>p+.5+hysteresis||n<p-.5-hysteresis)return Math.round(n);
  return p;
}
export const progressForIndex=(i:number)=>clamp(i,0,4)/4;
export const explosionLabel=(amount:number, target:number)=> (target>.01 || (amount>.01 && target!==0))?'Montar aeronave':'Abrir em camadas';
export const quoteUrl=(phone:string,name:string,year:number)=>{
  if(!/^\d{10,15}$/.test(phone))throw new Error('Telefone inválido');
  return `https://wa.me/${phone}?text=${encodeURIComponent(`Olá, tenho interesse no ${name} ${year}. Gostaria de confirmar disponibilidade e receber informações.`)}`;
};
export type Inspector={mode:FleetMode; aircraft:AircraftId; part:string|null; revision:number; target:number};
export function selectModel(s:Inspector,aircraft:AircraftId):Inspector{return {...s,aircraft,mode:'browse',part:null,revision:s.revision+1,target:0};}
export function closeInspector(s:Inspector):Inspector{return {...s,mode:'browse',part:null,revision:s.revision+1,target:0};}
export function selectPart(s:Inspector,id:string,available:ReadonlySet<string>):Inspector{
 if(!available.has(id))return s;
 return {...s,mode:'part',part:id,revision:s.revision+1,target:0};
}
