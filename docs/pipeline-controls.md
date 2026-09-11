# Pipeline controls

Processing has four switches and one Save changes button. New accounts keep the existing defaults: all four switches on. Existing ingestion-only preferences map to receiving on and the other stages off until the user saves new controls.

- **Receive emails:** checked before Google API calls for initial, manual, and history sync. Resuming skips email received before the resume time. Existing stored mail can still finish processing.
- **Filter unwanted emails:** controls the deterministic pre-filter, including Gmail labels, unwanted senders and ignored keywords.
- **Use AI:** off bypasses both triage and summary model calls, including jobs already queued for those stages. Delivery uses a bounded, code-only preview with sender, subject, cleaned text and Gmail link. No fake AI records are written for that path.
- **Send to WhatsApp:** gates alerts, re-engagement templates, scheduled greetings and reply-driven delivery. Resuming sets a cutoff so old emails are not automatically sent. The existing 24-hour messaging-window behavior still applies.

Settings are stored in `user_settings.notification_preferences.pipeline`; no new schema or environment variables are needed. The authenticated `/api/settings/pipeline` endpoint validates all four booleans and uses the signed-in user's ID. Preference updates use optimistic concurrency to preserve WhatsApp window metadata and unrelated settings.

Reply-driven delivery only considers `DELIVERY_PENDING` emails, using the same delivery handler as normal jobs. Concurrent sends claim the message atomically. If a transport error leaves delivery uncertain, the message remains `DELIVERING` instead of being sent again automatically; reconcile its delivery log/provider status before retrying it. Already-started external API requests cannot be recalled by changing a switch.

Run `npm run test:pipeline` for offline backend checks. The suite mocks Google, AI and WhatsApp; it does not send messages or spend API quota.
