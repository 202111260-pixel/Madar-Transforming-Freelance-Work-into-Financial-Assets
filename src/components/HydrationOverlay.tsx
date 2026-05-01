import { useEffect, useState } from 'react';
import { Database } from 'lucide-react';
import { SUPABASE_ENABLED } from '../lib/supabaseSync';
import { SUPABASE_WORKSPACE } from '../lib/supabaseClient';

/**
 * HydrationOverlay
 * ----------------
 * Shown for the first ~1–2s on cold app load while `startSupabaseSync()`
 * pulls the 12 synergy_* keys from Supabase into localStorage. Disappears
 * the instant the global `synergy:hydrated` event fires (or after a 3.5s
 * fallback timeout if Supabase is slow / down).
 *
 * Renders nothing when SUPABASE_ENABLED is false.
 */
export function HydrationOverlay() {
  const [visible, setVisible] = useState(true);
  const [mounted, setMounted] = useState(true);

  useEffect(() => {
    if (!SUPABASE_ENABLED) {
      setMounted(false);
      return;
    }

    let unmountTimer: ReturnType<typeof setTimeout> | null = null;

    const hide = () => {
      setVisible(false);
      // Match the Tailwind `duration-500` fade — give it a hair of buffer.
      unmountTimer = setTimeout(() => setMounted(false), 600);
    };

    const onHydrated = () => hide();
    window.addEventListener('synergy:hydrated', onHydrated, { once: true });

    // Safety net: if the event never fires (Supabase down, network error,
    // or empty workspace where supabaseSync skips the dispatch) tear the
    // overlay down anyway so the UI never gets stuck behind it.
    const fallback = setTimeout(hide, 3500);

    return () => {
      window.removeEventListener('synergy:hydrated', onHydrated);
      clearTimeout(fallback);
      if (unmountTimer) clearTimeout(unmountTimer);
    };
  }, []);

  if (!SUPABASE_ENABLED || !mounted) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={[
        'fixed inset-0 z-[60] flex items-center justify-center',
        'bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950/40',
        'transition-opacity duration-500 ease-out',
        visible ? 'opacity-100' : 'opacity-0 pointer-events-none',
      ].join(' ')}
    >
      {/* Local keyframes for the progress bar sweep + dot stagger.
          Scoped via unique class names so they can't collide. */}
      <style>{`
        @keyframes synergy-hydration-sweep {
          0%   { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        @keyframes synergy-hydration-dot {
          0%, 80%, 100% { opacity: 0.25; }
          40%           { opacity: 1; }
        }
        .synergy-hydration-bar {
          animation: synergy-hydration-sweep 1.8s ease-in-out infinite;
        }
        .synergy-hydration-dot {
          animation: synergy-hydration-dot 1.2s ease-in-out infinite;
        }
      `}</style>

      <div
        className={[
          'w-[320px] max-w-[88vw] rounded-2xl px-7 py-6',
          'bg-slate-900/70 border border-white/10 backdrop-blur-md',
          'shadow-[0_20px_60px_-15px_rgba(0,0,0,0.6)]',
        ].join(' ')}
      >
        {/* Brand lockup */}
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center shadow-sm">
            <Database className="w-5 h-5 text-white" />
          </div>
          <div className="flex flex-col leading-tight">
            <span className="text-slate-100 font-semibold tracking-tight">Madar</span>
            <span className="text-[10px] uppercase tracking-[0.18em] text-emerald-400/80">
              Cloud Sync
            </span>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-5 h-[3px] w-full overflow-hidden rounded-full bg-white/5">
          <div
            className="synergy-hydration-bar h-full w-1/2 rounded-full bg-gradient-to-r from-transparent via-emerald-400 to-transparent"
          />
        </div>

        {/* Status text */}
        <div className="mt-3 flex items-center justify-between gap-3">
          <p className="text-sm text-slate-300 truncate">
            Hydrating from cloud · <span className="text-slate-200">{SUPABASE_WORKSPACE}</span>
          </p>
          <div className="flex items-center gap-1" aria-hidden="true">
            <span
              className="synergy-hydration-dot w-1.5 h-1.5 rounded-full bg-emerald-400"
              style={{ animationDelay: '0ms' }}
            />
            <span
              className="synergy-hydration-dot w-1.5 h-1.5 rounded-full bg-emerald-400"
              style={{ animationDelay: '150ms' }}
            />
            <span
              className="synergy-hydration-dot w-1.5 h-1.5 rounded-full bg-emerald-400"
              style={{ animationDelay: '300ms' }}
            />
          </div>
        </div>
      </div>

      {/* Visually hidden status for screen readers */}
      <span className="sr-only">Loading data</span>
    </div>
  );
}

export default HydrationOverlay;
