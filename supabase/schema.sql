-- ════════════════════════════════════════════════════════════════════
-- Synergy AI — Supabase schema
-- Project: madar (rqmhdlpcpwpyoojrjaqb)
--
-- Architecture: KV-Mirror.
--   Every synergy_* localStorage key is mirrored into one row of kv_store.
--   The browser treats localStorage as the synchronous cache and Supabase
--   as the source of truth — the sync engine pulls on app start and pushes
--   on every store-changed event (debounced).
--
-- Run this once in the Supabase SQL Editor.
-- ════════════════════════════════════════════════════════════════════

-- ── Extensions ──────────────────────────────────────────────────────
create extension if not exists "pgcrypto";

-- ── Main store ──────────────────────────────────────────────────────
create table if not exists public.kv_store (
  workspace   text        not null,                       -- multi-tenant key
  key         text        not null,                       -- synergy_* localStorage key
  value       jsonb       not null,                       -- parsed JSON payload
  updated_at  timestamptz not null default now(),
  primary key (workspace, key)
);

create index if not exists kv_store_workspace_idx on public.kv_store (workspace);
create index if not exists kv_store_updated_idx   on public.kv_store (updated_at desc);

-- ── Append-only event log (for analytics / audit) ──────────────────
-- Every kv_store write also fires an event row. Useful for replaying
-- the user's session or feeding the Activity Log timeline.
create table if not exists public.kv_events (
  id          bigserial primary key,
  workspace   text        not null,
  key         text        not null,
  op          text        not null check (op in ('upsert','delete','seed')),
  payload     jsonb,
  created_at  timestamptz not null default now()
);

create index if not exists kv_events_workspace_idx on public.kv_events (workspace, created_at desc);

-- ── Trigger: bump updated_at on every write ─────────────────────────
create or replace function public.touch_kv_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  insert into public.kv_events (workspace, key, op, payload)
  values (new.workspace, new.key, 'upsert', new.value);
  return new;
end
$$;

drop trigger if exists kv_store_touch on public.kv_store;
create trigger kv_store_touch
before insert or update on public.kv_store
for each row execute procedure public.touch_kv_updated_at();

-- ── Realtime ────────────────────────────────────────────────────────
-- Enable replication so the browser can subscribe to changes (multi-tab,
-- multi-device). Supabase's default 'supabase_realtime' publication is
-- already in place; just add the table.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'kv_store'
  ) then
    alter publication supabase_realtime add table public.kv_store;
  end if;
end
$$;

-- ── RLS policies ────────────────────────────────────────────────────
-- Demo policy: anyone with the anon key can read/write the demo workspace.
-- Tighten this once you ship to real users (e.g. row-level workspace =
-- auth.uid()::text).
alter table public.kv_store  enable row level security;
alter table public.kv_events enable row level security;

drop policy if exists "kv_store demo open"  on public.kv_store;
create policy "kv_store demo open"
  on public.kv_store
  for all
  using (true)
  with check (true);

drop policy if exists "kv_events demo open" on public.kv_events;
create policy "kv_events demo open"
  on public.kv_events
  for all
  using (true)
  with check (true);

-- ── Helper view: flat rows for the SQL editor ───────────────────────
create or replace view public.kv_store_pretty as
select
  workspace,
  key,
  jsonb_pretty(value) as value,
  updated_at
from public.kv_store
order by updated_at desc;

-- ════════════════════════════════════════════════════════════════════
-- Done. After running, verify with:
--   select key, jsonb_typeof(value) from public.kv_store;
-- ════════════════════════════════════════════════════════════════════
