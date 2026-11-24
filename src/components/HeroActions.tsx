'use client';
import { navigate } from './navigation';
import { track } from '@/lib/analytics';

export default function HeroActions() {
  return (
    <div className="hero__actions reveal" data-out="0.3" data-intro-fade>
      <a href="#planejar" className="btn btn--solid" onClick={(e) => { e.preventDefault(); track('contact_click', { from: 'hero' }); navigate('#planejar'); }}>Planejar jornada</a>
      <a href="#aeronave" className="textbtn" onClick={(e) => { e.preventDefault(); track('aircraft_explore_start', { from: 'hero' }); navigate('#aeronave'); }}>Explorar</a>
    </div>
  );
}
