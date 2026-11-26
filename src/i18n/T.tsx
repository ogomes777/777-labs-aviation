'use client';
import { Fragment } from 'react';
import Words from '@/components/Words';
import type { Messages } from './messages/pt';
import { useLang, useM } from './index';

type Leaves<T, P extends string = ''> = T extends string ? P : T extends readonly unknown[] ? never : { [K in keyof T & string]: Leaves<T[K], P extends '' ? K : `${P}.${K}`> }[keyof T & string];
export type MsgKey = Leaves<Messages>;

export function pick(m: Messages, k: string): string {
  let v: unknown = m;
  for (const p of k.split('.')) v = (v as Record<string, unknown> | undefined)?.[p];
  return typeof v === 'string' ? v : k;
}

/** Texto traduzido (pode ser usado dentro de componentes de servidor). */
export function T({ k }: { k: MsgKey }) {
  return <>{pick(useM(), k)}</>;
}

/** Texto traduzido dividido em palavras para as revelações de scroll; remonta ao trocar de idioma. */
export function TW({ k, offset = 0 }: { k: MsgKey; offset?: number }) {
  const lang = useLang();
  const text = pick(useM(), k);
  return <Fragment key={lang}><Words offset={offset}>{text}</Words></Fragment>;
}
