'use client';
import { createStore } from '@/experience/store';
import pt, { type Messages } from './messages/pt';

/**
 * Preferências do visitante: idioma e tema. Troca AO VIVO (sem recarregar a página).
 * O SSR sempre entrega pt-BR; o idioma salvo/detectado é aplicado após a hidratação.
 * Catálogos das outras línguas são carregados sob demanda (code-splitting) e mesclados sobre o pt.
 */
export const LANGS = [
  { code: 'pt', label: 'PT', name: 'Português', html: 'pt-BR' },
  { code: 'en', label: 'EN', name: 'English', html: 'en' },
  { code: 'es', label: 'ES', name: 'Español', html: 'es' },
  { code: 'it', label: 'IT', name: 'Italiano', html: 'it' },
  { code: 'fr', label: 'FR', name: 'Français', html: 'fr' },
  { code: 'de', label: 'DE', name: 'Deutsch', html: 'de' },
  { code: 'ja', label: 'JA', name: '日本語', html: 'ja' },
  { code: 'zh', label: 'ZH', name: '中文', html: 'zh-Hans' },
  { code: 'ko', label: 'KO', name: '한국어', html: 'ko' },
] as const;
export type Lang = (typeof LANGS)[number]['code'];
export type Theme = 'sky' | 'dusk';

const loaders: Record<Exclude<Lang, 'pt'>, () => Promise<{ default: Messages }>> = {
  en: () => import('./messages/en'),
  es: () => import('./messages/es'),
  it: () => import('./messages/it'),
  fr: () => import('./messages/fr'),
  de: () => import('./messages/de'),
  ja: () => import('./messages/ja'),
  zh: () => import('./messages/zh'),
  ko: () => import('./messages/ko'),
};

export const prefs = createStore<{ lang: Lang; theme: Theme; m: Messages }>({ lang: 'pt', theme: 'sky', m: pt });

const cache = new Map<Lang, Messages>([['pt', pt]]);
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
function merge<T>(base: T, over: unknown): T {
  if (!isObj(base) || !isObj(over)) return (over ?? base) as T;
  const out: Record<string, unknown> = { ...base };
  for (const k of Object.keys(base)) if (k in over) out[k] = merge((base as Record<string, unknown>)[k], over[k]);
  return out as T;
}

const valid = (l: string | null | undefined): l is Lang => !!l && LANGS.some((x) => x.code === l);

export async function setLang(lang: Lang) {
  if (!valid(lang)) return;
  let m = cache.get(lang);
  if (!m) {
    try { m = merge(pt, (await loaders[lang as Exclude<Lang, 'pt'>]()).default); cache.set(lang, m); }
    catch { return; }
  }
  const d = document.documentElement;
  d.lang = LANGS.find((x) => x.code === lang)!.html;
  d.dataset.lang = lang;
  try { localStorage.setItem('simfly:lang', lang); } catch {}
  prefs.set({ lang, m });
  // reposiciona gatilhos de scroll após o texto mudar de comprimento
  requestAnimationFrame(() => (window as unknown as { __777recompute?: () => void }).__777recompute?.());
  window.dispatchEvent(new CustomEvent('simfly:lang', { detail: lang }));
}

export function setTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  try { localStorage.setItem('simfly:theme', theme); } catch {}
  prefs.set({ theme });
  window.dispatchEvent(new CustomEvent('simfly:theme', { detail: theme }));
}

/** Chamado uma vez no cliente: aplica o que o script de boot já decidiu no <html>. */
export function initPrefs() {
  const d = document.documentElement;
  const theme = d.dataset.theme === 'dusk' ? 'dusk' : 'sky';
  if (theme !== prefs.get().theme) prefs.set({ theme });
  const lang = d.dataset.lang;
  if (valid(lang) && lang !== 'pt') void setLang(lang);
}

export const useM = () => prefs.useStore((s) => s.m);
export const useLang = () => prefs.useStore((s) => s.lang);
export const useTheme = () => prefs.useStore((s) => s.theme);

/** Interpolação simples de {chaves}. */
export const fmt = (s: string, vars: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (_, k) => (k in vars ? String(vars[k]) : `{${k}}`));
/** Leitura não reativa (para loops/handlers). */
export const getM = () => prefs.get().m;
