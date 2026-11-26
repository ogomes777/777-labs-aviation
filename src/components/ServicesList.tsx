'use client';
import { useM } from '@/i18n';

const ORDER = ['sell', 'buy', 'broker', 'search'] as const;

/** Os quatro serviços da SimFly: entre partir (vender) e chegar (comprar). */
export default function ServicesList() {
  const m = useM();
  return (
    <ul className="sf-services">
      {ORDER.map((k, i) => (
        <li key={k} style={{ ['--i' as string]: i } as React.CSSProperties}>
          <strong>{m.services.items[k].t}</strong>
          <span>{m.services.items[k].d}</span>
        </li>
      ))}
    </ul>
  );
}
