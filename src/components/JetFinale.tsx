'use client';
import { useEffect, useRef, useState } from 'react';
import { CONTACT } from '@/content/fleet';
import { useM } from '@/i18n';
import { navigate } from './navigation';
import { track } from '@/lib/analytics';

/**
 * Contato + rodapé (V15): céu azul-bebê e branco, tipografia bold (expandida no título, condensada nas
 * palavras gigantes ao fundo). Tudo no scroll/toque, em uma cena fixa:
 *   1. a turbina sobe com a seção; a nuvem chega primeiro;
 *   2. a turbina gira (acelera com o scroll), as pás trocam de cor e o céu clareia;
 *   3. a turbina desce e sai; o nariz do avião entra de cima, de cabeça para baixo, e assenta;
 *   4. rodapé: assinatura, texto e links.
 * Turbina e nariz são ilustrações vetoriais originais (SVG) — nenhuma imagem de terceiros.
 */

// ---------- turbina (geometria calculada uma vez) ----------
const C = 500, BLADES = 22, R0 = 112, R1 = 398;
const pol = (r: number, a: number) => `${(C + r * Math.cos(a)).toFixed(1)},${(C + r * Math.sin(a)).toFixed(1)}`;
const bladePath = (i: number) => {
  const a = (i / BLADES) * Math.PI * 2, sweep = 0.42, w0 = 0.16, w1 = 0.2;
  const rl = pol(R0, a), rt = pol(R0, a + w0);
  const tl = pol(R1, a + sweep), tt = pol(R1, a + sweep + w1);
  const cl = pol((R0 + R1) * 0.52, a + sweep * 0.32), ct = pol((R0 + R1) * 0.55, a + w0 + sweep * 0.42);
  return `M${rl} Q${cl} ${tl} A${R1},${R1} 0 0 1 ${tt} Q${ct} ${rt} Z`;
};
const edgePath = (i: number) => {
  const a = (i / BLADES) * Math.PI * 2, sweep = 0.42;
  return `M${pol(R0 + 4, a + 0.01)} Q${pol((R0 + R1) * 0.52, a + sweep * 0.32 + 0.01)} ${pol(R1 - 4, a + sweep + 0.01)}`;
};
const BLADE_D = Array.from({ length: BLADES }, (_, i) => bladePath(i));
const EDGE_D = Array.from({ length: BLADES }, (_, i) => edgePath(i));

function Fan({ id, tone }: { id: string; tone: 'steel' | 'blue' }) {
  const g = tone === 'steel'
    ? ['#0b1730', '#1d3360', '#5f7fae', '#c9d8ee']
    : ['#06122c', '#0e3f9e', '#2c7dff', '#a9cdff'];
  return (
    <svg viewBox="0 0 1000 1000" className="jf-fan__svg" aria-hidden="true">
      <defs>
        <radialGradient id={`${id}-b`} cx="500" cy="500" r="400" gradientUnits="userSpaceOnUse">
          <stop offset="0.26" stopColor={g[0]} /><stop offset="0.55" stopColor={g[1]} /><stop offset="0.86" stopColor={g[2]} /><stop offset="1" stopColor={g[3]} />
        </radialGradient>
      </defs>
      {BLADE_D.map((d, i) => <path key={i} d={d} fill={`url(#${id}-b)`} />)}
      {EDGE_D.map((d, i) => <path key={i} d={d} fill="none" stroke="rgba(255,255,255,.42)" strokeWidth="2.2" strokeLinecap="round" />)}
    </svg>
  );
}

