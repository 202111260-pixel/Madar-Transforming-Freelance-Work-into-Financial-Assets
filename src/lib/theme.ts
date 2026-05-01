/** Madar — theme toggle utility (CSS-var based, no React context needed) */

export type Theme = 'light' | 'dark';

export function getTheme(): Theme {
  if (typeof localStorage === 'undefined') return 'light';
  return (localStorage.getItem('synergy_theme') as Theme) ?? 'light';
}

export function setTheme(t: Theme) {
  localStorage.setItem('synergy_theme', t);
  document.documentElement.classList.toggle('dark', t === 'dark');
}

export function toggleTheme(): Theme {
  const next = getTheme() === 'dark' ? 'light' : 'dark';
  setTheme(next);
  return next;
}

/** Call once at app startup to restore saved preference */
export function initTheme() {
  setTheme(getTheme());
}
