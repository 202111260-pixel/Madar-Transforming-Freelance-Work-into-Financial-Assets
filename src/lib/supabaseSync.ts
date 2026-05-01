/**
 * Madar — Supabase Sync Engine
 * ──────────────────────────────────────────────────────────────────────
 * Architecture: KV-Mirror.
 *
 * localStorage stays the synchronous source-of-truth for the UI (no async
 * waterfalls in render paths), and Supabase becomes the durable backend.
 * Every synergy_* key in localStorage is mirrored to one row of kv_store.
 *
 *   PULL (on app start)  : SELECT * FROM kv_store → write each row to localStorage
 *   PUSH (on every change): debounced UPSERT for each dirty key
 *   REALTIME             : subscribe to kv_store → if a different tab/device
 *                          updates a key, write it back to localStorage and
 *                          fire 'synergy:store-changed' so React refreshes
 *
 * Pages don't need to change — they keep calling localStorage.setItem +
 * notifyStoreChanged(), and we automatically capture and propagate.
 */
import { supabase, SUPABASE_ENABLED, SUPABASE_WORKSPACE } from './supabaseClient';
import { validateShape } from './synergyShapes';

/* Re-export so callers don't need to import from two files. */
export { SUPABASE_ENABLED } from './supabaseClient';

/* The 12 keys we mirror. Anything written to localStorage with one of these
 * keys is picked up by the engine. (Add new keys here as the app grows.) */
export const SYNCED_KEYS = [
  'synergy_connections_v4',
  'synergy_invoices_v1',
  'synergy_obligations_v1',
  'synergy_clients_v1',
  'synergy_activity_log_v1',
  'synergy_credit_offer_v1',
  'synergy_bank_review_v1',
  'synergy_reports_v1',
  'synergy_consensus_history_v1',
  'synergy_score_history_v1',
  'synergy_latest_ai_score',
  'synergy_profit_forecast_v1',
  'synergy_user_profile_v1',
  'synergy_bridge_advance_v1',
  'synergy_balance_projection_v1',
] as const;

const KEY_SET = new Set<string>(SYNCED_KEYS);

let pullPromise: Promise<void> | null = null;
let pushTimer: number | null = null;
const dirtyKeys = new Set<string>();
let started = false;
let realtimeChannel: ReturnType<NonNullable<typeof supabase>['channel']> | null = null;

/* ─── Outbox & retry resilience ───────────────────────────────────────
 * The outbox persists the set of dirty keys to localStorage so that if
 * the tab dies (offline, crash, hard refresh) before a successful push,
 * the next page-load can replay them. We persist KEYS ONLY — values are
 * read fresh from localStorage at flush time, which gives us LWW.
 *
 * On push failure we apply exponential backoff (1s → 2s → 4s … capped
 * at 30s) so a flaky/offline server doesn't spam requests. A successful
 * push resets the failure counter and the debounce returns to 600ms.
 *
 * On `visibilitychange` (hidden) we trigger a best-effort flush; on
 * `beforeunload` we POST the outbox via `fetch(..., { keepalive: true })`
 * to PostgREST directly (the supabase-js client isn't usable mid-unload).
 * ─────────────────────────────────────────────────────────────────── */
const OUTBOX_KEY      = '__synergy_supabase_outbox_v1';
const BASE_DEBOUNCE_MS = 600;
const RETRY_BASE_MS    = 1_000;
const RETRY_CAP_MS     = 30_000;

let consecutiveFailures = 0;
let pushTimerIsBackoff  = false;
let unloadHandlersInstalled = false;

type OutboxShape = { updatedAt: string; keys: string[] };

