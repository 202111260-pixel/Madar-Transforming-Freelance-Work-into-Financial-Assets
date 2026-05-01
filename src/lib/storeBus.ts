/**
 * storeBus — Madar's single source of truth for cross-page state.
 *
 * Why this exists
 * ───────────────
 * The MVP keeps everything in localStorage so the demo runs fully offline,
 * but every page (Connections, Manual, AgentRoom, Credit, Activity, Dashboard)
 * was managing its own keys with bespoke setters. Some forgot to dispatch
 * the `synergy:store-changed` event → other pages saw stale data → the
 * Synergy Score and pipeline banners froze. This module fixes that.
 *
 * What it provides
 * ────────────────
 *   storeBus.get(key, fallback)       — typed read with safe fallback
 *   storeBus.set(key, value)          — write + auto-broadcast
 *   storeBus.remove(key)              — wipe + broadcast
 *   storeBus.subscribe(cb)            — react to ANY change (any tab)
 *   storeBus.subscribeKeys(keys, cb)  — react to specific keys only
 *
 * Every write goes through `storeBus.set` so the entire UI stays in lockstep
 * without any page having to remember to broadcast manually.
 */

// ── Canonical key list — keep aligned with AppLayout.SYNERGY_KEYS ─────────
export const STORE_KEYS = {
  connections:     'synergy_connections_v4',
  invoices:        'synergy_invoices_v1',
  obligations:     'synergy_obligations_v1',
  clients:         'synergy_clients_v1',
  activityLog:     'synergy_activity_log_v1',
  reports:         'synergy_reports_v1',
  creditOffer:     'synergy_credit_offer_v1',
  bankReview:      'synergy_bank_review_v1',
  consensusHist:   'synergy_consensus_history_v1',
  scoreHistory:    'synergy_score_history_v1',
  latestAiScore:   'synergy_latest_ai_score',
  profitForecast:  'synergy_profit_forecast_v1',
} as const;

export type StoreKey = typeof STORE_KEYS[keyof typeof STORE_KEYS];

const EVT = 'synergy:store-changed';

// ── Internal helpers ─────────────────────────────────────────────────────
function safeStringify(value: unknown): string {
  if (typeof value === 'string') return value;
  return JSON.stringify(value);
}

function safeParse<T>(raw: string | null, fallback: T): T {
  if (raw == null) return fallback;
  // Strings that look like JSON arrays/objects/booleans/numbers get parsed,
  // bare strings (like the score) are returned as-is.
  const first = raw.trim()[0];
  if (first === '{' || first === '[' || first === '"' || raw === 'true' || raw === 'false' || raw === 'null') {
    try { return JSON.parse(raw) as T; } catch { return fallback; }
  }
  // Numeric-only payloads (e.g. latest AI score "78")
  if (!Number.isNaN(Number(raw))) return Number(raw) as unknown as T;
  return raw as unknown as T;
}

function broadcast(key: StoreKey, kind: 'set' | 'remove') {
  try {
    window.dispatchEvent(new CustomEvent(EVT, { detail: { key, kind } }));
  } catch { /**/ }
}

// ── Public API ───────────────────────────────────────────────────────────
export const storeBus = {
  /** Read a key with a typed fallback. Never throws. */
  get<T>(key: StoreKey, fallback: T): T {
    try { return safeParse<T>(localStorage.getItem(key), fallback); }
    catch { return fallback; }
  },

  /** Write a key and notify every mounted listener (same tab + cross-tab). */
  set<T>(key: StoreKey, value: T): void {
    try {
      localStorage.setItem(key, safeStringify(value));
      broadcast(key, 'set');
    } catch { /**/ }
  },

  /** Delete a key and notify listeners. */
  remove(key: StoreKey): void {
    try {
      localStorage.removeItem(key);
      broadcast(key, 'remove');
    } catch { /**/ }
  },

  /**
   * Subscribe to ALL store mutations. The callback receives the key that
   * changed (when known) or undefined for cross-tab `storage` events that
   * pre-date our custom-event format.
   */
  subscribe(cb: (key?: StoreKey) => void): () => void {
    const onCustom  = (e: Event) => cb((e as CustomEvent).detail?.key);
    const onStorage = (e: StorageEvent) => cb(e.key as StoreKey | undefined);
    window.addEventListener(EVT, onCustom);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(EVT, onCustom);
      window.removeEventListener('storage', onStorage);
    };
  },

  /** Subscribe only to a specific subset of keys. */
  subscribeKeys(keys: StoreKey[], cb: (key: StoreKey) => void): () => void {
    const set = new Set<StoreKey>(keys);
    return storeBus.subscribe((k) => { if (k && set.has(k)) cb(k); });
  },

  /**
   * Wipe every Madar key. Used by the "Load Demo Profile" flow before
   * seeding fresh data.
   */
  wipeAll(): void {
    for (const k of Object.values(STORE_KEYS) as StoreKey[]) {
      try { localStorage.removeItem(k); } catch { /**/ }
    }
    try { window.dispatchEvent(new CustomEvent(EVT, { detail: { key: null, kind: 'wipe' } })); } catch { /**/ }
  },
};

/**
 * Tiny React hook that returns a tick number which increments every time the
 * given keys change. Use it like:
 *   const tick = useStoreTick(['synergy_invoices_v1']);
 *   const invs = useMemo(() => storeBus.get('synergy_invoices_v1', []), [tick]);
 */
import { useEffect, useState } from 'react';
export function useStoreTick(keys?: StoreKey[]): number {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (keys && keys.length > 0) {
      return storeBus.subscribeKeys(keys, () => setTick(t => t + 1));
    }
    return storeBus.subscribe(() => setTick(t => t + 1));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keys?.join('|')]);
  return tick;
}
