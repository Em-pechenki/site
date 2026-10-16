// Тема оформления: dark (по умолчанию) / light. Персистентность + ?theme=.
import { useSyncExternalStore } from 'react';

export type Theme = 'dark' | 'light';

const LS_KEY = 'yabloki-theme';

function detect(): Theme {
  try {
    const q = new URLSearchParams(window.location.search).get('theme');
    if (q === 'light' || q === 'dark') return q;
    const s = localStorage.getItem(LS_KEY);
    if (s === 'light' || s === 'dark') return s;
  } catch { /* noop */ }
  return 'dark';
}

let current: Theme = typeof window !== 'undefined' ? detect() : 'dark';
const listeners = new Set<() => void>();

function apply() {
  try {
    document.documentElement.dataset.theme = current;
    document.documentElement.style.colorScheme = current;
  } catch { /* noop */ }
}
if (typeof window !== 'undefined') apply();

export function getTheme(): Theme {
  return current;
}

export function setTheme(t: Theme) {
  if (current === t) return;
  current = t;
  try {
    localStorage.setItem(LS_KEY, t);
  } catch { /* noop */ }
  apply();
  listeners.forEach((cb) => cb());
}

export function toggleTheme() {
  setTheme(current === 'dark' ? 'light' : 'dark');
}

export function useTheme(): Theme {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => {
        listeners.delete(cb);
      };
    },
    () => current,
    () => current,
  );
}
