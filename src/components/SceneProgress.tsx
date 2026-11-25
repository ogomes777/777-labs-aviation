'use client';
import { CHAPTERS } from '@/content/site';
import { ui } from '@/experience/director';

/** Indicador discreto de capítulo (sem barras): número e nome da cena atual. */
export default function SceneProgress() {
  const active = ui.useStore((s) => s.activeChapter);
  const motion = ui.useStore((s) => s.motion);
  if (motion !== 'cinematic') return null;
  const c = CHAPTERS[active];
  const number = [1, 2, 4, 7, 4, 5, 6, 8, 9][active] ?? 1;
  return (
    <div className="scene-index" aria-live="off" role="status" aria-label={`Capítulo ${number} de ${CHAPTERS.length}: ${c.label}`}>
      <span className="scene-index__n">{String(number).padStart(2, '0')}</span>
      <span className="scene-index__l">{c.label}</span>
    </div>
  );
}
