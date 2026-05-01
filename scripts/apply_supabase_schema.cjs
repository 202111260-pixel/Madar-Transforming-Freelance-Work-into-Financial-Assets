// Apply supabase/schema.sql to the kv_store project.
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

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
  try {
    await c.connect();
    const sql = fs.readFileSync(path.join('supabase', 'schema.sql'), 'utf8');
    await c.query(sql);
    console.log('SCHEMA APPLIED OK');
    const r = await c.query('select count(*)::int as n from public.kv_store');
    console.log('kv_store rows:', r.rows[0].n);
    const r2 = await c.query("select tablename from pg_tables where schemaname='public' order by 1");
    console.log('public tables:', r2.rows.map(x => x.tablename).join(', '));
    const r3 = await c.query("select pubname, schemaname, tablename from pg_publication_tables where pubname='supabase_realtime' and schemaname='public'");
    console.log('realtime tables:', r3.rows.map(x => x.tablename).join(', ') || '(none)');
  } catch (e) {
    console.error('ERR', e.message);
    process.exitCode = 1;
  } finally {
    try { await c.end(); } catch { /* ignore */ }
  }
})();
