# Pipeline implementation and activation

## Current state

Implementation is local. No production migration or deployment has been performed. Keep the new application release and additive database migration coordinated: the dashboard now requires the new RPCs and tables.

## Activate

1. Back up the target database and validate the migration against staging. Configure `DATABASE_URL` privately in `.env.local` or the deployment secret store; never commit it. Use a connection with migration privileges.
2. Run `npm run db:migrate`. The runner uses a transaction and advisory lock, validates existing baseline tables, applies additive SQL, and stores migration checksums in a private schema. A fresh Supabase database must already supply the standard auth schema and roles.
3. Configure `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`, `META_APP_SECRET`, `GOOGLE_PUBSUB_AUDIENCE` and `GOOGLE_PUBSUB_SERVICE_ACCOUNT_EMAIL`, plus the existing Gmail and WhatsApp integration settings in `.env.example`. Missing authentication configuration fails closed.
4. Configure authenticated Pub/Sub push with the exact endpoint audience and expected service-account email. Keep Meta webhook signature verification enabled.
5. Deploy the application. On Vercel Hobby accounts, daily crons (watch renewal, briefing, cleanup) are registered in `vercel.json`; `/api/cron/worker` runs reactively via Next.js `after()` upon Google Pub/Sub push and manual sync, or via an external scheduler (cron-job.org) hitting `/api/cron/worker` with `CRON_SECRET`.
6. Verify each control through save and hard refresh on both dashboard routes. Import a test email, confirm its date/time, and verify stored ingestion survives a forced AI/delivery failure. Test delivery with a designated recipient only after explicitly enabling it.

The migration preserves saved preferences. It queues existing received messages without duplicate stage jobs and backfills old delivery claims conservatively. It does not automatically resend ambiguous historic deliveries.

## Ownership and recovery

- `gmail.client.ts` is the sole Gmail API gateway. `ingestion/coordinator.ts` owns mailbox normalization, pagination and progress. Triggers enqueue requests through `strike_request_sync`.
- `strike_commit_sync_page` persists email, initial jobs and cursor progress together. Full recovery saves a baseline, consumes pages, then consumes history after that baseline.
- `strike_claim_jobs` and `strike_finish_job` own stage leases and atomic handoffs. Expired computation leases can be reclaimed; exhausted work remains failed for inspection.
- `delivery_outbox` separates send intent from receipt-confirmed delivery. A timeout or interrupted send becomes `unknown`; inspect Meta/provider records before any administrative resolution. There is intentionally no automatic resend for unknown acceptance.
- Pub/Sub acknowledges durable requests, not completed AI/delivery. An unavailable worker leaves queued work visible rather than tying progress to browser tabs.
- Dashboard readers use persisted data and tenant-scoped aggregate counts. Message lists and list-derived analytics are capped at 1,000 loaded emails.

## Validation

- `npm run test:pipeline`: passed.
- `npm run test:database`: passed against actual PostgreSQL semantics using PGlite, including baseline plus additive migration.
- `npx tsc --noEmit`: passed.
- `npm run lint`: passed with 0 errors and 22 existing/style warnings.
- `npm run build -- --webpack`: passed, including TypeScript and generation of all 26 pages. The default Turbopack attempt stalled.
- `git diff --check`: only the pre-existing trailing blank line in `src/app/dashboard/loading.tsx`; unrelated content preserved.
- Live migration, authenticated browser refresh, real provider sends and deployed scheduler: not verified in this environment.
