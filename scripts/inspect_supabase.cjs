// Inspect what's currently in Supabase kv_store.
const { Client } = require('pg');

(async () => {
  const c = new Client({
    host: 'aws-1-ap-northeast-2.pooler.supabase.com',
    port: 6543,
    database: 'postgres',
    user: 'postgres.rqmhdlpcpwpyoojrjaqb',
    password: process.env.PGPASSWORD,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 8000,
  });
  await c.connect();
  const r = await c.query(
    "select workspace, key, jsonb_typeof(value) as type, length(value::text) as size, updated_at from public.kv_store order by workspace, key"
  );
  console.log('Total rows:', r.rowCount);
  for (const x of r.rows) {
    console.log(' ', x.workspace, '|', x.key, '|', x.type, '|', x.size, 'B', '|', x.updated_at);
  }
  await c.end();
})();
