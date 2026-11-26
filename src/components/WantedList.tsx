'use client';
import { CONTACT } from '@/content/fleet';
import { fmt, useM } from '@/i18n';
import { track } from '@/lib/analytics';

const ORDER = ['r66', 'c90', 'sovereign'] as const;

/** "Procuramos": aeronaves que clientes da SimFly buscam (dados do site comercial). */
export default function WantedList() {
  const m = useM();
  return (
    <ul className="sf-wanted__list">
      {ORDER.map((k) => {
        const it = m.wanted.items[k];
        const href = `https://wa.me/${CONTACT.whatsapp}?text=${encodeURIComponent(fmt(m.wanted.waText, { name: it.name }))}`;
        return (
          <li key={k} className="sf-wanted__item">
            <span className="sf-wanted__kind">{it.kind}</span>
            <h3>{it.name}</h3>
            <p className="sf-wanted__line">{it.line}</p>
            <p className="sf-wanted__note">{it.note}</p>
            <a href={href} target="_blank" rel="noopener noreferrer" onClick={() => track('wanted_click', { model: k })}>{m.wanted.cta}</a>
          </li>
        );
      })}
    </ul>
  );
}
