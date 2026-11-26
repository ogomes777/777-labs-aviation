'use client';
import { useRef } from 'react';
import { CONTACT } from '@/content/fleet';
import { useM } from '@/i18n';
import { navigate } from './navigation';

/** Rodapé SimFly: marca, assinatura e contato. O globo 3D fica atrás (canvas), girável por arraste. */
export default function Epilogue() {
  const m = useM();
  const credits = useRef<HTMLDialogElement>(null);
  return (
    <div className="sf-foot">
      <h2 className="sf-foot__mark" aria-label="SimFly"><span>SIM</span><span>FLY</span></h2>
      <p className="sf-foot__tag">{m.footer.tagline}</p>
      <div className="sf-foot__row">
        <p className="sf-foot__text">{m.footer.text}<br /><small>{m.footer.disclaimer}</small></p>
        <nav className="sf-foot__links" aria-label="SimFly">
          <a href={`https://wa.me/${CONTACT.whatsapp}`} target="_blank" rel="noopener noreferrer">WhatsApp</a>
          <a href={`mailto:${CONTACT.email}`}>E-mail</a>
          <a href="https://www.instagram.com/simfly.br" target="_blank" rel="noopener noreferrer">Instagram</a>
          <button type="button" onClick={() => credits.current?.showModal()} aria-haspopup="dialog">{m.footer.credits}</button>
          <a href="#top" onClick={(e) => { e.preventDefault(); navigate('#top'); }}>{m.footer.top}</a>
        </nav>
      </div>
      <p className="sf-foot__rights">{m.footer.rights}</p>
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
