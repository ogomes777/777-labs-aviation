'use client';
import { useEffect, useRef, useState } from 'react';
import { NAV } from '@/content/site';
import { ui, type MotionMode } from '@/experience/director';
import { writeMotionPreference } from '@/experience/quality';
import { navigate } from './navigation';
import { track } from '@/lib/analytics';

const MODES: { id: MotionMode; label: string; hint: string }[] = [
  { id: 'cinematic', label: 'Cinemático', hint: '3D em tempo real e câmera guiada pelo scroll.' },
  { id: 'lite', label: 'Leve', hint: 'Imagens renderizadas da mesma cena, sem WebGL.' },
  { id: 'reduced', label: 'Movimento reduzido', hint: 'Sem animações; todo o conteúdo e o formulário mantidos.' },
];

export default function SiteHeader() {
  const motion = ui.useStore((s) => s.motion);
  const webgl = ui.useStore((s) => s.webgl);
  const active = ui.useStore((s) => s.activeChapter);
  const [menu, setMenu] = useState(false);
  const [pop, setPop] = useState(false);
  const menuRef = useRef<HTMLDialogElement>(null);
  const menuBtn = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const popBtn = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const d = menuRef.current;
    if (!d) return;
    if (menu && !d.open) d.showModal();
    if (!menu && d.open) d.close();
  }, [menu]);
  useEffect(() => {
    if (!pop) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { setPop(false); popBtn.current?.focus(); } };
    const onDown = (e: PointerEvent) => { if (!popRef.current?.contains(e.target as Node) && e.target !== popBtn.current) setPop(false); };
    window.addEventListener('keydown', onKey);
    window.addEventListener('pointerdown', onDown);
    popRef.current?.querySelector<HTMLInputElement>('input:checked')?.focus();
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('pointerdown', onDown); };
  }, [pop]);

  const go = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    e.preventDefault();
    setMenu(false);
    if (href === '#planejar') track('contact_click', { from: 'header' });
    window.setTimeout(() => navigate(href), menu ? 60 : 0);
  };
  const setMode = (m: MotionMode) => {
    writeMotionPreference(m);
    track('motion_mode', { mode: m });
    // troca de modo recarrega a página para reconstruir layout/cenas de forma limpa
    const url = new URL(location.href);
    url.searchParams.delete('motion');
    location.replace(url.toString());
    ui.set({ motion: m });
  };
  const currentSection = ['', '', 'aeronave', 'frota', 'aeronave', 'experiencia', 'experiencia', 'destinos', 'planejar'][active];

  return (
    <header className="site-header" data-solid={motion !== 'cinematic' ? 'true' : 'false'}>
      <a href="#top" className="wordmark" onClick={(e) => go(e, '#top')} aria-label="777 Labs Aviation — voltar ao início">
        <b>777</b>
        <span>Labs Aviation</span>
      </a>
      <nav className="nav" aria-label="Navegação principal">
        {NAV.map((n) => (
          <a key={n.href} href={n.href} onClick={(e) => go(e, n.href)} aria-current={currentSection === n.href.slice(1) ? 'true' : undefined}>{n.label}</a>
        ))}
      </nav>
      <div className="header-actions">
        <button ref={popBtn} type="button" className="icon-btn" aria-expanded={pop} aria-controls="motion-pop" onClick={() => setPop((v) => !v)}>
          <span className="sr-only">Preferências de </span>Movimento
        </button>
        <a href="#planejar" className="btn btn--solid btn--small" onClick={(e) => go(e, '#planejar')}>Planejar jornada</a>
        <button ref={menuBtn} type="button" className="icon-btn menu-btn" aria-haspopup="dialog" aria-expanded={menu} onClick={() => setMenu(true)}>Menu</button>
      </div>
      {pop && (
        <div ref={popRef} id="motion-pop" className="motion-pop" role="group" aria-label="Preferências de movimento">
          {MODES.map((m) => (
            <label key={m.id}>
              <input type="radio" name="motion" value={m.id} checked={motion === m.id} disabled={m.id === 'cinematic' && !webgl} onChange={() => setMode(m.id)} />
              <span>{m.label}<small>{m.id === 'cinematic' && !webgl ? 'Indisponível: WebGL2 não suportado neste navegador.' : m.hint}</small></span>
            </label>
          ))}
        </div>
      )}
      <dialog ref={menuRef} className="sheet menu" aria-label="Menu" onClose={() => { setMenu(false); menuBtn.current?.focus(); }} onCancel={() => setMenu(false)}>
        <div style={{ position: 'absolute', top: 16, right: 16 }}>
          <button type="button" className="icon-btn" onClick={() => setMenu(false)} autoFocus>Fechar</button>
        </div>
        <nav className="menu__nav" aria-label="Navegação do menu">
          {NAV.map((n) => <a key={n.href} href={n.href} onClick={(e) => go(e, n.href)}>{n.label}</a>)}
          <a href="#planejar" onClick={(e) => go(e, '#planejar')}><em>Planejar jornada</em></a>
        </nav>
      </dialog>
    </header>
  );
}
