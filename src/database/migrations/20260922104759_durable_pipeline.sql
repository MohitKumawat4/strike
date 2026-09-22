-- Durable stage jobs, mailbox reconciliation and provider delivery receipts.
-- Functions are invoker-only and executable only by the trusted service role.
alter table public.user_settings add column if not exists custom_priority_rules jsonb not null default '{}'::jsonb;
alter table public.processing_jobs add column if not exists lease_owner uuid;
alter table public.processing_jobs add column if not exists lease_expires_at timestamptz;
alter table public.processing_jobs add column if not exists last_heartbeat_at timestamptz;
alter table public.processing_jobs add column if not exists result jsonb;
create unique index if not exists processing_jobs_message_stage_unique on public.processing_jobs(message_id,stage);
create index if not exists processing_jobs_lease_idx on public.processing_jobs(lease_expires_at) where status='running';

create table if not exists public.error_logs (
 id uuid primary key default gen_random_uuid(), user_id uuid references auth.users(id) on delete set null,
 layer text not null, severity text not null, error_code text not null, error_message text not null,
 stack_trace text, technical_details jsonb not null default '{}', context jsonb not null default '{}',
 occurred_at timestamptz not null default now()
);
alter table public.error_logs enable row level security;
create index if not exists error_logs_user_time_idx on public.error_logs(user_id,occurred_at desc);

create table if not exists public.mailbox_sync_jobs (
 account_id uuid primary key references public.email_accounts(id) on delete cascade,
 generation bigint not null default 1, claimed_generation bigint not null default 0,
 status text not null default 'pending' check(status in ('pending','running','idle','failed')),
 mode text not null default 'initial' check(mode in ('initial','full','history')),
 page_offset integer not null default 0, page_token text, baseline text, start_history_id text,
 lease_owner uuid, lease_expires_at timestamptz, attempts int not null default 0,
 next_retry_at timestamptz, error_message text, updated_at timestamptz not null default now()
);
alter table public.mailbox_sync_jobs enable row level security;
create index if not exists mailbox_sync_pending_idx on public.mailbox_sync_jobs(status,next_retry_at);

