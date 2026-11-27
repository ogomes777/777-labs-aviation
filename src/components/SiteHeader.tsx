'use client';
import { useEffect, useRef, useState } from 'react';
import { frame, ui, type MotionMode } from '@/experience/director';
import { writeMotionPreference } from '@/experience/quality';
import { nav, navigate } from './navigation';
import { track } from '@/lib/analytics';
import { CONTACT } from '@/content/fleet';
import SimFlyLogo from './SimFlyLogo';
import MenuSky from './MenuSky';
import { LANGS, initPrefs, setLang, setTheme, useLang, useM, useTheme, type Lang } from '@/i18n';

const SECTIONS = ['sobre', 'servicos', 'portfolio', 'procuramos', 'contato'] as const;
const INLINE: Lang[] = ['pt', 'en', 'es'];

/**
 * Header V7 — cápsula de vidro (Apple-like): tema + idioma à esquerda, marca SimFly ao centro
 * (com o jato da marca cruzando a barra, minúsculo), contato + menu à direita.
 */
export default function SiteHeader() {
  const m = useM();
  const lang = useLang();
  const theme = useTheme();
  const motion = ui.useStore((s) => s.motion);
  const webgl = ui.useStore((s) => s.webgl);
  const active = ui.useStore((s) => s.activeChapter);
  const [menu, setMenu] = useState(false);
  const [closing, setClosing] = useState(false);
  const [langs, setLangs] = useState(false);
  const menuRef = useRef<HTMLDialogElement>(null);
  const menuBtn = useRef<HTMLButtonElement>(null);
  const closeBtn = useRef<HTMLButtonElement>(null);
  const langRef = useRef<HTMLDivElement>(null);
  const langBtn = useRef<HTMLButtonElement>(null);

  useEffect(() => { initPrefs(); }, []);
  // tom do vidro pela cena que está de fato atrás do header (claro: Sobre, anatomia, serviços, cabine; escuro: o resto)
  const [tone, setTone] = useState<'dark' | 'light'>('dark');
  useEffect(() => {
    const d = document.documentElement;
    const decide = () => {
      const zone = d.dataset.simflyZone;
      const ch = ui.get().activeChapter;
      const sky = ch === 6 && frame.t > 5.86; // a câmera sai pela janela: céu azul atrás
      const light = d.dataset.skyTone === 'light' || zone === 'aircraft' || (!zone && (ch === 4 || ch === 5 || (ch === 6 && !sky)));
      setTone(light ? 'light' : 'dark');
    };
    const mo = new MutationObserver(decide);
    mo.observe(d, { attributes: true, attributeFilter: ['data-simfly-zone', 'data-sky-tone'] });
    const un = ui.subscribe(decide);
    let raf = 0; const onScroll = () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; decide(); }); };
    addEventListener('scroll', onScroll, { passive: true });
    decide();
    return () => { mo.disconnect(); un(); removeEventListener('scroll', onScroll); cancelAnimationFrame(raf); };
  }, []);
  useEffect(() => {
    const d = menuRef.current; if (!d) return;
    const lenis = nav.lenis as unknown as { stop?: () => void; start?: () => void } | null;
    if (menu && !d.open) { d.showModal(); lenis?.stop?.(); document.documentElement.style.overflow = 'hidden'; }
    if (!menu && d.open) { d.close(); }
    if (!menu) { lenis?.start?.(); document.documentElement.style.overflow = ''; }
  }, [menu]);
  useEffect(() => {
    if (!closing) return;
    if (!menu) { setClosing(false); return; }
    const timer = window.setTimeout(() => { setMenu(false); setClosing(false); }, 240);
    return () => window.clearTimeout(timer);
  }, [closing, menu]);
  const clearTouchSpin = () => { if (closeBtn.current) delete closeBtn.current.dataset.touchSpin; };
  const trackTouchSpin = (e: React.PointerEvent<HTMLDialogElement>) => {
    if (e.pointerType !== 'touch' || !closeBtn.current || closing) return;
    const b = closeBtn.current;
    const r = b.getBoundingClientRect();
    const inside = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
    if (inside) { if (!b.dataset.touchSpin) b.dataset.touchSpin = 'true'; }
    else if (b.dataset.touchSpin) delete b.dataset.touchSpin;
  };
  const closeWithSpin = () => {
    if (closing) return;
    if (motion === 'reduced' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setMenu(false); return; }
    setClosing(true);
  };
  useEffect(() => {
    if (!langs) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { setLangs(false); langBtn.current?.focus(); } };
    const onDown = (e: PointerEvent) => { if (!langRef.current?.contains(e.target as Node) && !langBtn.current?.contains(e.target as Node)) setLangs(false); };
    window.addEventListener('keydown', onKey); window.addEventListener('pointerdown', onDown);
    langRef.current?.querySelector<HTMLButtonElement>('[aria-checked="true"]')?.focus();
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('pointerdown', onDown); };
  }, [langs]);

  const go = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    e.preventDefault();
    const wasOpen = menu;
    setMenu(false);
    if (href === '#contato') track('contact_click', { from: 'header' });
    window.setTimeout(() => navigate(href), wasOpen ? 80 : 0);
  };
  const setMode = (mode: MotionMode) => {
    writeMotionPreference(mode); track('motion_mode', { mode });
    const url = new URL(location.href); url.searchParams.delete('motion'); location.replace(url.toString());
  };
  const chooseLang = (l: Lang) => { setLangs(false); void setLang(l); track('lang', { lang: l }); };
  // capítulo ativo → seção do menu
  const current = ({ 1: 'sobre', 4: 'sobre', 5: 'servicos', 6: 'servicos', 3: 'portfolio', 7: 'procuramos', 8: 'contato' } as Record<number, string>)[active];
  const wa = `https://wa.me/${CONTACT.whatsapp}?text=${encodeURIComponent(m.contact.waText)}`;
  const inline = INLINE.includes(lang) ? INLINE : [lang, ...INLINE.slice(0, 2)];

  return (
    <header className="sfh" data-tone={tone} data-solid={motion !== 'cinematic' ? 'true' : 'false'}>
      <div className="sfh__bar">
        <div className="sfh__left">
          <div className="sfh__theme" role="radiogroup" aria-label={m.header.theme}>
            <button type="button" role="radio" aria-checked={theme === 'sky'} aria-label={m.header.themeSky} className="sfh__dot sfh__dot--sky" onClick={() => setTheme('sky')} />
            <button type="button" role="radio" aria-checked={theme === 'dusk'} aria-label={m.header.themeDusk} className="sfh__dot sfh__dot--dusk" onClick={() => setTheme('dusk')} />
          </div>
          <div className="sfh__langs" role="radiogroup" aria-label={m.header.language}>
            {inline.map((l) => (
              <button key={l} type="button" role="radio" aria-checked={lang === l} lang={LANGS.find((x) => x.code === l)!.html} className="sfh__lang" onClick={() => chooseLang(l)}>{l.toUpperCase()}</button>
            ))}
          </div>
          <button ref={langBtn} type="button" className="sfh__more" aria-expanded={langs} aria-controls="sfh-langs" aria-label={m.header.language} onClick={() => setLangs((v) => !v)}>
            <i aria-hidden="true" />
          </button>
        </div>

        <a href="#top" className="sfh__brand" onClick={(e) => go(e, '#top')} aria-label={m.meta.home}>
          <span className="sfh__logo3d"><SimFlyLogo className="sfh__logo" gradient /></span>
        </a>

        <div className="sfh__right">
          <a className="sfh__wa" href={wa} target="_blank" rel="noopener noreferrer" aria-label={m.header.contact} title={m.header.contact} onClick={() => track('contact_click', { from: 'header-wa' })}>
            <svg viewBox="0 0 32 32" aria-hidden="true"><rect x="4" y="7.5" width="24" height="17" rx="2.6" fill="none" stroke="currentColor" strokeWidth="1.4" /><path d="m5 9 11 8.2L27 9" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" strokeLinecap="round" /></svg>
          </a>
          <button ref={menuBtn} type="button" className="sfh__burger" aria-haspopup="dialog" aria-expanded={menu} aria-label={m.header.menu} onClick={() => setMenu(true)}><i /><i /></button>
        </div>
      </div>

      {langs && (
        <div ref={langRef} id="sfh-langs" className="sfh__pop" role="radiogroup" aria-label={m.header.language}>
          {LANGS.map((l) => (
            <button key={l.code} type="button" role="radio" aria-checked={lang === l.code} lang={l.html} onClick={() => chooseLang(l.code)}>
              <span>{l.name}</span><small>{l.label}</small>
            </button>
          ))}
        </div>
      )}

      <dialog ref={menuRef} className="sfm" aria-label={m.header.menu} onClose={() => { clearTouchSpin(); setMenu(false); setClosing(false); menuBtn.current?.focus(); }} onCancel={() => setMenu(false)}
        onPointerDownCapture={trackTouchSpin} onPointerMoveCapture={trackTouchSpin}
        onPointerUpCapture={clearTouchSpin} onPointerCancelCapture={clearTouchSpin}
        onClick={(e) => { if (e.target === menuRef.current) setMenu(false); }}>
        {menu && <MenuSky />}
        <div className="sfm__inner">
          <div className="sfm__top">
            <span />
            <button ref={closeBtn} type="button" className="sfh__burger sfh__burger--x" data-closing={closing ? 'true' : undefined} onClick={closeWithSpin} autoFocus aria-label={m.header.close}><span className="sfm__close-glyph" aria-hidden="true"><i /><i /></span></button>
          </div>
          <nav className="sfm__nav" aria-label={m.header.nav}>
            {SECTIONS.map((s, i) => (
              <a key={s} href={`#${s}`} onClick={(e) => go(e, `#${s}`)} aria-current={current === s ? 'true' : undefined} style={{ ['--i' as string]: i } as React.CSSProperties}
                onTouchStart={(e) => { const a = e.currentTarget; a.dataset.roll = 'true'; window.setTimeout(() => { delete a.dataset.roll; }, 900); }}>
                <span className="sfm__dice"><span>{m.nav[s]}</span><span aria-hidden="true">{m.nav[s]}</span></span>
              </a>
            ))}
          </nav>
          <div className="sfm__foot">
            <div className="sfm__langs" role="radiogroup" aria-label={m.header.language}>
              {LANGS.map((l) => <button key={l.code} type="button" role="radio" aria-checked={lang === l.code} lang={l.html} onClick={() => chooseLang(l.code)}>{l.name}</button>)}
            </div>
            <div className="sfm__motion" role="radiogroup" aria-label={m.header.motionPrefs}>
              {(['cinematic', 'lite', 'reduced'] as MotionMode[]).map((id) => (
                <button key={id} type="button" role="radio" aria-checked={motion === id} disabled={id === 'cinematic' && !webgl} title={id === 'cinematic' && !webgl ? m.header.modes.webglOff : m.header.modes[`${id}Hint` as const]} onClick={() => motion !== id && setMode(id)}>{m.header.modes[id]}</button>
              ))}
            </div>
          </div>
        </div>
      </dialog>
    </header>
  );
}
