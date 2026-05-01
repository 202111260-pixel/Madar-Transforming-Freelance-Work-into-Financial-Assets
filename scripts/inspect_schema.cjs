const { Client } = require('pg');
(async () => {
  const c = new Client({
    host: 'aws-1-ap-northeast-2.pooler.supabase.com',
    port: 6543,
    user: 'postgres.rqmhdlpcpwpyoojrjaqb',
    password: process.env.PGPASSWORD || 'Bb96737698@',
    database: 'postgres',
    ssl: { rejectUnauthorized: false },
  });
  await c.connect();
  const r = await c.query(
    "select column_name, data_type from information_schema.columns where table_schema='public' and table_name='kv_store' order by ordinal_position"
  );
  console.log('kv_store columns:', r.rows);
  const idx = await c.query(
    "select indexname, indexdef from pg_indexes where schemaname='public' and tablename='kv_store'"
  );
  console.log('indexes:', idx.rows);
  await c.end();
})().catch(e => { console.error(e.message); process.exit(1); });