create table if not exists public.delivery_outbox (
 id uuid primary key default gen_random_uuid(), message_id uuid not null unique references public.email_messages(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade, destination text not null,
 payload jsonb not null, status text not null default 'pending' check(status in ('pending','sending','accepted','delivered','failed','unknown','skipped')),
 provider_message_id text unique, lease_owner uuid, lease_expires_at timestamptz,
 attempts int not null default 0, error_code text, error_message text,
 accepted_at timestamptz, delivered_at timestamptz, updated_at timestamptz not null default now()
);
alter table public.delivery_outbox enable row level security;
create policy "Users read own outbox" on public.delivery_outbox for select to authenticated using(user_id=(select auth.uid()));
create index if not exists delivery_outbox_pending_idx on public.delivery_outbox(status,updated_at);
create index if not exists delivery_outbox_user_idx on public.delivery_outbox(user_id);
create table if not exists public.delivery_receipts (
 provider_message_id text primary key, status text not null, occurred_at timestamptz not null,
 error_code text, updated_at timestamptz not null default now()
);
alter table public.delivery_receipts enable row level security;

create or replace function public.strike_request_sync(p_account uuid) returns void language plpgsql security invoker set search_path='' as $$
begin
 insert into public.mailbox_sync_jobs(account_id) values(p_account)
 on conflict(account_id) do update set generation=public.mailbox_sync_jobs.generation+1,
 status=case when public.mailbox_sync_jobs.status='running' then 'running' else 'pending' end,
 attempts=0,next_retry_at=null,updated_at=now();
end $$;

create or replace function public.strike_claim_sync(p_owner uuid,p_user uuid default null)
returns setof public.mailbox_sync_jobs language sql security invoker set search_path='' as $$
 update public.mailbox_sync_jobs j set status='running', lease_owner=p_owner,
 lease_expires_at=now()+interval '2 minutes',claimed_generation=generation,updated_at=now()
 where j.account_id=(select q.account_id from public.mailbox_sync_jobs q
 join public.email_accounts a on a.id=q.account_id
 where (p_user is null or a.user_id=p_user) and a.connection_status='connected'
 and ((q.status='pending' and (q.next_retry_at is null or q.next_retry_at<=now())) or (q.status='running' and q.lease_expires_at<now()))
 order by q.updated_at for update of q skip locked limit 1) returning j.*;
$$;

create or replace function public.strike_commit_sync_page(p_account uuid,p_owner uuid,p_messages jsonb,p_progress jsonb)
returns void language plpgsql security invoker set search_path='' as $$
declare j public.mailbox_sync_jobs; a public.email_accounts; item jsonb; msg uuid;
begin
 select * into j from public.mailbox_sync_jobs where account_id=p_account for update;
 if j.lease_owner is distinct from p_owner or j.status<>'running' or j.lease_expires_at<now() then raise exception 'SYNC_LEASE_LOST'; end if;
 select * into strict a from public.email_accounts where id=p_account;
 for item in select value from jsonb_array_elements(p_messages) loop
  insert into public.email_messages(account_id,user_id,provider_message_id,thread_id,sender,recipients,subject,snippet,body_text,body_html,received_at,dedupe_key,has_attachments,labels)
  values(a.id,a.user_id,item->>'provider_message_id',item->>'thread_id',item->'sender',item->'recipients',item->>'subject',item->>'snippet',item->>'body_text',item->>'body_html',(item->>'received_at')::timestamptz,
  'gmail:'||a.id||':'||(item->>'provider_message_id'),(item->>'has_attachments')::boolean,array(select jsonb_array_elements_text(item->'labels')))
  on conflict(account_id,provider_message_id) do nothing;
  select id into msg from public.email_messages where account_id=a.id and provider_message_id=item->>'provider_message_id';
  insert into public.processing_jobs(message_id,stage) select msg,'ingestion'
  where exists(select 1 from public.email_messages where id=msg and processing_status='RECEIVED')
  on conflict(message_id,stage) do nothing;
 end loop;
 if p_progress ? 'checkpoint' then
  update public.email_accounts set history_id=p_progress->>'checkpoint',last_successful_sync_at=now(),last_error_code=null where id=p_account;
 end if;
 update public.mailbox_sync_jobs set page_offset=coalesce((p_progress->>'page_offset')::int,0),mode=coalesce(p_progress->>'mode',mode),page_token=p_progress->>'page_token',
 baseline=p_progress->>'baseline',start_history_id=p_progress->>'start_history_id',
 status=case when (p_progress->>'done')::boolean and generation=claimed_generation then 'idle' else 'pending' end,
 lease_owner=null,lease_expires_at=null,attempts=0,error_message=null,updated_at=now()
 where account_id=p_account;
end $$;

create or replace function public.strike_claim_jobs(p_owner uuid,p_limit int default 5,p_user uuid default null)
returns setof public.processing_jobs language plpgsql security invoker set search_path='' as $$
begin
 update public.processing_jobs set status='failed',error_code='LEASE_RETRIES_EXHAUSTED',lease_owner=null,lease_expires_at=null
 where status='running' and lease_expires_at<now() and attempts>=3;
 return query update public.processing_jobs j set status='running',lease_owner=p_owner,
 lease_expires_at=now()+interval '2 minutes',last_heartbeat_at=now(),started_at=now(),attempts=j.attempts+1
 where j.id in(select q.id from public.processing_jobs q join public.email_messages m on m.id=q.message_id
 where (p_user is null or m.user_id=p_user) and q.attempts<3
 and ((q.status in ('pending','retrying') and (q.next_retry_at is null or q.next_retry_at<=now())) or (q.status='running' and q.lease_expires_at<now()))
 order by q.created_at for update of q skip locked limit greatest(1,least(p_limit,10))) returning j.*;
end $$;

create or replace function public.strike_finish_job(p_job uuid,p_owner uuid,p_result jsonb)
returns void language plpgsql security invoker set search_path='' as $$
declare j public.processing_jobs; m public.email_messages; a jsonb; s jsonb; d jsonb;
begin
 select * into strict j from public.processing_jobs where id=p_job for update;
 if j.status<>'running' or j.lease_owner is distinct from p_owner or j.lease_expires_at<now() then raise exception 'JOB_LEASE_LOST'; end if;
 select * into strict m from public.email_messages where id=j.message_id;
 a:=p_result->'ai'; s:=p_result->'summary'; d:=p_result->'delivery';
 if a is not null and a<>'null'::jsonb then
 insert into public.ai_results(message_id,category,importance,confidence,reason,model,prompt_version)
 values(m.id,a->>'category',(a->>'importance')::numeric,(a->>'confidence')::numeric,a->>'reason',a->>'model',a->>'prompt_version')
 on conflict(message_id) do nothing;
 end if;
 if s is not null and s<>'null'::jsonb then
 insert into public.summaries(message_id,summary_text,extracted_items,model,prompt_version)
 values(m.id,s->>'summary_text',coalesce(s->'extracted_items','[]'),s->>'model',s->>'prompt_version') on conflict(message_id) do nothing;
 end if;
 if d is not null and d<>'null'::jsonb then
 insert into public.delivery_outbox(message_id,user_id,destination,payload) values(m.id,m.user_id,d->>'destination',d->'payload') on conflict(message_id) do nothing;
 end if;
 if p_result->>'messageStatus' is not null then
 update public.email_messages set processing_status=p_result->>'messageStatus' where id=m.id and processing_status<>'DELIVERED';
 end if;
 update public.processing_jobs set status='completed',result=p_result,completed_at=now(),lease_owner=null,lease_expires_at=null,error_code=null,error_message=null where id=j.id;
 if p_result->>'nextStage' is not null then
 insert into public.processing_jobs(message_id,stage) values(m.id,p_result->>'nextStage') on conflict(message_id,stage) do nothing;
 end if;
end $$;

create or replace function public.strike_claim_delivery(p_owner uuid,p_user uuid default null)
returns setof public.delivery_outbox language plpgsql security invoker set search_path='' as $$
begin
 update public.delivery_outbox d set status=r.status,delivered_at=case when r.status='delivered' then r.occurred_at else d.delivered_at end,error_code=r.error_code from public.delivery_receipts r where d.provider_message_id=r.provider_message_id and d.status in ('sending','unknown','accepted');
 update public.email_messages m set processing_status='DELIVERED' from public.delivery_outbox d where d.message_id=m.id and d.status='delivered' and m.processing_status<>'DELIVERED';
 update public.delivery_outbox set status='unknown',error_code='SEND_INTERRUPTED',lease_owner=null,lease_expires_at=null
 where status='sending' and lease_expires_at<now();
 return query update public.delivery_outbox d set status='sending',lease_owner=p_owner,lease_expires_at=now()+interval '2 minutes',attempts=attempts+1,updated_at=now()
 where d.id=(select q.id from public.delivery_outbox q join public.user_settings s on s.user_id=q.user_id
 where q.status='pending' and (p_user is null or q.user_id=p_user)
 and coalesce((s.notification_preferences->'pipeline'->>'send_whatsapp')::boolean,not coalesce((s.notification_preferences->>'disable_processing')::boolean,false))
 and coalesce((s.notification_preferences->>'notify_on_important')::boolean,true)
 and (s.notification_preferences->>'last_inbound_at')::timestamptz>now()-interval '24 hours'
 order by q.updated_at for update of q skip locked limit 1) returning d.*;
end $$;

create or replace function public.strike_delivery_receipt(p_provider text,p_status text,p_at timestamptz,p_error text default null)
returns void language plpgsql security invoker set search_path='' as $$
declare receipt_status text;
begin
 if p_status not in ('sent','delivered','read','failed') then return; end if;
 receipt_status:=case when p_status in ('delivered','read') then 'delivered' when p_status='sent' then 'accepted' else 'failed' end;
 insert into public.delivery_receipts(provider_message_id,status,occurred_at,error_code) values(p_provider,receipt_status,p_at,p_error)
 on conflict(provider_message_id) do update set status=excluded.status,occurred_at=excluded.occurred_at,error_code=excluded.error_code
 where public.delivery_receipts.status<>'delivered' and (excluded.status='delivered' or excluded.occurred_at>=public.delivery_receipts.occurred_at);
 update public.delivery_outbox d set status=r.status,delivered_at=case when r.status='delivered' then r.occurred_at else d.delivered_at end,
 error_code=r.error_code,updated_at=now() from public.delivery_receipts r where d.provider_message_id=r.provider_message_id and r.provider_message_id=p_provider and d.status<>'delivered';
 update public.email_messages m set processing_status='DELIVERED' from public.delivery_outbox d where d.message_id=m.id and d.provider_message_id=p_provider and d.status='delivered';
end $$;

create or replace function public.strike_accept_delivery(p_id uuid,p_owner uuid,p_provider text)
returns void language plpgsql security invoker set search_path='' as $$
declare r public.delivery_receipts;
begin
 update public.delivery_outbox set status='accepted',provider_message_id=p_provider,accepted_at=now(),lease_owner=null,lease_expires_at=null,updated_at=now()
 where id=p_id and lease_owner=p_owner and status='sending';
 if not found then raise exception 'DELIVERY_LEASE_LOST'; end if;
 select * into r from public.delivery_receipts where provider_message_id=p_provider;
 if found then perform public.strike_delivery_receipt(p_provider,case when r.status='accepted' then 'sent' else r.status end,r.occurred_at,r.error_code); end if;
end $$;

-- Schema access is separate from RLS. No client can execute worker functions.
grant select on public.delivery_outbox to authenticated;
grant all on public.mailbox_sync_jobs,public.delivery_outbox,public.delivery_receipts,public.error_logs to service_role;
do $$ declare f record; begin
 for f in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'strike_%' loop
 execute format('revoke all on function %s from public, anon, authenticated',f.signature);
 execute format('grant execute on function %s to service_role',f.signature);
 end loop;
end $$;

-- Authenticated dashboard aggregates; invoker RLS remains active.
create or replace function public.strike_dashboard_counts() returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_build_object(
 'received',(select count(*) from public.email_messages where user_id=(select auth.uid())),
 'triaged',(select count(*) from public.ai_results a join public.email_messages m on m.id=a.message_id where m.user_id=(select auth.uid()) and a.reason<>'Historical email synced from connected inbox.'),
 'important',(select count(*) from public.ai_results a join public.email_messages m on m.id=a.message_id left join public.user_settings s on s.user_id=m.user_id where m.user_id=(select auth.uid()) and a.reason<>'Historical email synced from connected inbox.' and (a.category='important' or a.importance>=coalesce(s.importance_threshold,0.7))),
 'delivered',(select count(*) from public.email_messages where user_id=(select auth.uid()) and processing_status='DELIVERED'),
 'filtered',(select count(*) from public.email_messages where user_id=(select auth.uid()) and processing_status='DISCARDED'),
 'failed',(select count(*) from public.processing_jobs j join public.email_messages m on m.id=j.message_id where m.user_id=(select auth.uid()) and j.status in ('failed','retrying')),
 'delivery_attention',(select count(*) from public.delivery_outbox where user_id=(select auth.uid()) and status in ('failed','unknown'))
 );
$$;
revoke all on function public.strike_dashboard_counts() from public,anon;
grant execute on function public.strike_dashboard_counts() to authenticated,service_role;

-- Explicit privileges make the checked-in schema reproducible outside project defaults.
grant select,insert,update,delete on public.email_accounts,public.email_messages,public.processing_jobs,public.ai_results,public.summaries,public.delivery_attempts,public.system_events,public.user_settings to service_role;
grant select on public.email_messages,public.processing_jobs,public.ai_results,public.summaries,public.delivery_attempts,public.system_events to authenticated;
grant select,insert,update,delete on public.email_accounts,public.user_settings to authenticated;

-- Recover pre-migration running computation jobs via normal fenced claims.
update public.processing_jobs set lease_expires_at=now()-interval '1 second'
where status='running' and lease_expires_at is null;
-- Repair interrupted insert/queue handoffs without resetting completed work.
insert into public.processing_jobs(message_id,stage)
select id,'ingestion' from public.email_messages where processing_status='RECEIVED'
on conflict(message_id,stage) do nothing;
-- Start durable catch-up for connected mailboxes; disabled receiving is respected by workers.
insert into public.mailbox_sync_jobs(account_id)
select id from public.email_accounts where connection_status='connected'
on conflict(account_id) do nothing;

-- Older code used DELIVERED for API acceptance. Keep only receipt-backed delivery claims.
insert into public.delivery_outbox(message_id,user_id,destination,payload,status,provider_message_id,delivered_at,error_code)
select m.id,m.user_id,coalesce(s.whatsapp_destination,''),'{}'::jsonb,
 case when a.status='delivered' then 'delivered' when a.provider_message_id like 'wamid.%' then 'accepted' else 'unknown' end,
 case when a.provider_message_id like 'wamid.%' then a.provider_message_id else null end,
 a.delivered_at,case when a.status='delivered' then null else 'LEGACY_DELIVERY_UNCONFIRMED' end
from public.email_messages m left join public.user_settings s on s.user_id=m.user_id
left join lateral (select d.status,d.provider_message_id,d.delivered_at from public.delivery_attempts d where d.message_id=m.id order by (d.status='delivered') desc,d.created_at desc limit 1) a on true
where m.processing_status='DELIVERED'
on conflict(message_id) do nothing;
update public.email_messages m set processing_status='DELIVERY_PENDING'
from public.delivery_outbox d where d.message_id=m.id and m.processing_status='DELIVERED' and d.status<>'delivered';