function Turbine() {
  return (
    <div className="jf-turbine" aria-hidden="true">
      {/* nacele: lábio cromado em dois anéis (bisel), parede interna escura */}
      <svg viewBox="0 0 1000 1000" className="jf-turbine__ring">
        <defs>
          <linearGradient id="jf-chrome" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#ffffff" /><stop offset=".22" stopColor="#dfe6ef" /><stop offset=".42" stopColor="#9eabbd" />
            <stop offset=".55" stopColor="#f7f9fc" /><stop offset=".72" stopColor="#b7c2d1" /><stop offset="1" stopColor="#eef2f7" />
          </linearGradient>
          <linearGradient id="jf-chrome-in" x1="1" y1="1" x2="0" y2="0">
            <stop offset="0" stopColor="#ffffff" /><stop offset=".3" stopColor="#aeb9c9" /><stop offset=".6" stopColor="#f4f6fa" /><stop offset="1" stopColor="#8f9cb0" />
          </linearGradient>
          <radialGradient id="jf-throat" cx="500" cy="500" r="430" gradientUnits="userSpaceOnUse">
            <stop offset=".6" stopColor="#030a1a" /><stop offset=".9" stopColor="#13264a" /><stop offset="1" stopColor="#40557c" />
          </radialGradient>
        </defs>
        <circle cx="500" cy="500" r="496" fill="url(#jf-chrome)" />
        <circle cx="500" cy="500" r="462" fill="url(#jf-chrome-in)" />
        <circle cx="500" cy="500" r="438" fill="url(#jf-throat)" />
        <circle cx="500" cy="500" r="438" fill="none" stroke="rgba(255,255,255,.55)" strokeWidth="2" />
      </svg>
      {/* rotor: pás (duas cores que se alternam) + cone com a espiral */}
      <div className="jf-fan">
        <div className="jf-fan__a"><Fan id="jf-fa" tone="steel" /></div>
        <div className="jf-fan__b"><Fan id="jf-fb" tone="blue" /></div>
        <i className="jf-fan__blur" />
        <svg viewBox="0 0 1000 1000" className="jf-fan__svg">
          <defs>
            <radialGradient id="jf-spin" cx="460" cy="455" r="130" gradientUnits="userSpaceOnUse">
              <stop offset="0" stopColor="#4d6ea3" /><stop offset=".55" stopColor="#13264a" /><stop offset="1" stopColor="#050d1f" />
            </radialGradient>
          </defs>
          <circle cx="500" cy="500" r="108" fill="url(#jf-spin)" />
          <path d="M500 500 m0 -8 a18 18 0 1 1 -14 30 a40 40 0 0 1 10 -72 a66 66 0 0 1 72 46" fill="none" stroke="#f4f8ff" strokeWidth="9" strokeLinecap="round" />
          <circle cx="500" cy="500" r="108" fill="none" stroke="rgba(255,255,255,.25)" strokeWidth="2" />
        </svg>
      </div>
      {/* reflexo do lábio por cima do rotor */}
      <svg viewBox="0 0 1000 1000" className="jf-turbine__gloss">
        <defs>
          <linearGradient id="jf-gloss" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="rgba(255,255,255,.28)" /><stop offset=".45" stopColor="rgba(255,255,255,0)" /></linearGradient>
        </defs>
        <circle cx="500" cy="500" r="438" fill="url(#jf-gloss)" />
      </svg>
    </div>
  );
}

