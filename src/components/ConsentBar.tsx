'use client';
import { useEffect, useState } from 'react';
import { consentDecided, hasConsent, loadGA, setConsent } from '@/lib/analytics';

/** Só aparece se houver GA configurado. Sem consentimento, nenhum script de terceiros é carregado. */
export default function ConsentBar() {
  const id = process.env.NEXT_PUBLIC_GA_ID;
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (!id) return;
    if (hasConsent()) loadGA(id);
    else if (!consentDecided()) setShow(true);
  }, [id]);
  if (!id || !show) return null;
  return (
    <div className="consent-bar" role="region" aria-label="Consentimento de análise">
      <p style={{ margin: 0 }}>Usamos medição anônima de uso (sem dados pessoais do formulário) apenas se você permitir.</p>
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="button" className="btn btn--solid btn--small" onClick={() => { setConsent('granted'); loadGA(id); setShow(false); }}>Permitir</button>
        <button type="button" className="btn btn--ghost btn--small" onClick={() => { setConsent('denied'); setShow(false); }}>Recusar</button>
      </div>
    </div>
  );
}
