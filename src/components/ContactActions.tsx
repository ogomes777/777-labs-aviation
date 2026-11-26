import { CONTACT } from '@/content/fleet';

/** Contato direto com a SimFly (substitui o formulário de viagem): mensagem pré-preenchida, nada é enviado automaticamente. */
export default function ContactActions() {
  const wa = `https://wa.me/${CONTACT.whatsapp}?text=${encodeURIComponent('Olá! Gostaria de falar com a SimFly sobre as aeronaves do portfólio.')}`;
  return (
    <div className="contact-actions">
      <a className="btn btn--solid" href={wa} target="_blank" rel="noopener noreferrer">Falar no WhatsApp</a>
      <a className="btn btn--ghost" href={`mailto:${CONTACT.email}`}>{CONTACT.email}</a>
    </div>
  );
}
