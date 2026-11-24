'use client';
import { useRef } from 'react';
import { BRAND } from '@/content/site';
import { navigate } from './navigation';

function Sheet({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  return (
    <>
      <button type="button" className="btn btn--ghost btn--small" aria-haspopup="dialog" onClick={() => ref.current?.showModal()}>{title}</button>
      <dialog ref={ref} id={id} className="sheet" aria-labelledby={`${id}-t`} onClick={(e) => { if (e.target === ref.current) ref.current?.close(); }}>
        <div className="sheet__body">
          <button type="button" className="icon-btn sheet__close" onClick={() => ref.current?.close()} autoFocus>Fechar</button>
          <h2 id={`${id}-t`}>{title}</h2>
          {children}
        </div>
      </dialog>
    </>
  );
}

export default function Epilogue() {
  const markRef = useRef<HTMLHeadingElement>(null);
  const set77 = process.env.NEXT_PUBLIC_SET77_URL;
  const onMove = (e: React.PointerEvent) => {
    const el = markRef.current; if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty('--lx', `${((e.clientX - r.left) / r.width) * 100}%`);
    el.style.setProperty('--ly', `${((e.clientY - r.top) / r.height) * 100}%`);
  };
  return (
    <div onPointerMove={onMove} style={{ display: 'grid' }}>
      <p className="micro epilogue__by">Concept by SET77 Labs</p>
      <h2 ref={markRef} className="epilogue__mark" aria-label={BRAND.name}>777 LABS<br />AVIATION</h2>
      <div className="epilogue__row">
        <p className="epilogue__disclaimer">{BRAND.disclaimer}</p>
        <div className="footer-links">
          <Sheet id="about" title="Sobre este case">
            <p>Uma demonstração da SET77 Labs de como uma marca de aviação executiva pode ser apresentada como um filme interativo: céu, aeronave, cabine, destinos e conversa — numa única câmera contínua, com formulário funcional e acessível.</p>
            <ul>
              <li>Next.js + TypeScript, GSAP ScrollTrigger, Three.js / React Three Fiber.</li>
              <li>Aeronave e cabine modeladas por código (geometria paramétrica original), sem modelos de fabricantes.</li>
              <li>Modos Cinemático, Leve e Movimento reduzido; funciona sem WebGL.</li>
            </ul>
            {set77 ? <p><a className="btn btn--solid btn--small" href={set77} target="_blank" rel="noopener noreferrer">Conhecer a SET77 Labs</a></p> : <p>Para apresentar este conceito à sua marca, use o formulário desta página.</p>}
          </Sheet>
          <Sheet id="credits" title="Créditos e licenças">
            <ul>
              <li>Tipografia: Bodoni Moda e Manrope — SIL Open Font License 1.1 (auto-hospedadas).</li>
              <li>Contornos de terra do globo: Natural Earth 110m (domínio público), via world-atlas (ISC).</li>
              <li>Bibliotecas: three.js, React Three Fiber, drei (MIT); GSAP (licença padrão GreenSock, uso gratuito); Lenis (MIT); Zod (MIT); Next.js (MIT).</li>
              <li>Céu, nuvens, aeronave, cabine, texturas e todas as imagens/vídeos: gerados por este projeto.</li>
              <li>Nenhuma mídia, marca ou código das referências estudadas foi incorporado.</li>
            </ul>
          </Sheet>
          <a href="#top" className="btn btn--ghost btn--small" onClick={(e) => { e.preventDefault(); navigate('#top'); }}>Voltar ao topo</a>
        </div>
      </div>
      <p className="micro" style={{ marginTop: 14 }}>© 2026 SET77 Labs. Showroom conceitual, sem operação de voos.</p>
    </div>
  );
}
