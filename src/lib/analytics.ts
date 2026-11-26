/**
 * Instrumentação com consentimento e SEM PII.
 * - Sem NEXT_PUBLIC_GA_ID: eventos ficam apenas em window.__777events (QA local), nada sai do navegador.
 * - Com GA_ID: gtag só é carregado após consentimento explícito (ConsentBar).
 */
export type EventName =
  | 'hero_view' | 'aircraft_explore_start' | 'aircraft_variant' | 'anatomy_part' | 'gallery_card_view'
  | 'destinations_interact' | 'destination_use' | 'quote_form_start' | 'quote_form_validation_error'
  | 'quote_form_submit' | 'quote_form_success' | 'quote_form_demo' | 'contact_click' | 'motion_mode'
  | 'fleet_system' | 'fleet_quote' | 'preview_open' | 'lang' | 'theme' | 'wanted_click' | 'flight_start' | 'flight_exit';

type Params = Record<string, string | number | boolean | undefined>;
declare global {
  interface Window { __777events?: { name: EventName; params?: Params; at: number }[]; gtag?: (...a: unknown[]) => void; dataLayer?: unknown[] }
}

const PII_KEYS = /name|email|phone|tel|message|nome|contato/i;

export function track(name: EventName, params?: Params) {
  if (typeof window === 'undefined') return;
  const safe: Params = {};
  for (const [k, v] of Object.entries(params ?? {})) if (!PII_KEYS.test(k)) safe[k] = v;
  (window.__777events ??= []).push({ name, params: safe, at: Math.round(performance.now()) });
  if (window.gtag && hasConsent()) window.gtag('event', name, safe);
}

const CONSENT_KEY = '777:consent';
export function hasConsent(): boolean { try { return localStorage.getItem(CONSENT_KEY) === 'granted'; } catch { return false; } }
export function setConsent(v: 'granted' | 'denied') { try { localStorage.setItem(CONSENT_KEY, v); } catch { /* noop */ } }
export function consentDecided(): boolean { try { return localStorage.getItem(CONSENT_KEY) !== null; } catch { return true; } }

export function loadGA(id: string) {
  if (typeof window === 'undefined' || window.gtag || !/^G-[A-Z0-9]+$/.test(id)) return;
  const s = document.createElement('script');
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${id}`;
  document.head.appendChild(s);
  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag() { window.dataLayer!.push(arguments); };
  window.gtag('js', new Date());
  window.gtag('config', id, { anonymize_ip: true, send_page_view: true });
}
