/**
 * wipe_supabase_workspace.cjs
 *
 * Hard-deletes EVERY row of kv_store + kv_events for the given workspace.
 * After running this, the app boots into an empty state — no Khalid data,
 * no Salem data, no demo invoices, nothing. The first user action becomes
 * the first row.
 *
 * Usage:
 *   set PGPASSWORD=...
 *   node scripts/wipe_supabase_workspace.cjs              # wipes 'salem-habsi-demo'
 *   node scripts/wipe_supabase_workspace.cjs my-workspace  # wipes a specific one
 */
const { Client } = require('pg');

const WORKSPACE = process.argv[2] || process.env.SUPABASE_WORKSPACE || 'salem-habsi-demo';

(async () => {
  const c = new Client({
    host: 'aws-1-ap-northeast-2.pooler.supabase.com',
    port: 6543,
    database: 'postgres',
    user: 'postgres.rqmhdlpcpwpyoojrjaqb',
    password: process.env.PGPASSWORD,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000,
  });
  await c.connect();
  console.log(`Connected. Wiping workspace="${WORKSPACE}" …`);

  const before = await c.query(
    'select count(*)::int as n from public.kv_store where workspace = $1',
    [WORKSPACE]
  );
  console.log(`  rows in kv_store before wipe: ${before.rows[0].n}`);

  await c.query('delete from public.kv_store  where workspace = $1', [WORKSPACE]);
  await c.query('delete from public.kv_events where workspace = $1', [WORKSPACE]);

  const after = await c.query(
    'select count(*)::int as n from public.kv_store where workspace = $1',
    [WORKSPACE]
  );
  console.log(`  rows in kv_store after wipe:  ${after.rows[0].n}`);

  await c.end();
  console.log(`\n✅ Workspace "${WORKSPACE}" wiped clean. App will boot into empty state.`);
})().catch(e => { console.error('WIPE FAILED:', e.message); process.exit(1); });
