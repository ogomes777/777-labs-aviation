import ExperienceRoot from '@/components/ExperienceRoot';
import SiteHeader from '@/components/SiteHeader';
import AnatomyPanel, { HotspotLayer } from '@/components/AnatomyPanel';
import CabinGallery from '@/components/CabinGallery';
import CabinCinema27 from '@/components/CabinCinema27';
import ContactActions from '@/components/ContactActions';
import Epilogue from '@/components/Epilogue';
import ConsentBar from '@/components/ConsentBar';
import SimFlyHero from '@/components/SimFlyHero';
import { SimFlyAviationSection, SimFlyRoutesGlobe } from '@/components/SimFlyJourney';
import FleetShowroom from '@/components/FleetShowroom';
import Cursor from '@/components/Cursor';
import FlightHud from '@/components/FlightHud';
import FinaleGlobe from '@/components/FinaleGlobe';
import { T, TW } from '@/i18n/T';
import ServicesList from '@/components/ServicesList';
import WantedList from '@/components/WantedList';
import TextReact from '@/components/TextReact';

function Still({ id, alt = '', scrim }: { id: string; alt?: string; scrim?: string }) {
  return (
    <picture className="still" style={scrim ? ({ ['--still-scrim' as string]: scrim } as React.CSSProperties) : undefined}>
      <source media="(max-aspect-ratio: 4/5)" srcSet={`/media/still-${id}-m.webp`} />
      <img src={`/media/still-${id}.webp`} alt={alt} loading="lazy" decoding="async" />
    </picture>
  );
}
const L = (n: number) => ({ ['--len' as string]: n }) as React.CSSProperties;

export default function Page() {
  return (
    <>
      <a href="#main" className="skip-link"><T k="meta.skip" /></a>
      <ExperienceRoot />
      <SiteHeader />
      <Cursor />
      <TextReact />
      <main id="main">
        <section id="top" className="chapter hero simfly-hero" data-chapter="0" style={L(520)} aria-labelledby="hero-title">
          <div className="chapter__sticky"><SimFlyHero /></div>
        </section>

        <section id="portal" className="chapter portal simfly-aircraft-chapter" data-chapter="1" style={L(310)} aria-labelledby="sobre-title">
          <div className="chapter__sticky"><SimFlyAviationSection /></div>
        </section>

        {/* Independent scroll chapter: preserve the original director's 0..8 chapter indices. */}
        <section id="rotas-preview" className="chapter simfly-routes-chapter" style={L(235)} aria-labelledby="rotas-preview-title">
          <div className="chapter__sticky"><SimFlyRoutesGlobe /></div>
        </section>

        <section id="engenharia" className="chapter anatomy" data-chapter="4" style={L(276)} aria-labelledby="engenharia-title">
          <span id="aeronave" aria-hidden="true" style={{ position: "absolute", top: 0 }} />
          <div className="chapter__sticky">
            <Still id="engenharia" alt="Vista superior técnica da aeronave em fundo marfim" />
            <HotspotLayer />
            <div className="panel panel--right reveal" data-in="0.205" data-out="0.966">
              <h2 id="engenharia-title" data-split data-focus-target><TW k="anatomy.t1" /> <em><TW k="anatomy.t2" /></em></h2>
              <AnatomyPanel />
            </div>
          </div>
        </section>

        <section id="interior" className="chapter" data-chapter="5" style={L(230)} aria-labelledby="interior-title">
          <div className="chapter__sticky">
            <Still id="interior" alt="Planta em corte da cabine vista de cima" />
            <div className="panel panel--services reveal" data-in="0.04" data-out="0.72">
              <h2 id="interior-title" data-split data-focus-target><TW k="services.t1" /> <em><TW k="services.t2" /></em></h2>
              <ServicesList />
            </div>
          </div>
        </section>

        <section id="experiencia" className="chapter" data-chapter="6" style={L(420)} aria-labelledby="experiencia-title">
          <div className="chapter__sticky gallery">
            <Still id="experiencia" scrim="linear-gradient(180deg, rgba(20,14,9,0.6), transparent 40%)" />
            <div className="gallery__head reveal" data-in="0.01" data-out="0.91">
              <h2 id="experiencia-title" data-split data-focus-target><TW k="experience.t1" /> <em><TW k="experience.t2" /></em></h2>
            </div>
            <CabinGallery />
            <CabinCinema27 />
          </div>
        </section>

        <section id="frota" className="chapter fleet" data-chapter="3" style={L(520)} aria-labelledby="frota-title">
          <div className="chapter__sticky">
            <Still id="frota" alt="Fila de aeronaves conceituais no hangar" scrim="linear-gradient(180deg, rgba(6,8,11,0.6), transparent 40%)" />
            <h2 id="frota-title" className="fleet__title" data-focus-target><T k="fleet.title" /></h2>
            <FleetShowroom />
          </div>
        </section>

        <div className="finale" data-chapter="8">
          <section id="procuramos" className="sf-wanted" aria-labelledby="procuramos-title">
            <h2 id="procuramos-title" data-split data-focus-target><TW k="wanted.t1" /> <em><TW k="wanted.t2" /></em></h2>
            <p className="sf-lede"><T k="wanted.lede" /></p>
            <WantedList />
          </section>
          <section id="planejar" className="sf-contact" aria-labelledby="planejar-title">
            <h2 id="planejar-title" data-split data-focus-target><TW k="contact.t1" /> <em><TW k="contact.t2" /></em></h2>
            <p className="sf-lede"><T k="contact.lede" /></p>
            <ContactActions />
          </section>
          <section id="epilogo" className="epilogue" aria-label="SimFly">
            <Epilogue />
          </section>
        </div>
      </main>
      <svg className="route-layer" aria-hidden="true"><path id="route-path" pathLength={1} /></svg>
      <FlightHud />
      <FinaleGlobe />
      <ConsentBar />
    </>
  );
}
