/**
 * useSynergyStore — reactive bridge between React state and the Madar
 * localStorage KV store.
 *
 * Across the app, pages read keys like `synergy_connections_v4`,
 * `synergy_credit_offer_v1`, etc. on mount and re-read whenever any other
 * page mutates the same key (via the `synergy:store-changed` window event).
 * The Supabase sync engine (see `src/lib/supabaseSync.ts`) separately mirrors
 * every `localStorage.setItem` call up to the cloud, so this hook stays a
 * pure local abstraction — no awareness of Supabase needed here.
 *
 * Behaviour:
 *  • On mount → read & JSON.parse `localStorage[key]`. Falls back to
 *    `initialValue` (or `null` in the no-initial overload) on miss / parse
 *    error.
 *  • Subscribes to three events: `synergy:store-changed` (same-tab),
 *    `synergy:hydrated` (Supabase pull complete), and the native `storage`
 *    event (cross-tab). On any of those, re-reads localStorage and updates
 *    state ONLY when the JSON-stringified value differs — this avoids render
 *    storms when an upstream component dispatches store-changed without
 *    actually mutating this key.
 *  • The setter writes JSON.stringify to localStorage and broadcasts
 *    `synergy:store-changed` so siblings re-render. Accepts either a plain
 *    value or an updater fn `(prev) => next`, mirroring `useState`.
 *  • SSR-safe — guards `typeof window !== 'undefined'`.
 *
 * @example
 *   // With an initial value (always non-null):
 *   const [conns, setConns] = useSynergyStore<StoreMap>('synergy_connections_v4', {});
 *   setConns(prev => ({ ...prev, github: { status: 'connected', meta: {} } }));
 *
 *   // Nullable (no initial — returns null until something is written):
 *   const [offer, setOffer] = useSynergyStore<CreditOffer>('synergy_credit_offer_v1');
 *   if (offer) console.log(offer.bridgeAmountSAR);
 */
import { useCallback, useEffect, useRef, useState } from 'react';

const SYNERGY_EVENT = 'synergy:store-changed';
const HYDRATED_EVENT = 'synergy:hydrated';

function safeParse<T>(raw: string | null): T | undefined {
  if (raw == null) return undefined;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return undefined;
  }
}

/** One-shot read helper for non-React contexts (utility code, event handlers, etc). */
export function readSynergy<T>(key: string): T | null;
export function readSynergy<T>(key: string, fallback: T): T;
export function readSynergy<T>(key: string, fallback?: T): T | null {
  if (typeof window === 'undefined') return fallback ?? null;
  const parsed = safeParse<T>(localStorage.getItem(key));
  if (parsed === undefined) return fallback ?? null;
  return parsed;
}

// Overloads — non-null when an initial value is provided, nullable otherwise.
export function useSynergyStore<T>(
  key: string,
  initialValue: T,
): [T, (next: T | ((prev: T) => T)) => void];
export function useSynergyStore<T>(
  key: string,
): [T | null, (next: T | null | ((prev: T | null) => T | null)) => void];
export function useSynergyStore<T>(
  key: string,
  initialValue?: T,
): [T | null, (next: T | null | ((prev: T | null) => T | null)) => void] {
  const hasInitial = arguments.length >= 2;

  const [value, setValue] = useState<T | null>(() => {
    if (typeof window === 'undefined') {
      return hasInitial ? (initialValue as T) : null;
    }
    const parsed = safeParse<T>(localStorage.getItem(key));
    if (parsed !== undefined) return parsed;
    return hasInitial ? (initialValue as T) : null;
  });

  // Track latest serialized value so listeners can dedupe without depending on
  // the rendered `value` (which would re-bind the listener on every change).
  const serializedRef = useRef<string>(JSON.stringify(value ?? null));

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const reread = () => {
      const raw = localStorage.getItem(key);
      const parsed = safeParse<T>(raw);
      const next = parsed === undefined ? (hasInitial ? (initialValue as T) : null) : parsed;
      const nextSerialized = JSON.stringify(next ?? null);
      if (nextSerialized === serializedRef.current) return;
      serializedRef.current = nextSerialized;
      setValue(next);
    };

    window.addEventListener(SYNERGY_EVENT, reread);
    window.addEventListener(HYDRATED_EVENT, reread);
    window.addEventListener('storage', reread);
    return () => {
      window.removeEventListener(SYNERGY_EVENT, reread);
      window.removeEventListener(HYDRATED_EVENT, reread);
      window.removeEventListener('storage', reread);
    };
    // initialValue intentionally excluded — only `key` changes should rewire.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const setter = useCallback(
    (next: T | null | ((prev: T | null) => T | null)) => {
      setValue(prev => {
        const computed =
          typeof next === 'function'
            ? (next as (p: T | null) => T | null)(prev)
            : next;
        if (typeof window !== 'undefined') {
          try {
            if (computed === null || computed === undefined) {
              localStorage.removeItem(key);
            } else {
              localStorage.setItem(key, JSON.stringify(computed));
            }
            serializedRef.current = JSON.stringify(computed ?? null);
            window.dispatchEvent(new Event(SYNERGY_EVENT));
          } catch {
            /* quota/serialization errors are silently ignored */
          }
        }
        return computed;
      });
    },
    [key],
  );

  return [value, setter];
}
