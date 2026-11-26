'use client';
import { useEffect, useRef, useState } from 'react';
import { ui, type MotionMode } from '@/experience/director';
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
  const [langs, setLangs] = useState(false);
  const menuRef = useRef<HTMLDialogElement>(null);
  const menuBtn = useRef<HTMLButtonElement>(null);
  const langRef = useRef<HTMLDivElement>(null);
  const langBtn = useRef<HTMLButtonElement>(null);

  useEffect(() => { initPrefs(); }, []);
  useEffect(() => {
    const d = menuRef.current; if (!d) return;
    const lenis = nav.lenis as unknown as { stop?: () => void; start?: () => void } | null;
    if (menu && !d.open) { d.showModal(); lenis?.stop?.(); document.documentElement.style.overflow = 'hidden'; }
    if (!menu && d.open) { d.close(); }
    if (!menu) { lenis?.start?.(); document.documentElement.style.overflow = ''; }
  }, [menu]);
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
    <header className="sfh" data-solid={motion !== 'cinematic' ? 'true' : 'false'}>
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
            <span className="sfh__more-code">{lang.toUpperCase()}</span><i aria-hidden="true" />
          </button>
        </div>

        <a href="#top" className="sfh__brand" onClick={(e) => go(e, '#top')} aria-label={m.meta.home}>
          <span className="sfh__logo3d"><SimFlyLogo className="sfh__logo" gradient /></span>
          <span className="sfh__orbit" aria-hidden="true"><span className="sfh__jet"><img src="/media/simfly-plane-cutout.png" alt="" width={84} height={26} decoding="async" /></span></span>
        </a>

        <div className="sfh__right">
          <a className="sfh__wa" href={wa} target="_blank" rel="noopener noreferrer" aria-label={m.header.contact} title={m.header.contact} onClick={() => track('contact_click', { from: 'header-wa' })}>
            <svg viewBox="0 0 32 32" aria-hidden="true"><path d="M28.5 4.2 3.6 14.1c-.8.3-.8 1.4 0 1.7l7.3 2.7 2.7 8.2c.3.8 1.3.9 1.8.2l3.6-4.9 6.6 4.8c.6.4 1.4.1 1.6-.6l3.7-20.6c.2-.9-.6-1.6-1.4-1.4Z" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" /><path d="m10.9 18.5 13.4-9.6-9.5 11.6-1.2 5.9" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" strokeLinecap="round" /></svg>
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

      <dialog ref={menuRef} className="sfm" aria-label={m.header.menu} onClose={() => { setMenu(false); menuBtn.current?.focus(); }} onCancel={() => setMenu(false)}
        onClick={(e) => { if (e.target === menuRef.current) setMenu(false); }}>
        {menu && <MenuSky />}
        <div className="sfm__inner">
          <div className="sfm__top">
            <span />
            <button type="button" className="sfh__burger sfh__burger--x" onClick={() => setMenu(false)} autoFocus aria-label={m.header.close}><i /><i /></button>
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
