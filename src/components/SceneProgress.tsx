'use client';
import { CHAPTERS } from '@/content/site';
import { ui } from '@/experience/director';

/** Indicador discreto de capítulo (sem barras): número e nome da cena atual. */
export default function SceneProgress() {
  const active = ui.useStore((s) => s.activeChapter);
  const motion = ui.useStore((s) => s.motion);
  if (motion !== 'cinematic') return null;
  const c = CHAPTERS[active];
  return (
    <div className="scene-index" aria-live="off" role="status" aria-label={`Capítulo ${active + 1} de ${CHAPTERS.length}: ${c.label}`}>
      <span className="scene-index__n">{String(active + 1).padStart(2, '0')}</span>
      <span className="scene-index__l">{c.label}</span>
    </div>
  );
}
