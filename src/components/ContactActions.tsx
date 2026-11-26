'use client';
import { CONTACT } from '@/content/fleet';
import { useM } from '@/i18n';

/** Contato direto com a SimFly: mensagem pré-preenchida, nada é enviado automaticamente. */
export default function ContactActions() {
  const m = useM();
  const wa = `https://wa.me/${CONTACT.whatsapp}?text=${encodeURIComponent(m.contact.waText)}`;
  return (
    <div className="contact-actions">
      <a className="sf-btn sf-btn--solid" href={wa} target="_blank" rel="noopener noreferrer">{m.contact.whatsapp}</a>
      <a className="sf-btn" href={`mailto:${CONTACT.email}`}>{CONTACT.email}</a>
      <span className="sf-presence">{m.contact.presence}</span>
    </div>
  );
}
