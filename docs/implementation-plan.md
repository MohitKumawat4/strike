# Strike implementation plan

## Purpose

Build a personal, dashboard-first email intelligence product for three Gmail accounts. The MVP collects and processes mail, records every decision, summarizes accepted messages, and displays the complete result in Strike. WhatsApp delivery is deliberately deferred to Phase 9.

## Working assumptions

- All initial accounts are Gmail accounts.
- One person owns the dashboard and connected mailbox data.
- The application never modifies source mailboxes in the MVP.
- The dashboard is the MVP delivery surface; the WhatsApp adapter remains a no-op until Phase 9.
- A Google Cloud project and the existing Supabase project are available.

## Current starting point

- Next.js, TypeScript, Tailwind, Supabase clients, Gmail client library, OpenAI client, and PostgreSQL queue dependencies are installed.
- Module contracts live under `src/modules/` for email, AI, WhatsApp, jobs, accounts, and dashboard data.
- `src/database/migrations/001_initial_schema.sql` is a draft schema only. Do **not** apply it unchanged: Phase 1 moves the migration workflow to Supabase and adds an owner model and usable RLS policies.
- No Gmail OAuth route, Pub/Sub webhook, job worker, AI provider implementation, or dashboard data query exists yet.

## Strict execution order

Do not begin a later phase until its exit criteria are satisfied. The only intentional overlap is UI work with mocked data during Phase 2.

1. Phase 0 — access, decisions, and deployment shape
2. Phase 1 — Supabase foundation and security
3. Phase 2 — authenticated dashboard shell
4. Phase 3 — one Gmail account: OAuth and initial sync
5. Phase 4 — Gmail push ingestion and recovery
6. Phase 5 — durable processing workflow
7. Phase 6 — AI triage and summarization
8. Phase 7 — complete dashboard experience and three-account rollout
9. Phase 8 — hardening and MVP release
10. Phase 9 — WhatsApp delivery

---

## Phase 0 — Access, decisions, and deployment shape

### Tasks

- [ ] Connect Supabase MCP with `read_only=true` and verify the `strike` project is selected before inspecting production data.
- [ ] Link the repository to Supabase CLI and add the standard `supabase/` directory to source control.
- [ ] Choose the always-available execution runtime for queue workers and schedules. A request-only Next.js deployment cannot be the only worker runtime.
- [ ] Choose a domain for production, which fixes the Google OAuth callback URL and Pub/Sub webhook URL.
- [ ] Set the initial policy values: 30-day initial-sync window, important-message threshold, raw-body retention period, and reconciliation interval.
- [ ] Keep the project in Google OAuth testing mode and list the three Gmail addresses as test users.

### Deliverables

- Documented production URL and worker host.
- A local `.env.local` created from `.env.example`; secrets are never committed.
- Supabase MCP has only read access during planning and inspection.

### Exit criteria

- The team can name the public webhook URL and the process that runs daily renewals/reconciliation.
- There is exactly one source of truth for migrations: `supabase/migrations/`.

---

## Phase 1 — Supabase foundation and security

### Tasks

- [ ] Create a new Supabase migration with the CLI; do not hand-name migration timestamps.
- [ ] Model a dashboard owner (`auth.users` relationship) and add `owner_id` to every tenant-owned record, starting with `email_accounts`.
- [ ] Create `email_accounts`, `email_messages`, `processing_jobs`, `ai_results`, `summaries`, `delivery_attempts`, `system_events`, and `user_settings`.
- [ ] Add only the indexes required by dashboard filter and worker queries: account/received time, processing status/received time, pending retry time, and message delivery history.
- [ ] Enable RLS on every `public` table and add explicit owner policies. Service-role access is limited to trusted server routes, workers, and webhooks.
- [ ] Add token encryption at rest using `ENCRYPTION_KEY`; never store Gmail refresh tokens in plaintext or browser storage.
- [ ] Add database access helpers, structured server logging with redacted email content, and error reporting.
- [ ] Add an immutable event/audit writer for ingestion, decisions, retries, failures, and delivery intents.

### Deliverables

- Applied Supabase migration and verified RLS policies.
- A test account can only read its own rows; service-role server code can process work.
- No secret is present in Git history or in a `NEXT_PUBLIC_*` server-secret variable.

### Exit criteria

- Migration is reproducible in a fresh Supabase project.
- RLS tests and a basic database advisor review pass.

---

## Phase 2 — Authenticated dashboard shell

### Tasks

- [ ] Implement Supabase Auth for the personal dashboard owner.
- [ ] Add protected app routes and a shared dashboard layout.
- [ ] Build the initial pages: Overview, Email Accounts, Messages, Message Detail, Processing Health, and Settings.
- [x] Build summary cards, empty states, loading states, dark/light mode, and responsive desktop/tablet layout using mock data.
- [ ] Establish a server-side dashboard query layer; browser components must not import Gmail, OpenAI, Pub/Sub, or service-role code.
- [ ] Add the Gmail account connection entry point, initially disabled until Phase 3 is ready.

