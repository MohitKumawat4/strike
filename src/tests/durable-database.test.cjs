/* eslint-disable @typescript-eslint/no-require-imports -- Offline database integration tests. */
const {PGlite}=require('@electric-sql/pglite');const fs=require('node:fs');const assert=require('node:assert/strict');
(async()=>{const db=new PGlite();await db.exec("create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql as $$select null::uuid$$;");await db.exec(fs.readFileSync(process.cwd()+'/src/database/migrations/001_initial_schema.sql','utf8').replace('create extension if not exists pgcrypto;',''));await db.exec(fs.readFileSync(process.cwd()+'/src/database/migrations/20260922104759_durable_pipeline.sql','utf8'));
const user='00000000-0000-0000-0000-000000000001',account='00000000-0000-0000-0000-000000000002',owner='00000000-0000-0000-0000-000000000003',other='00000000-0000-0000-0000-000000000004';
await db.query('insert into auth.users values($1)',[user]);await db.query("insert into email_accounts(id,user_id,provider,email_address,encrypted_refresh_token) values($1,$2,'gmail','test@example.com','encrypted')",[account,user]);
await db.query('select strike_request_sync($1)',[account]);const sync=await db.query('select * from strike_claim_sync($1)',[owner]);assert.equal(sync.rows.length,1);assert.equal((await db.query('select * from strike_claim_sync($1)',[other])).rows.length,0);
const m={provider_message_id:'gmail-1',sender:{raw:'sender'},recipients:[],subject:'Example',received_at:new Date().toISOString(),has_attachments:false,labels:[]};
await db.query('select strike_commit_sync_page($1,$2,$3,$4)',[account,owner,JSON.stringify([m]),JSON.stringify({mode:'initial',done:true,checkpoint:'123'})]);
assert.equal((await db.query('select history_id from email_accounts')).rows[0].history_id,'123');assert.equal((await db.query('select count(*) from processing_jobs')).rows[0].count,1);
assert.equal((await db.query('select * from strike_claim_jobs($1,5,$2)',[other,other])).rows.length,0,'Claims cannot cross tenant scope');
const jobs=(await db.query('select * from strike_claim_jobs($1,5,$2)',[owner,user])).rows;assert.equal(jobs.length,1);assert.equal((await db.query('select * from strike_claim_jobs($1,5,$2)',[other,user])).rows.length,0);
await assert.rejects(()=>db.query('select strike_finish_job($1,$2,$3)',[jobs[0].id,other,JSON.stringify({messageStatus:'PRE_FILTERED'})]),/LEASE_LOST/);
await db.query('select strike_finish_job($1,$2,$3)',[jobs[0].id,owner,JSON.stringify({messageStatus:'PRE_FILTERED',nextStage:'triage',metadata:{reason:'test'}})]);
assert.equal((await db.query("select count(*) from processing_jobs where stage='triage' and status='pending'")).rows[0].count,1);
const triage=(await db.query('select * from strike_claim_jobs($1,5,$2)',[owner,user])).rows[0];
await db.query("update processing_jobs set lease_expires_at=now()-interval '1 second' where id=$1",[triage.id]);
const reclaimed=(await db.query('select * from strike_claim_jobs($1,5,$2)',[other,user])).rows[0];assert.equal(reclaimed.id,triage.id);
await assert.rejects(()=>db.query('select strike_finish_job($1,$2,$3)',[triage.id,owner,'{}']),/LEASE_LOST/);
// Failed output validation rolls back both the current completion and successor.
await assert.rejects(()=>db.query('select strike_finish_job($1,$2,$3)',[triage.id,other,JSON.stringify({messageStatus:'TRIAGED',nextStage:'delivery',ai:{category:'invalid'}})]));assert.equal((await db.query("select count(*) from processing_jobs where stage='delivery'")).rows[0].count,0);
await db.query('select strike_finish_job($1,$2,$3)',[triage.id,other,JSON.stringify({messageStatus:'DELIVERY_PENDING',delivery:{destination:'+123',payload:{}}})]);
await db.query("insert into user_settings(user_id,notification_preferences) values($1,$2)",[user,JSON.stringify({last_inbound_at:new Date().toISOString()})]);
const out=(await db.query('select * from strike_claim_delivery($1,$2)',[owner,user])).rows[0];assert.ok(out);
await db.query('select strike_delivery_receipt($1,$2,now(),null)',['wa-1','delivered']);
await db.query('select strike_accept_delivery($1,$2,$3)',[out.id,owner,'wa-1']);assert.equal((await db.query('select status from delivery_outbox')).rows[0].status,'delivered');
await db.query('select strike_delivery_receipt($1,$2,now(),null)',['wa-1','sent']);assert.equal((await db.query('select status from delivery_outbox')).rows[0].status,'delivered');assert.equal((await db.query('select processing_status from email_messages')).rows[0].processing_status,'DELIVERED');
assert.equal((await db.query("select has_function_privilege('authenticated','strike_claim_jobs(uuid,integer,uuid)','execute') as allowed")).rows[0].allowed,false);
// Unknown sends are quarantined, never automatically retried.
await db.query("update delivery_outbox set status='sending',lease_owner=$1,lease_expires_at=now()-interval '1 second',provider_message_id=null",[owner]);
assert.equal((await db.query('select * from strike_claim_delivery($1,$2)',[other,user])).rows.length,0);
assert.equal((await db.query('select status from delivery_outbox')).rows[0].status,'unknown');
await db.exec('set role authenticated');
await assert.rejects(()=>db.query('select strike_claim_jobs($1,5,null)',[owner]),/permission denied/);
assert.equal((await db.query('select count(*) from delivery_outbox')).rows[0].count,0,'RLS hides another tenant outbox');
await db.exec('reset role');
console.log('SQL scenarios passed: pagination commit, atomic enqueue, concurrent claim exclusion, lease fencing/recovery, rollback, out-of-order receipts, grants');await db.close();})().catch(e=>{console.error(e);process.exitCode=1});
