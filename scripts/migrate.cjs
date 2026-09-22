/* eslint-disable @typescript-eslint/no-require-imports -- Node CommonJS migration entry point. */
/* Applies reviewed SQL with one transaction, a migration lock, and checksum tracking. */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { Client } = require('pg');
try { process.loadEnvFile('.env.local'); } catch {}
(async () => {
  if (!process.env.DATABASE_URL) throw new Error('Configure DATABASE_URL in .env.local before applying migrations.');
  const db = new Client({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 10000 });
  await db.connect();
  try {
    await db.query('begin');
    await db.query("select pg_advisory_xact_lock(hashtext('strike-schema-migrations'))");
    await db.query('create schema if not exists strike_internal');
    await db.query('revoke all on schema strike_internal from public, anon, authenticated');
    await db.query('create table if not exists strike_internal.migrations(name text primary key, sha256 text not null, applied_at timestamptz not null default now())');
    const existing = (await db.query("select to_regclass('public.email_accounts') as name")).rows[0].name;
    const directory = path.join(process.cwd(), 'src/database/migrations');
    for (const name of fs.readdirSync(directory).filter(name => name.endsWith('.sql')).sort()) {
      if (existing && name === '001_initial_schema.sql') {
        // Existing baseline belongs to the hosted project's history, not this new journal.
        for (const table of ['email_accounts','email_messages','processing_jobs','ai_results','summaries','user_settings','delivery_attempts','system_events']) {
          const result = await db.query('select to_regclass($1) as name', [`public.${table}`]);
          if (!result.rows[0].name) throw new Error(`Existing baseline is incomplete: missing ${table}`);
        }
        console.log('Existing baseline detected; applying additive migrations only.');
        continue;
      }
      const sql = fs.readFileSync(path.join(directory, name), 'utf8');
      const digest = crypto.createHash('sha256').update(sql).digest('hex');
      const applied = await db.query('select sha256 from strike_internal.migrations where name=$1', [name]);
      if (applied.rows.length) {
        if (applied.rows[0].sha256 !== digest) throw new Error(`Migration checksum changed: ${name}`);
        continue;
      }
      await db.query(sql);
      await db.query('insert into strike_internal.migrations(name,sha256) values($1,$2)', [name,digest]);
      console.log(`Applied ${name}`);
    }
    await db.query('commit');
  } catch (error) { await db.query('rollback'); throw error; }
  finally { await db.end(); }
})().catch(error => { console.error(error.message); process.exitCode=1; });
