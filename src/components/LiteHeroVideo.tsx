'use client';
import { ui } from '@/experience/director';

/** Modo Leve: loop de nuvens renderizado da própria cena (sem WebGL, poupa GPU). Nunca com som. */
export default function LiteHeroVideo() {
  const motion = ui.useStore((s) => s.motion);
  if (motion !== 'lite') return null;
  return (
    <video className="lite-video" autoPlay muted loop playsInline preload="metadata" poster="/media/poster-desktop.webp" aria-hidden="true">
      <source media="(max-aspect-ratio: 4/5)" src="/media/hero-mobile.webm" type="video/webm" />
      <source media="(max-aspect-ratio: 4/5)" src="/media/hero-mobile.mp4" type="video/mp4" />
      <source src="/media/hero-desktop.webm" type="video/webm" />
      <source src="/media/hero-desktop.mp4" type="video/mp4" />
    </video>
  );
}
