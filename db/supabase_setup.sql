-- ════════════════════════════════════════════════════════════════════
-- Synergy AI — Supabase schema (single table, JSONB key-value mirror)
-- ════════════════════════════════════════════════════════════════════
-- Paste this into Supabase Studio → SQL Editor → Run.
-- Safe to run multiple times (CREATE IF NOT EXISTS / OR REPLACE).
--
-- Project:   madar  (rqmhdlpcpwpyoojrjaqb.supabase.co)
-- Workspace: salem-habsi-demo  (set via VITE_SUPABASE_WORKSPACE)
-- ════════════════════════════════════════════════════════════════════

-- ─── 1) The single source-of-truth table ──────────────────────────
create table if not exists public.kv_store (
  workspace  text        not null,
  key        text        not null,
  value      jsonb       not null,
  updated_at timestamptz not null default now(),
  primary key (workspace, key)
);

-- ─── 2) Indexes for fast hydrate + workspace filter ───────────────
create index if not exists kv_store_workspace_idx on public.kv_store (workspace);
create index if not exists kv_store_updated_idx   on public.kv_store (updated_at desc);

-- ─── 3) Auto-bump updated_at on every UPSERT ──────────────────────
create or replace function public.kv_store_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end$$;

drop trigger if exists kv_store_touch_updated_at on public.kv_store;
create trigger kv_store_touch_updated_at
before insert or update on public.kv_store
for each row execute function public.kv_store_touch_updated_at();

-- ─── 4) Row-Level Security (anon role can read/write its workspace) ─
alter table public.kv_store enable row level security;

drop policy if exists "kv_store anon read"  on public.kv_store;
drop policy if exists "kv_store anon write" on public.kv_store;

-- For demo / single-tenant: anon can do everything. Tighten later if needed.
create policy "kv_store anon read"
  on public.kv_store for select
  using (true);

create policy "kv_store anon write"
  on public.kv_store for all
  using (true) with check (true);

-- ─── 5) Realtime: stream INSERT/UPDATE/DELETE to subscribed clients ─
-- (Idempotent — safe to re-run.)
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'kv_store'
  ) then
    alter publication supabase_realtime add table public.kv_store;
  end if;
end$$;

-- ════════════════════════════════════════════════════════════════════
-- VERIFY  — paste these into the SQL editor to confirm seeded data
-- ════════════════════════════════════════════════════════════════════

-- 5a) How many rows total for the demo workspace?
select count(*) as rows from public.kv_store
 where workspace = 'salem-habsi-demo';
-- Expected: 8 (after running scripts/seed_khalid_to_supabase.cjs)

-- 5b) Which keys are populated?
select key, jsonb_typeof(value) as kind, length(value::text) as bytes, updated_at
  from public.kv_store
 where workspace = 'salem-habsi-demo'
 order by key;

-- 5c) Inspect a single key (e.g. connections):
-- select value from public.kv_store
--  where workspace = 'salem-habsi-demo' and key = 'synergy_connections_v4';
