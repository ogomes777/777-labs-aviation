import ExperienceRoot from '@/components/ExperienceRoot';
import SiteHeader from '@/components/SiteHeader';
import SceneProgress from '@/components/SceneProgress';
import AircraftControls from '@/components/AircraftControls';
import AnatomyPanel, { HotspotLayer } from '@/components/AnatomyPanel';
import CabinGallery from '@/components/CabinGallery';
import DestinationsPanel from '@/components/DestinationsPanel';
import CharterInquiry from '@/components/CharterInquiry';
import Epilogue from '@/components/Epilogue';
import ConsentBar from '@/components/ConsentBar';
import HeroActions from '@/components/HeroActions';
import LiteHeroVideo from '@/components/LiteHeroVideo';
import FleetShowroom from '@/components/FleetShowroom';
import Cursor from '@/components/Cursor';
import Words from '@/components/Words';
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
      <a href="#main" className="skip-link">Pular para o conteúdo</a>
      <ExperienceRoot />
      <SiteHeader />
      <SceneProgress />
      <Cursor />
      <TextReact />
      <main id="main">
        <section id="top" className="chapter hero" data-chapter="0" style={L(260)} aria-labelledby="hero-title">
          <div className="chapter__sticky">
            <Still id="hero" scrim="linear-gradient(90deg, rgba(247,240,236,0.5), transparent 60%)" />
            <LiteHeroVideo />
            <div className="hero__copy">
              <h1 id="hero-title" className="reveal" data-out="0.34" data-intro data-focus-target>
                <Words>O mundo muda quando você escolhe</Words> <em><Words>a altura.</Words></em>
              </h1>
              <p className="lede reveal" data-out="0.32" data-intro-fade>Tempo, espaço e liberdade, vistos de cima.</p>
              <HeroActions />
            </div>
            <p className="hero__ascent reveal" data-in="0.4" data-out="0.8" data-split aria-hidden="true"><Words>Acima do ruído,</Words> <em><Words>o tempo é seu.</Words></em></p>
          </div>
        </section>

        <section id="portal" className="chapter portal" data-chapter="1" style={L(240)} aria-label="Limiar">
          <div className="chapter__sticky">
            <Still id="portal" />
            <p className="portal__line reveal" data-in="0.04" data-out="0.3" data-split><Words>Toda jornada tem</Words> <em><Words>um limiar.</Words></em></p>
            <p className="portal__line portal__line--b reveal" data-in="0.42" data-out="0.72" data-split><Words>Do outro lado,</Words> <em><Words>o tempo desacelera.</Words></em></p>
          </div>
        </section>

        <section id="aeronave" className="chapter" data-chapter="2" style={L(300)} aria-labelledby="aeronave-title">
          <div className="chapter__sticky">
            <Still id="aeronave" alt="Aeronave conceitual em hangar escuro" scrim="linear-gradient(90deg, rgba(6,8,11,0.7), transparent 60%)" />
            <div className="panel panel--bottom reveal" data-in="0.06" data-out="0.96">
              <h2 id="aeronave-title" data-split data-focus-target><Words>Escultura</Words> <em><Words>em movimento.</Words></em></h2>
              <AircraftControls />
            </div>
          </div>
        </section>

        <section id="frota" className="chapter fleet" data-chapter="3" style={L(520)} aria-labelledby="frota-title">
          <div className="chapter__sticky">
            <Still id="frota" alt="Fila de aeronaves conceituais no hangar" scrim="linear-gradient(180deg, rgba(6,8,11,0.6), transparent 40%)" />
            <h2 id="frota-title" className="fleet__title reveal" data-in="0.02" data-split data-focus-target><Words>A</Words> <em><Words>frota.</Words></em></h2>
            <FleetShowroom />
          </div>
        </section>

        <section id="engenharia" className="chapter anatomy" data-chapter="4" style={L(300)} aria-labelledby="engenharia-title">
          <div className="chapter__sticky">
            <Still id="engenharia" alt="Vista superior técnica da aeronave em fundo marfim" />
            <HotspotLayer />
            <div className="panel panel--right reveal" data-in="0.3" data-out="0.97">
              <h2 id="engenharia-title" data-split data-focus-target><Words>Cada linha,</Words> <em><Words>uma intenção.</Words></em></h2>
              <AnatomyPanel />
            </div>
          </div>
        </section>

        <section id="interior" className="chapter" data-chapter="5" style={L(230)} aria-labelledby="interior-title">
          <div className="chapter__sticky">
            <Still id="interior" alt="Planta em corte da cabine vista de cima" />
            <div className="panel reveal" data-in="0.04" data-out="0.55">
              <h2 id="interior-title" data-split data-focus-target><Words>Entre partir</Words> <em><Words>e chegar.</Words></em></h2>
            </div>
          </div>
        </section>

        <section id="experiencia" className="chapter" data-chapter="6" style={L(420)} aria-labelledby="experiencia-title">
          <div className="chapter__sticky gallery">
            <Still id="experiencia" scrim="linear-gradient(180deg, rgba(20,14,9,0.6), transparent 40%)" />
            <div className="gallery__head reveal" data-in="0.01">
              <h2 id="experiencia-title" data-split data-focus-target><Words>Cada</Words> <em><Words>detalhe.</Words></em></h2>
            </div>
            <CabinGallery />
          </div>
        </section>

        <section id="destinos" className="chapter destinations" data-chapter="7" style={L(240)} aria-labelledby="destinos-title">
          <div className="chapter__sticky">
            <Still id="destinos" scrim="rgba(7,11,18,0.35)" />
            <DestinationsPanel />
          </div>
        </section>

        <div className="finale" data-chapter="8">
          <section id="planejar" className="inquiry" aria-labelledby="planejar-title">
            <div className="inquiry__grid">
              <div className="inquiry__intro reveal-soft">
                <h2 id="planejar-title" data-split data-focus-target><Words>Comece por</Words> <em><Words>uma conversa.</Words></em></h2>
                <p className="lede">Demonstração: nenhuma reserva é feita e nenhum dado vai a uma operadora.</p>
              </div>
              <CharterInquiry />
            </div>
          </section>
          <section id="epilogo" className="epilogue" aria-label="Epílogo">
            <Still id="epilogo" />
            <Epilogue />
          </section>
        </div>
      </main>
      <svg className="route-layer" aria-hidden="true"><path id="route-path" pathLength={1} /></svg>
      <ConsentBar />
    </>
  );
}