function readOutbox(): OutboxShape | null {
  try {
    const raw = localStorage.getItem(OUTBOX_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as OutboxShape;
    if (!parsed || !Array.isArray(parsed.keys)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeOutbox(): void {
  try {
    if (dirtyKeys.size === 0) {
      localStorage.removeItem(OUTBOX_KEY);
      return;
    }
    const payload: OutboxShape = {
      updatedAt: new Date().toISOString(),
      keys: Array.from(dirtyKeys),
    };
    localStorage.setItem(OUTBOX_KEY, JSON.stringify(payload));
  } catch {
    /* quota / private mode — outbox is best-effort */
  }
}

function clearOutbox(): void {
  try { localStorage.removeItem(OUTBOX_KEY); } catch { /**/ }
}

function computeBackoffMs(): number {
  // 1s, 2s, 4s, 8s, 16s, 30s (cap)
  const exp = RETRY_BASE_MS * Math.pow(2, Math.max(0, consecutiveFailures - 1));
  return Math.min(exp, RETRY_CAP_MS);
}

function scheduleRetry() {
  if (!SUPABASE_ENABLED || !supabase) return;
  if (pushTimer != null) {
    window.clearTimeout(pushTimer);
    pushTimer = null;
  }
  const delay = computeBackoffMs();
  pushTimerIsBackoff = true;
  pushTimer = window.setTimeout(() => {
    pushTimer = null;
    pushTimerIsBackoff = false;
    void flushPush();
  }, delay);
}

/* Replay any keys persisted from a previous session and queue them. */
function replayOutbox(): void {
  const ob = readOutbox();
  if (!ob || ob.keys.length === 0) return;
  let queued = 0;
  for (const k of ob.keys) {
    if (KEY_SET.has(k) && localStorage.getItem(k) != null) {
      dirtyKeys.add(k);
      queued += 1;
    }
  }
  if (queued > 0) schedulePush();
}

/* Best-effort flush when the tab is hidden (mobile background, etc.). */
function onVisibilityChange() {
  if (document.visibilityState !== 'hidden') return;
  if (dirtyKeys.size === 0) return;
  // Cancel any pending timer so we go now.
  if (pushTimer != null) {
    window.clearTimeout(pushTimer);
    pushTimer = null;
    pushTimerIsBackoff = false;
  }
  void flushPush();
}

/* On unload we can't await; use fetch w/ keepalive directly to PostgREST. */
function onBeforeUnload() {
  if (dirtyKeys.size === 0) return;
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  if (!url || !anon) return;

  const rows = Array.from(dirtyKeys).map(key => ({
    workspace: SUPABASE_WORKSPACE,
    key,
    value: safeParse(localStorage.getItem(key)),
  }));
  if (rows.length === 0) return;

  try {
    const endpoint = `${url.replace(/\/$/, '')}/rest/v1/kv_store?on_conflict=workspace,key`;
    fetch(endpoint, {
      method: 'POST',
      keepalive: true,
      headers: {
        'Content-Type': 'application/json',
        apikey: anon,
        Authorization: `Bearer ${anon}`,
        Prefer: 'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify(rows),
    }).catch(() => { /* fire-and-forget */ });
  } catch {
    /* unload — swallow */
  }
}

function installUnloadHandlers() {
  if (unloadHandlersInstalled) return;
  unloadHandlersInstalled = true;
  try {
    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('beforeunload', onBeforeUnload);
    window.addEventListener('pagehide', onBeforeUnload);
  } catch { /**/ }
}

/* Try to parse JSON; fall back to the raw string for tiny scalars
 * (e.g. synergy_latest_ai_score = "78"). */
function safeParse(raw: string | null): unknown {
  if (raw == null) return null;
  try { return JSON.parse(raw); } catch { return raw; }
}

function safeStringify(v: unknown): string {
  if (v == null) return 'null';
  if (typeof v === 'string') return v;
  try { return JSON.stringify(v); } catch { return String(v); }
}

/* ─── PULL ──────────────────────────────────────────────────────────── */
/**
 * Pull every kv_store row for this workspace and overwrite the local mirror.
 *
 * Behavior (the database IS the source of truth):
 *   • Keys present in DB → written to localStorage exactly as stored.
 *   • Keys absent from DB → REMOVED from localStorage (no stale data).
 *   • Re-callable: the in-flight promise is cached only for concurrent calls
 *     within the same tick; subsequent invocations refetch.
 */
export async function hydrateFromSupabase(): Promise<void> {
  if (!SUPABASE_ENABLED || !supabase) return;
  if (pullPromise) return pullPromise;

  pullPromise = (async () => {
    const { data, error } = await supabase!
      .from('kv_store')
      .select('key,value')
      .eq('workspace', SUPABASE_WORKSPACE);

    if (error) {
      console.warn('[supabase] hydrate failed:', error.message);
      return;
    }

    const dbKeys = new Set<string>();
    let touched = 0;
    for (const row of (data ?? []) as Array<{ key: string; value: unknown }>) {
      if (!KEY_SET.has(row.key)) continue;
      dbKeys.add(row.key);
      try {
        localStorage.setItem(row.key, safeStringify(row.value));
        touched += 1;
      } catch { /* quota — ignore */ }
    }

    // Drop any synced key that is NOT present in DB — the database is
    // authoritative, so missing rows mean "deleted upstream".
    for (const k of SYNCED_KEYS) {
      if (!dbKeys.has(k) && localStorage.getItem(k) != null) {
        try { localStorage.removeItem(k); touched += 1; } catch { /**/ }
      }
    }

    if (touched > 0) {
      try { window.dispatchEvent(new Event('synergy:store-changed')); } catch { /**/ }
    }
    // Always fire hydrated so overlays clear, even when nothing changed.
    try { window.dispatchEvent(new Event('synergy:hydrated')); } catch { /**/ }
  })().catch(err => {
    console.warn('[supabase] hydrate error:', err);
  }).finally(() => {
    pullPromise = null;
  });

  return pullPromise;
}

/* ─── PUSH (debounced) ─────────────────────────────────────────────── */
function schedulePush() {
  if (!SUPABASE_ENABLED || !supabase) return;
  if (pushTimer != null) return;
  pushTimerIsBackoff = false;
  pushTimer = window.setTimeout(() => {
    pushTimer = null;
    void flushPush();
  }, BASE_DEBOUNCE_MS);
}

async function flushPush(): Promise<void> {
  if (!SUPABASE_ENABLED || !supabase) return;
  if (dirtyKeys.size === 0) {
    clearOutbox();
    return;
  }

  const batch = Array.from(dirtyKeys).map(key => {
    const raw = localStorage.getItem(key);
    return {
      workspace: SUPABASE_WORKSPACE,
      key,
      value: safeParse(raw),
    };
  });
  dirtyKeys.clear();

  // Defensive shape gate: drop any rows whose value fails a sanity check.
  // Rejected rows are NOT re-queued (would loop forever) — we swallow the
  // bad write so corruption can't replicate to other tabs/devices.
  const validated = batch.filter(row => {
    const result = validateShape(row.key, row.value);
    if (!result.ok) {
      console.warn('[supabase] shape reject', row.key, result.reason);
      return false;
    }
    return true;
  });
  if (validated.length === 0) {
    clearOutbox();
    return;
  }

  const { error } = await supabase
    .from('kv_store')
    .upsert(validated, { onConflict: 'workspace,key' });

  if (error) {
    console.warn('[supabase] push failed:', error.message);
    // Re-mark as dirty so a future attempt picks them up.
    for (const row of validated) dirtyKeys.add(row.key);
    writeOutbox();
    consecutiveFailures += 1;
    scheduleRetry();
    return;
  }

  // Success — reset backoff and clear persisted outbox.
  consecutiveFailures = 0;
  clearOutbox();
}

/* Manually queue a key (used by setItem patch + explicit calls). */
export function queueKeyForPush(key: string) {
  if (!KEY_SET.has(key)) return;
  dirtyKeys.add(key);
  writeOutbox();
  // If a long retry is currently armed, cancel it so the normal 600ms
  // debounce takes priority for fresh writes.
  if (pushTimer != null && pushTimerIsBackoff) {
    window.clearTimeout(pushTimer);
    pushTimer = null;
    pushTimerIsBackoff = false;
  }
  schedulePush();
}

/* ─── REALTIME (multi-tab / multi-device) ──────────────────────────── */
function startRealtime() {
  if (!SUPABASE_ENABLED || !supabase || realtimeChannel) return;

  realtimeChannel = supabase
    .channel('kv_store_changes')
    .on(
      // @ts-expect-error — Supabase realtime types are loose on event names.
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'kv_store',
        filter: `workspace=eq.${SUPABASE_WORKSPACE}`,
      },
      (payload: { new?: { key: string; value: unknown } }) => {
        const next = payload?.new;
        if (!next || !KEY_SET.has(next.key)) return;
        try {
          const incoming = safeStringify(next.value);
          // Skip if our local copy already matches — prevents echo loops.
          if (localStorage.getItem(next.key) === incoming) return;
          localStorage.setItem(next.key, incoming);
          window.dispatchEvent(new Event('synergy:store-changed'));
        } catch { /**/ }
      },
    )
    .subscribe();
}

/* ─── localStorage interception ────────────────────────────────────── */
/* We monkey-patch setItem/removeItem ONCE so every existing call site
 * (and there are dozens) automatically queues a push without any code
 * changes elsewhere. */
function patchLocalStorage() {
  const proto = window.Storage.prototype;
  const origSet    = proto.setItem;
  const origRemove = proto.removeItem;

  proto.setItem = function patchedSet(this: Storage, key: string, value: string) {
    origSet.call(this, key, value);
    if (this === window.localStorage && KEY_SET.has(key)) {
      queueKeyForPush(key);
    }
  };

  proto.removeItem = function patchedRemove(this: Storage, key: string) {
    origRemove.call(this, key);
    if (this === window.localStorage && KEY_SET.has(key)) {
      // Represent removal as null in the row.
      dirtyKeys.add(key);
      writeOutbox();
      if (pushTimer != null && pushTimerIsBackoff) {
        window.clearTimeout(pushTimer);
        pushTimer = null;
        pushTimerIsBackoff = false;
      }
      schedulePush();
    }
  };
}

/* Also listen to the app's own change event as a safety net (e.g. a future
 * page that mutates state via setState then notifyStoreChanged). */
function listenToStoreEvent() {
  window.addEventListener('synergy:store-changed', () => {
    for (const k of SYNCED_KEYS) dirtyKeys.add(k);
    schedulePush();
  });
}

/* ─── Public API ───────────────────────────────────────────────────── */
/**
 * Boot the sync engine. Order matters:
 *   1. Wipe every synced key from localStorage so stale demo data from a
 *      previous session can't leak back to the database.
 *   2. Drop the dirty-keys queue + outbox for the same reason.
 *   3. Hydrate fresh rows from Supabase \u2192 localStorage.
 *   4. Patch setItem + start realtime so subsequent edits round-trip.
 *
 * Net result: the database is the single source of truth. The app starts
 * with whatever is in kv_store and nothing else.
 */
export async function startSupabaseSync(): Promise<void> {
  if (started) return;
  started = true;

  if (!SUPABASE_ENABLED) {
    console.info('[supabase] disabled — running in pure-localStorage mode');
    return;
  }

  // 1) Purge any stale local synced keys (and the outbox) so an old browser
  //    session can't republish ghost data on top of the fresh DB state.
  for (const k of SYNCED_KEYS) {
    try { localStorage.removeItem(k); } catch { /**/ }
  }
  dirtyKeys.clear();
  clearOutbox();

  // 2) Pull authoritative rows from Supabase into localStorage.
  await hydrateFromSupabase();

  // 3) Now (and only now) start mirroring local writes back to the DB.
  patchLocalStorage();
  listenToStoreEvent();
  installUnloadHandlers();
  startRealtime();
}

/* Force-push everything in localStorage right now — useful after seeding. */
export async function pushAllNow(): Promise<void> {
  if (!SUPABASE_ENABLED) return;
  for (const k of SYNCED_KEYS) {
    if (localStorage.getItem(k) != null) dirtyKeys.add(k);
  }
  if (pushTimer != null) {
    window.clearTimeout(pushTimer);
    pushTimer = null;
    pushTimerIsBackoff = false;
  }
  writeOutbox();
  await flushPush();
}

/* Wipe Supabase rows for the current workspace — companion to wipeSynergyData. */
export async function wipeSupabaseWorkspace(): Promise<void> {
  if (!SUPABASE_ENABLED || !supabase) return;
  await supabase
    .from('kv_store')
    .delete()
    .eq('workspace', SUPABASE_WORKSPACE);
}
