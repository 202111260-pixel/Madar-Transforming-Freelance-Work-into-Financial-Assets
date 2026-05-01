/**
 * Madar — Shape Validators
 * ──────────────────────────────────────────────────────────────────────
 * Lightweight runtime sanity gates for values about to be pushed to
 * Supabase. These are NOT full schema validators — they exist to catch
 * obvious garbage (e.g. `"undefined"`, a number where an object should
 * be, a string where an array should be) before it replicates to the
 * cloud and fans out to other tabs/devices.
 *
 * Pure module: no React, no Supabase, no side effects.
 */

export type Validator = (value: unknown) => { ok: boolean; reason?: string };

const OK: { ok: true } = { ok: true };
const fail = (reason: string): { ok: false; reason: string } => ({ ok: false, reason });

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const isStringOrNumber = (v: unknown): v is string | number =>
  typeof v === 'string' || typeof v === 'number';

const arrayOrKeyedArray = (v: unknown, prop: string): { ok: boolean; reason?: string } => {
  if (Array.isArray(v)) return OK;
  if (isPlainObject(v) && Array.isArray((v as Record<string, unknown>)[prop])) return OK;
  return fail(`expected array or { ${prop}: [] }`);
};

export const SHAPE_VALIDATORS: Record<string, Validator> = {
  synergy_connections_v4: (v) =>
    isPlainObject(v) ? OK : fail('expected non-array object'),

  synergy_invoices_v1: (v) => arrayOrKeyedArray(v, 'invoices'),

  synergy_obligations_v1: (v) => arrayOrKeyedArray(v, 'obligations'),

  synergy_clients_v1: (v) => arrayOrKeyedArray(v, 'clients'),

  synergy_activity_log_v1: (v) => {
    if (!Array.isArray(v)) return fail('expected array');
    for (const item of v) {
      if (!isPlainObject(item)) continue;
      const ts = (item as Record<string, unknown>).timestamp;
      const at = (item as Record<string, unknown>).at;
      if (ts === undefined && at === undefined) continue;
      if (ts !== undefined && !isStringOrNumber(ts)) return fail('item.timestamp not str/num');
      if (at !== undefined && !isStringOrNumber(at)) return fail('item.at not str/num');
    }
    return OK;
  },

  synergy_credit_offer_v1: (v) => {
    if (v === null) return OK;
    if (!isPlainObject(v)) return fail('expected object or null');
    const o = v as Record<string, unknown>;
    const hasStatus  = typeof o.status === 'string';
    const hasTier    = typeof o.tier === 'string';
    const hasMonthly = typeof o.monthly === 'number' && Number.isFinite(o.monthly);
    if (!hasStatus && !hasTier && !hasMonthly) {
      return fail('need status|tier|monthly field');
    }
    return OK;
  },

  synergy_bank_review_v1: (v) =>
    v === null || isPlainObject(v) ? OK : fail('expected object or null'),

  synergy_reports_v1: (v) =>
    Array.isArray(v) ? OK : fail('expected array'),

  synergy_consensus_history_v1: (v) =>
    Array.isArray(v) ? OK : fail('expected array'),

  synergy_score_history_v1: (v) =>
    Array.isArray(v) ? OK : fail('expected array'),

  synergy_latest_ai_score: (v) => {
    if (typeof v !== 'number' || !Number.isFinite(v)) return fail('expected finite number');
    if (v < 0 || v > 100) return fail('out of range 0..100');
    return OK;
  },

  synergy_profit_forecast_v1: (v) =>
    v === null || isPlainObject(v) ? OK : fail('expected object or null'),

  synergy_bridge_advance_v1: (v) =>
    v === null || isPlainObject(v) ? OK : fail('expected object or null'),

  synergy_balance_projection_v1: (v) =>
    v === null || isPlainObject(v) ? OK : fail('expected object or null'),
};

export function validateShape(
  key: string,
  value: unknown,
): { ok: boolean; reason?: string } {
  const validator = SHAPE_VALIDATORS[key];
  if (!validator) return OK; // lenient default for unknown keys
  return validator(value);
}