### Exit criteria

- An unauthenticated visitor cannot view email dashboard routes.
- The dashboard shell is complete enough to receive real account and message data without redesign.

---

## Phase 3 — Gmail OAuth and initial synchronization (one account)

### Google Cloud setup

- [ ] Create/select the Strike Google Cloud project.
- [ ] Enable Gmail API and Cloud Pub/Sub API.
- [ ] Configure OAuth consent screen and add the three Gmail addresses as test users.
- [ ] Create a **Web application** OAuth client.
- [ ] Add the local and production callback URLs:

  ```text
  http://localhost:3000/api/auth/google/callback
  https://<production-domain>/api/auth/google/callback
  ```

- [ ] Request only `https://www.googleapis.com/auth/gmail.readonly`.

### Application tasks

- [ ] Implement `GET /api/auth/google/start`.
  - Generate a unique, cryptographically secure OAuth `state` value.
  - Store state with a short expiry in an encrypted HTTP-only cookie or database record.
  - Request `access_type=offline`, `include_granted_scopes=true`, and the Gmail readonly scope.
- [ ] Implement `GET /api/auth/google/callback`.
  - Validate and consume OAuth state before exchanging the code.
  - Exchange the authorization code only on the server.
  - Fetch Gmail profile data to identify the selected mailbox.
  - Encrypt and store the refresh token, granted scopes, and provider user ID.
  - Do not mark the account connected until initial sync succeeds.
- [ ] Implement a bounded initial sync for one account.
  - Use a configurable historical window (default: 30 days).
  - Fetch metadata plus a normalized/sanitized message body.
  - Create a durable dedupe key before creating message jobs.
  - Record received and ingested timestamps separately.
- [ ] Build the account detail UI: connection state, last sync, Gmail address, last error, and disconnect/reconnect action.

### Exit criteria

- One test Gmail account can connect, survive access-token expiry via its encrypted refresh token, and display imported messages in the dashboard.
- Revoking consent marks the account unhealthy and provides a clear reconnect action.

---

## Phase 4 — Gmail push ingestion, renewal, and reconciliation

### Google Cloud setup

- [ ] Create topic `projects/<GOOGLE_CLOUD_PROJECT_ID>/topics/gmail-events`.
- [ ] Grant Pub/Sub Publisher to `gmail-api-push@system.gserviceaccount.com` on that topic.
- [ ] Create a push subscription targeting `https://<production-domain>/api/webhooks/google/pubsub`.
- [ ] Configure authenticated push delivery and verify the expected audience at the webhook.

### Application tasks

- [ ] Implement Gmail `users.watch` for the `INBOX` label after initial sync; persist its `historyId` and expiration.
- [ ] Implement `POST /api/webhooks/google/pubsub`.
  - Verify the push identity before trusting the body.
  - Decode Base64URL `message.data` into `{ emailAddress, historyId }`.
  - Persist/queue work idempotently and return success promptly.
- [ ] Worker: call Gmail `history.list` from the stored history cursor, deduplicate message IDs, then fetch only newly relevant messages.
- [ ] Handle Gmail history `404` by scheduling a safe full reconciliation from the configured historical window.
- [ ] Run watch renewal daily; watches must be renewed before expiry.
- [ ] Run periodic reconciliation even while push is healthy, because push notifications can be delayed or dropped.

### Exit criteria

- A new inbox email appears in Strike without manual refresh.
- Repeated Pub/Sub messages do not create duplicate email rows or jobs.
- Renewal, delayed webhook, invalid history cursor, and OAuth revocation are observable and recoverable.

---

## Phase 5 — Durable processing workflow

### Tasks

- [ ] Register durable jobs for `ingestion`, `pre_filter`, `triage`, `summary`, and `delivery`.
- [ ] Implement legal state transitions:

  ```text
  RECEIVED → PRE_FILTERED → TRIAGED → DISCARDED
                                      ↘ SUMMARIZING → SUMMARY_READY → DELIVERY_PENDING
  ```

- [ ] Add retry policies with exponential backoff, attempt caps, idempotency keys, and failure reasons.
- [ ] Add deterministic pre-filter rules before any model call: duplicate, blocked sender/domain, unsubscribe/newsletter patterns, and configured rules.
- [ ] Store every transition and error as a `system_event`.
- [ ] Add delayed/SLA detection and queue depth/age metrics.

### Exit criteria

- Every incoming message has exactly one auditable processing outcome.
- Temporary Gmail, AI, or worker failures retry without duplicate processing.

---

## Phase 6 — AI triage and summarization

### Tasks