function Nose() {
  return (
    <svg viewBox="0 0 600 1000" className="jf-nose" aria-hidden="true">
      <defs>
        <linearGradient id="jf-skin" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#b8c3d2" /><stop offset=".16" stopColor="#e9eef5" /><stop offset=".34" stopColor="#ffffff" />
          <stop offset=".55" stopColor="#f3f6fa" /><stop offset=".72" stopColor="#ffffff" /><stop offset=".9" stopColor="#d5dde8" /><stop offset="1" stopColor="#aab6c6" />
        </linearGradient>
        <linearGradient id="jf-skin-v" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="rgba(150,168,192,.0)" /><stop offset=".8" stopColor="rgba(150,168,192,.0)" /><stop offset="1" stopColor="rgba(120,140,170,.35)" />
        </linearGradient>
        <linearGradient id="jf-glass" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3b5f94" /><stop offset=".4" stopColor="#13213a" /><stop offset="1" stopColor="#24395e" />
        </linearGradient>
        <linearGradient id="jf-glint" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="rgba(255,255,255,.0)" /><stop offset=".45" stopColor="rgba(255,255,255,.32)" /><stop offset=".6" stopColor="rgba(255,255,255,0)" />
        </linearGradient>
      </defs>
      {/* fuselagem vista de cima, nariz para baixo */}
      <path d="M84 0 L84 430 C84 724 188 934 300 964 C412 934 516 724 516 430 L516 0 Z" fill="url(#jf-skin)" />
      <path d="M84 0 L84 430 C84 724 188 934 300 964 C412 934 516 724 516 430 L516 0 Z" fill="url(#jf-skin-v)" />
      {/* para-brisa envolvente: painéis finos com moldura clara e reflexo do céu */}
      <path d="M134 612 C204 590 396 590 466 612 C460 650 446 682 428 708 C362 728 238 728 172 708 C154 682 140 650 134 612 Z" fill="url(#jf-glass)" />
      <path d="M134 612 C204 590 396 590 466 612 C460 650 446 682 428 708 C362 728 238 728 172 708 C154 682 140 650 134 612 Z" fill="none" stroke="#f1f4f8" strokeWidth="4" strokeLinejoin="round" />
      <path d="M300 596 L300 724 M206 598 C210 640 214 680 220 716 M394 598 C390 640 386 680 380 716" fill="none" stroke="#e8edf3" strokeWidth="5" strokeLinecap="round" />
      <path d="M146 620 C210 604 262 600 296 600 L296 636 C240 638 190 646 152 656 Z" fill="url(#jf-glint)" />
      <path d="M304 600 C340 600 392 604 454 620 L448 640 C400 630 350 626 304 626 Z" fill="rgba(170,205,255,.16)" />
      {/* linhas de painel, radome e antena */}
      <path d="M140 820 C214 872 386 872 460 820" fill="none" stroke="rgba(120,138,165,.32)" strokeWidth="2" />
      <path d="M100 360 L500 360" fill="none" stroke="rgba(120,138,165,.2)" strokeWidth="2" />
      <path d="M300 0 L300 560" fill="none" stroke="rgba(255,255,255,.65)" strokeWidth="3" />
      <rect x="292" y="300" width="16" height="34" rx="8" fill="#c3cddb" />
    </svg>
  );
}


const MEDIA = '/media/jet-finale';
function TurbineAsset() {
  const host = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const [mode, setMode] = useState<'video' | 'animated' | 'still'>('still');
  const [poster, setPoster] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [animated, setAnimated] = useState(false);
  const [awake, setAwake] = useState(false);
  useEffect(() => {
    const mq = matchMedia('(prefers-reduced-motion: reduce)');
    const safari = /^((?!chrome|android|crios|fxios).)*safari/i.test(navigator.userAgent);
    const choose = () => { setPlaying(false); setMode(mq.matches ? 'still' : safari ? 'animated' : 'video'); };
    choose(); mq.addEventListener('change', choose);
    const io = new IntersectionObserver(([e]) => setAwake(e.isIntersecting), { rootMargin: '100px' });
    if (host.current) io.observe(host.current);
    return () => { io.disconnect(); mq.removeEventListener('change', choose); };
  }, []);
  useEffect(() => {
    const v = video.current; if (!v || mode !== 'video') return;
    const sync = () => { if (awake && !document.hidden) v.play().catch(() => { if (!document.hidden) setMode('animated'); }); else v.pause(); };
    sync(); document.addEventListener('visibilitychange', sync);
    return () => { document.removeEventListener('visibilitychange', sync); v.pause(); };
  }, [awake, mode]);
  const real = poster || (mode === 'video' && playing) || (mode === 'animated' && animated);
  return (
    <div ref={host} className={'jf-media' + (real ? ' jf-media--real' : '')} aria-hidden="true">
      <div className="jf-media__legacy"><Turbine /></div>
      <img className={'jf-media__layer' + (poster ? ' is-ready' : '')} src={MEDIA + '/turbofan.png'} alt="" decoding="async" loading="lazy" onLoad={() => setPoster(true)} />
      {mode === 'video' && <video ref={video} className={'jf-media__layer' + (playing ? ' is-ready' : '')} src={MEDIA + '/turbofan.webm'} loop muted playsInline preload="none" onPlaying={() => setPlaying(true)} onError={() => { setPlaying(false); setMode('animated'); }} />}
      {mode === 'animated' && awake && <img className={'jf-media__layer' + (animated ? ' is-ready' : '')} src={MEDIA + '/turbofan-fallback.webp'} alt="" decoding="async" onLoad={() => setAnimated(true)} onError={() => setMode('still')} />}
      {real && <i className={'jf-media__tone' + ((playing || (mode === 'animated' && animated)) ? ' is-live' : '')} />}
    </div>
  );
}
function NoseAsset() {
  const [ready, setReady] = useState(false);
  return <div className={'jf-nose-media' + (ready ? ' is-ready' : '')} aria-hidden="true">
    {!ready && <Nose />}
    <img className="jf-nose-media__img" src={MEDIA + '/nose.png'} alt="" decoding="async" loading="lazy" onLoad={() => setReady(true)} />
  </div>;
}

