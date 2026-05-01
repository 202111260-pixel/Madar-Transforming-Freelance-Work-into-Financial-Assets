/**
 * Supabase client singleton — Madar.
 *
 * The publishable (anon) key is safe to expose in client code. It only
 * grants access to whatever Row-Level Security policies allow.
 *
 * If env vars are missing (e.g. local dev without .env.local), the client
 * is `null` and the sync engine becomes a no-op so the app keeps working
 * off pure localStorage.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const URL  = import.meta.env.VITE_SUPABASE_URL  as string | undefined;
const KEY  = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const SUPABASE_WORKSPACE =
  (import.meta.env.VITE_SUPABASE_WORKSPACE as string | undefined) || 'demo';

export const supabase: SupabaseClient | null = (URL && KEY)
  ? createClient(URL, KEY, {
      auth: { persistSession: false },
      realtime: { params: { eventsPerSecond: 5 } },
    })
  : null;

export const SUPABASE_ENABLED = !!supabase;