- [ ] Implement an OpenAI provider adapter behind `AiProvider`; keep the provider replaceable.
- [ ] Remove unnecessary headers, signatures, quoted threads, and unsafe HTML before model input.
- [ ] Make a single low-cost structured triage request that returns category, importance, confidence, and reason; validate with `triageResultSchema`.
- [ ] Store model name, prompt version, input/output tokens, and estimated cost per triage.
- [ ] Apply the configured importance threshold; discarded messages receive no summary request.
- [ ] Generate summary and optional extracted tasks/deadlines only for accepted messages.
- [ ] Add fixtures and evaluations for promotional mail, spam, bills, deadlines, travel, and personally important senders.

### Exit criteria

- No discarded email incurs summary cost.
- Malformed AI output fails safely, retries or falls back according to policy, and is visible in the dashboard.

---

## Phase 7 — Dashboard completion and three-account rollout

### Tasks

- [ ] Replace mock data with normalized Supabase-backed queries.
- [ ] Add filters for date range, Gmail account, decision, delivery state, sender/domain, subject, and importance.
- [ ] Complete message detail: normalized content, summary, extracted data, AI decision, delivery intent, retries/errors, and event timeline.
- [ ] Add account health and processing health views.
- [ ] Add visual refinement: polished loading transitions, reduced-motion support, keyboard navigation, readable data density, and tablet layout.
- [ ] Connect second and third Gmail accounts and verify their independent OAuth tokens, watches, cursors, and metrics.

### Exit criteria

- All three accounts ingest independently.
- The dashboard makes it possible to understand a message and its processing history without routinely opening Gmail.

---

## Phase 8 — Hardening and MVP release

### Tasks

- [ ] Add unit tests for parsing, state transitions, pre-filtering, deduplication, encryption, and AI-schema validation.
- [ ] Add integration tests for OAuth callback, webhook authentication, Gmail history recovery, retries, and RLS policies.
- [ ] Add end-to-end test for one connected test Gmail account.
- [ ] Configure error monitoring, latency alerts, stuck-job alerts, and daily watch-expiry alerting.
- [ ] Implement raw-body retention/deletion and account disconnect/revocation cleanup.
- [ ] Run security review: secrets, server/client boundary, RLS, webhook verification, log redaction, and rate limits.
- [ ] Document backup, restore, and incident response steps.

### MVP release gate

- [ ] Three Gmail accounts connect and renew watches.
- [ ] New messages are deduplicated, triaged, and auditable.
- [ ] Important messages are summarized; discarded messages are visible but not summarized.
- [ ] Dashboard metrics match underlying data.
- [ ] Failed, delayed, and retried work is visible and recoverable.

---

## Phase 9 — WhatsApp delivery (after MVP)

### Tasks

- [ ] Keep `NoopDeliveryChannel` for MVP and persist a `skipped` delivery intent for accepted messages.
- [ ] Create Meta/WhatsApp Cloud API configuration only after summary quality and notification volume are validated.
- [ ] Implement a Meta delivery adapter behind `DeliveryChannel`.
- [ ] Use per-message idempotency keys and persist provider message IDs, attempts, sent/delivered/failed timestamps, and webhook status updates.
- [ ] Decide message format, one-message-per-email vs digest, and template requirements before enabling sends.

### Exit criteria

- Retries never create duplicate WhatsApp notifications.
- Email ingestion and summarization continue working when WhatsApp is disabled or unavailable.

---

## Gmail connection checklist

Use this checklist when implementing Phase 3 and Phase 4:

- [ ] Google Cloud project, Gmail API, and Pub/Sub API enabled.
- [ ] OAuth Web client and both callback URLs configured.
- [ ] Gmail test accounts added to OAuth consent configuration.
- [ ] `gmail.readonly` requested; no Gmail write or send scope requested.
- [ ] Unique OAuth state generated and validated on callback.
- [ ] Offline access requested; refresh token encrypted at rest.
- [ ] Initial bounded sync succeeds before account is marked connected.
- [ ] Gmail `watch` is scoped to `INBOX`; history ID and expiration persisted.
- [ ] Gmail publishing service account can publish to the Pub/Sub topic.
- [ ] Pub/Sub webhook verifies its caller, acknowledges quickly, and queues idempotent work.
- [ ] Daily watch renewal and periodic reconciliation are enabled.
- [ ] Account disconnect stops the Gmail watch and deletes/revokes stored credentials according to retention policy.

## Reference documentation

- Gmail push notifications and watch renewal: <https://developers.google.com/workspace/gmail/api/guides/push>
- Gmail synchronization and history recovery: <https://developers.google.com/workspace/gmail/api/guides/sync>
- Google OAuth web-server flow: <https://developers.google.com/identity/protocols/oauth2/web-server>
- Gmail OAuth scopes: <https://developers.google.com/workspace/gmail/api/auth/scopes>
- Supabase MCP: <https://supabase.com/docs/guides/ai-tools/mcp>
