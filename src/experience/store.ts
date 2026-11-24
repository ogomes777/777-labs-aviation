import { useSyncExternalStore } from 'react';

/** Store mínima (sem dependência) para estado discreto de UI que precisa re-renderizar React. */
export function createStore<T extends object>(initial: T) {
  let state = initial;
  const listeners = new Set<() => void>();
  const get = () => state;
  const set = (patch: Partial<T> | ((s: T) => Partial<T>)) => {
    const next = typeof patch === 'function' ? patch(state) : patch;
    let changed = false;
    for (const k in next) if (!Object.is((state as never)[k], (next as never)[k])) { changed = true; break; }
    if (!changed) return;
    state = { ...state, ...next };
    listeners.forEach((l) => l());
  };
  const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
  function useStore<S>(selector: (s: T) => S): S {
    return useSyncExternalStore(subscribe, () => selector(state), () => selector(initial));
  }
  return { get, set, subscribe, useStore };
}
