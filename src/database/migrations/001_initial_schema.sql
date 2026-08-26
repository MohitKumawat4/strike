-- =========================================================================
-- Strike Core Database Schema Migration
-- Managed PostgreSQL schema with user isolation, indexing, and RLS policies
-- =========================================================================

-- Extension for UUID generation
create extension if not exists pgcrypto;

-- 1. email_accounts (Connected user Gmail mailboxes)
create table if not exists email_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider in ('gmail')),
  email_address text not null,
  provider_user_id text,
  encrypted_refresh_token text not null,
  granted_scopes text[] not null default '{}',
  history_id text,
  watch_expiration timestamptz,
  last_successful_sync_at timestamptz,
  connection_status text not null default 'connected'
    check (connection_status in ('pending', 'connected', 'unhealthy', 'disconnected')),
  last_error_code text,
  last_error_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, provider, email_address)
);

-- 2. email_messages (Ingested emails and parsing state)
create table if not exists email_messages (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references email_accounts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  provider_message_id text not null,
  thread_id text,
  sender jsonb not null default '{}'::jsonb,
  recipients jsonb not null default '[]'::jsonb,
  subject text not null default '',
  snippet text,
  body_text text,
  body_html text,
  received_at timestamptz not null,
  ingested_at timestamptz not null default now(),
  dedupe_key text not null,
  has_attachments boolean not null default false,
  processing_status text not null default 'RECEIVED'
    check (processing_status in (
      'RECEIVED', 'PRE_FILTERED', 'TRIAGED', 'DISCARDED', 'SUMMARIZING',
      'SUMMARY_READY', 'DELIVERY_PENDING', 'DELIVERING', 'DELIVERED',
      'FAILED', 'DELAYED'
    )),
  created_at timestamptz not null default now(),
  unique (account_id, provider_message_id),
  unique (dedupe_key)
);

-- 3. processing_jobs (Background worker job queue and status tracking)
create table if not exists processing_jobs (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references email_messages(id) on delete cascade,
  stage text not null check (stage in ('ingestion', 'pre_filter', 'triage', 'summary', 'delivery')),
  status text not null default 'pending' check (status in ('pending', 'running', 'completed', 'failed', 'retrying')),
  attempts integer not null default 0 check (attempts >= 0),
  next_retry_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  error_code text,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 4. ai_results (AI importance classification and category reasoning)
create table if not exists ai_results (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null unique references email_messages(id) on delete cascade,
  category text not null check (category in ('important', 'normal', 'spam', 'promotional')),
  importance numeric(3, 2) not null check (importance between 0 and 1),
  confidence numeric(3, 2) not null check (confidence between 0 and 1),
  reason text not null,
  model text not null,
  prompt_version text not null,
  input_tokens integer,
  output_tokens integer,
  triaged_at timestamptz not null default now()
);

-- 5. summaries (Concise AI summaries and extracted action items)
create table if not exists summaries (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null unique references email_messages(id) on delete cascade,
  summary_text text not null,
  extracted_items jsonb not null default '[]'::jsonb,
  model text not null,
  prompt_version text not null,
  created_at timestamptz not null default now()
);

-- 6. delivery_attempts (Delivery log and webhook dispatch records)
create table if not exists delivery_attempts (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references email_messages(id) on delete cascade,
  channel text not null default 'whatsapp',
  provider_message_id text,
  idempotency_key text not null unique,
  status text not null default 'pending'
    check (status in ('pending', 'sending', 'delivered', 'failed', 'skipped')),
  attempt_no integer not null default 1,
  error_code text,
  sent_at timestamptz,
  delivered_at timestamptz,
  failed_at timestamptz,
  created_at timestamptz not null default now()
);

-- 7. system_events (Immutable audit events and system logs)
create table if not exists system_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  event_type text not null,
  entity_type text not null,
  entity_id uuid not null,
  severity text not null default 'info' check (severity in ('info', 'warning', 'error')),
  payload jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);

-- 8. user_settings (Per-user preferences, threshold, and notification config)
create table if not exists user_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique not null references auth.users(id) on delete cascade,
  whatsapp_destination text,
  importance_threshold numeric(3, 2) not null default 0.70,
  raw_body_retention_days integer default 30,
  notification_preferences jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Performance Indexes
create index if not exists email_accounts_user_idx on email_accounts (user_id);
create index if not exists email_messages_account_received_idx on email_messages (account_id, received_at desc);
create index if not exists email_messages_user_received_idx on email_messages (user_id, received_at desc);
create index if not exists email_messages_status_received_idx on email_messages (processing_status, received_at desc);
create index if not exists processing_jobs_pending_idx on processing_jobs (status, next_retry_at);
create index if not exists delivery_attempts_message_idx on delivery_attempts (message_id, created_at desc);
create index if not exists system_events_user_idx on system_events (user_id, occurred_at desc);

-- Enable Row Level Security (RLS) on all tables
alter table email_accounts enable row level security;
alter table email_messages enable row level security;
alter table processing_jobs enable row level security;
alter table ai_results enable row level security;
alter table summaries enable row level security;
alter table delivery_attempts enable row level security;
alter table system_events enable row level security;
alter table user_settings enable row level security;

-- Row Level Security Policies for Authenticated Dashboard Users
create policy "Users can manage their own email accounts"
  on email_accounts for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "Users can view their own email messages"
  on email_messages for select
  to authenticated
  using (user_id = auth.uid());

create policy "Users can view AI results for their messages"
  on ai_results for select
  to authenticated
  using (exists (
    select 1 from email_messages
    where email_messages.id = ai_results.message_id
      and email_messages.user_id = auth.uid()
  ));

create policy "Users can view summaries for their messages"
  on summaries for select
  to authenticated
  using (exists (
    select 1 from email_messages
    where email_messages.id = summaries.message_id
      and email_messages.user_id = auth.uid()
  ));

create policy "Users can view processing jobs for their messages"
  on processing_jobs for select
  to authenticated
  using (exists (
    select 1 from email_messages
    where email_messages.id = processing_jobs.message_id
      and email_messages.user_id = auth.uid()
  ));

create policy "Users can view delivery attempts for their messages"
  on delivery_attempts for select
  to authenticated
  using (exists (
    select 1 from email_messages
    where email_messages.id = delivery_attempts.message_id
      and email_messages.user_id = auth.uid()
  ));

create policy "Users can view their own system events"
  on system_events for select
  to authenticated
  using (user_id = auth.uid());

create policy "Users can manage their own user settings"
  on user_settings for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