export default function JetFinale() {
  const m = useM();
  const root = useRef<HTMLDivElement>(null);
  const credits = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = root.current; if (!el) return;
    const fan = el.querySelector<HTMLElement>('.jf-fan');
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    const clamp = (x: number) => Math.min(1, Math.max(0, x));
    const smooth = (a: number, b: number, x: number) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
    let raf = 0, visible = false, last = performance.now(), angle = 0, lastP = 0, vel = 0;
    const groups = [el.querySelector<HTMLElement>('.jf-a')!, el.querySelector<HTMLElement>('.jf-b')!];
    const tick = (now: number) => {
      raf = 0;
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      const vh = innerHeight, r = el.getBoundingClientRect();
      // 0 = a seção começa a entrar; ~0.24 = cena fixa; 1 = fim do rodapé
      const p = clamp((vh - r.top) / r.height);
      vel += ((p - lastP) / Math.max(dt, 0.001) - vel) * Math.min(1, dt * 6); lastP = p;
      const set = (k: string, v: number) => el.style.setProperty(k, v.toFixed(4));
      set('--jp', p);
      set('--rise', smooth(0.02, 0.24, p));      // turbina e cópia sobem com a seção
      set('--mist', smooth(0.10, 0.27, p));      // a nuvem chega antes do giro
      const spin = smooth(0.3, 0.5, p);
      set('--spin', spin);                        // pás trocam de cor ao acelerar
      set('--down', smooth(0.54, 0.72, p));      // turbina desce e sai
      set('--nose', smooth(0.60, 0.84, p));       // nariz entra de cima
      set('--foot', smooth(0.74, 0.9, p));       // rodapé aparece
      set('--copy-a', smooth(0.12, 0.26, p) * (1 - smooth(0.5, 0.6, p)));
      // giro: um pouco de vida parado, acelera com a fase e com a velocidade do scroll
      if (!reduced.matches) {
        const rps = 0.05 + spin * 1.2 + Math.min(2.4, Math.abs(vel) * 9);
        angle = (angle + rps * 360 * dt) % 360;
        if (fan) fan.style.transform = `rotate(${angle.toFixed(2)}deg)`;
        set('--blur', clamp((rps - 0.5) / 2));
      }
      // grupo invisível não recebe foco nem clique
      groups[0].style.visibility = Number(el.style.getPropertyValue('--copy-a')) < 0.02 ? 'hidden' : '';
      groups[1].style.visibility = Number(el.style.getPropertyValue('--foot')) < 0.02 ? 'hidden' : '';
      if (visible && !document.hidden) raf = requestAnimationFrame(tick);
    };
    const start = () => { if (!raf) { last = performance.now(); raf = requestAnimationFrame(tick); } };
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) start(); }, { rootMargin: '20% 0px' });
    io.observe(el);
    document.addEventListener('visibilitychange', start);
    tick(performance.now());
    return () => { io.disconnect(); cancelAnimationFrame(raf); document.removeEventListener('visibilitychange', start); };
  }, []);

  const wa = `https://wa.me/${CONTACT.whatsapp}?text=${encodeURIComponent(m.contact.waText)}`;
  const tag = m.footer.tagline.split(' ');
  const cut = Math.ceil(tag.length / 2);
  return (
    <div ref={root} id="planejar" className="jf">
      <span id="epilogo" className="jf__anchor" aria-hidden="true" />
      <div className="jf__stage">
        {/* palavras gigantes ao fundo (condensadas, quase transparentes) */}
        <p className="jf__giant jf__giant--a" aria-hidden="true">{m.nav.contato}</p>
        <p className="jf__giant jf__giant--b" aria-hidden="true">SimFly</p>

        <div className="jf__turbine-wrap"><TurbineAsset /></div>
        <div className="jf__mist" aria-hidden="true"><i /><i /><i /></div>
        <div className="jf__nose-wrap"><NoseAsset /></div>

        {/* 1 · contato */}
        <section className="jf-a" aria-labelledby="planejar-title">
          <p className="jf__eyebrow">{m.contact.presence}</p>
          <h2 id="planejar-title" className="jf__title" data-focus-target>
            <span>{m.contact.t1}</span> <span className="jf__soft">{m.contact.t2}</span>
          </h2>
          <p className="jf__lede">{m.contact.lede}</p>
          <div className="jf__actions">
            <a className="jf-btn jf-btn--solid" href={wa} target="_blank" rel="noopener noreferrer" onClick={() => track('contact_click', { from: 'finale-wa' })}>{m.contact.whatsapp}</a>
            <a className="jf-btn" href={`mailto:${CONTACT.email}`} onClick={() => track('contact_click', { from: 'finale-mail' })}>{CONTACT.email}</a>
          </div>
        </section>

        {/* 2 · rodapé */}
        <footer className="jf-b" aria-label="SimFly">
          <p className="jf__eyebrow">SimFly</p>
          <h2 className="jf__title jf__title--foot">
            <span>{tag.slice(0, cut).join(' ')}</span> <span className="jf__soft">{tag.slice(cut).join(' ')}</span>
          </h2>
          <p className="jf__lede">{m.footer.text}</p>
          <div className="jf__foot">
            <nav className="jf__links" aria-label="SimFly">
              <a href={`https://wa.me/${CONTACT.whatsapp}`} target="_blank" rel="noopener noreferrer">WhatsApp</a>
              <a href={`mailto:${CONTACT.email}`}>E-mail</a>
              <a href="https://www.instagram.com/simfly.br" target="_blank" rel="noopener noreferrer">Instagram</a>
              <button type="button" onClick={() => credits.current?.showModal()} aria-haspopup="dialog">{m.footer.credits}</button>
              <a href="#top" onClick={(e) => { e.preventDefault(); navigate('#top'); }}>{m.footer.top}</a>
            </nav>
            <p className="jf__rights">{m.footer.rights}<br /><small>{m.footer.disclaimer}</small></p>
          </div>
        </footer>
      </div>
      <dialog ref={credits} className="sheet" aria-labelledby="credits-t" onClick={(e) => { if (e.target === credits.current) credits.current?.close(); }}>
        <div className="sheet__body">
          <button type="button" className="icon-btn sheet__close" onClick={() => credits.current?.close()} autoFocus>{m.header.close}</button>
          <h2 id="credits-t">{m.footer.credits}</h2>
          <ul>{m.footer.creditsList.map((c) => <li key={c}>{c}</li>)}</ul>
        </div>
      </dialog>
    </div>
  );
}
