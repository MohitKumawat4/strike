import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { gmail_v1 } from "googleapis";
import { getPipelineControls, afterResume } from "@/common/pipeline-controls";
import { createGmailGateway } from "../providers/gmail/gmail.client";
import { isGmailNotFound } from "../providers/gmail/gmail.errors";
import { decodeHtmlEntities, extractCleanEmailContent } from "./email-content";
import { logLayerError } from "@/common/logging/layer-logger";
export async function requestMailboxSync(db: SupabaseClient, accountId: string) {
    const { error } = await db.rpc("strike_request_sync", { p_account: accountId });
    if (error)
        throw error;
}
export function normalizeGmailMessage(m: gmail_v1.Schema$Message) {
    const header = (name: string) => m.payload?.headers?.find(h => h.name?.toLowerCase() === name.toLowerCase())?.value || "";
    const snippet = decodeHtmlEntities(m.snippet || "");
    const body = extractCleanEmailContent(m.payload, snippet);
    const attachments = (part: gmail_v1.Schema$MessagePart): boolean => Boolean(part.filename) || Boolean(part.parts?.some(attachments));
    return { provider_message_id: m.id, thread_id: m.threadId || null, sender: { raw: decodeHtmlEntities(header("From")) }, recipients: [{ raw: header("To") }], subject: decodeHtmlEntities(header("Subject") || "(No Subject)"), snippet, body_text: body.bodyText, body_html: body.bodyHtml || null, received_at: new Date(Number(m.internalDate) || Date.parse(header("Date")) || Date.now()).toISOString(), has_attachments: m.payload ? attachments(m.payload) : false, labels: m.labelIds || [] };
}
/** One durable page per claim; every trigger uses this coordinator. */
export async function runMailboxSyncPage(db: SupabaseClient, userId?: string) {
    const owner = randomUUID();
    const { data: jobs, error } = await db.rpc("strike_claim_sync", { p_owner: owner, p_user: userId ?? null });
    if (error)
        throw error;
    const job = jobs?.[0];
    if (!job)
        return { processed: 0 };
    let account: {
        id: string;
        user_id: string;
        email_address: string;
        encrypted_refresh_token: string;
        history_id: string | null;
    } | undefined;
    try {
        const accountResult = await db.from("email_accounts").select("id,user_id,email_address,encrypted_refresh_token,history_id").eq("id", job.account_id).single();
        if (accountResult.error)
            throw accountResult.error;
        account = accountResult.data;
        if (!account)
            throw new Error("ACCOUNT_NOT_FOUND");
        const { data: settings, error: settingsError } = await db.from("user_settings").select("notification_preferences").eq("user_id", account.user_id).maybeSingle();
        if (settingsError)
            throw settingsError;
        const prefs = settings?.notification_preferences || {};
        if (!getPipelineControls(prefs).receive_emails) {
            await db.from("mailbox_sync_jobs").update({ status: "idle", lease_owner: null, lease_expires_at: null }).eq("account_id", account.id).eq("lease_owner", owner).throwOnError();
            return { processed: 0, paused: true };
        }
        const gmail = createGmailGateway(account.encrypted_refresh_token);
        const profile = (await gmail.getProfile()).data;
        if (profile.emailAddress?.toLowerCase() !== account.email_address.toLowerCase())
            throw new Error("MAILBOX_IDENTITY_MISMATCH");
        let mode = job.mode;
        let baseline = job.baseline;
        let start = job.start_history_id;
        let page = job.page_token;
        if (mode === "initial") {
            mode = account.history_id ? "history" : "full";
            start = account.history_id;
            baseline = profile.historyId;
            page = null;
        }
        let ids: string[] = [];
        let next: string | null = null;
        let checkpoint: string | null = null;
        if (mode === "history") {
            try {
                const response = await gmail.listHistory(start, page || undefined);
                ids = [...new Set((response.data.history || []).flatMap(h => (h.messagesAdded || []).flatMap(a => a.message?.id ? [a.message.id] : [])))];
                next = response.data.nextPageToken || null;
                checkpoint = response.data.historyId || start;
            }
            catch (error) {
                if (!isGmailNotFound(error))
                    throw error;
                mode = "full";
                baseline = profile.historyId;
                page = null;
            }
        }
        if (mode === "full") {
            if (!baseline)
                throw new Error("MISSING_HISTORY_BASELINE");
            const response = await gmail.listMessages(10, page || undefined);
            ids = (response.data.messages || []).flatMap(m => m.id ? [m.id] : []);
            next = response.data.nextPageToken || null;
        }
        const offset = mode === job.mode ? job.page_offset || 0 : 0;
        const moreInPage = ids.length > offset + 10;
        ids = ids.slice(offset, offset + 10);
        const messages = [];
        let missing = 0;
        // Small pages bound request runtime. A failed page is replayed without changing its cursor.
        const fetched = await Promise.all(ids.map(id => gmail.getMessage(id)));
        for (const { data: m } of fetched) {
            if (!m?.id) {
                missing++;
                continue;
            }
            const normalized = normalizeGmailMessage(m);
            if (afterResume(normalized.received_at, prefs.receive_after))
                messages.push(normalized);
        }
        let progress: Record<string, unknown> = { mode, page_token: next, baseline, start_history_id: start, done: false };
        if (moreInPage) {
            progress.page_token = page;
            progress.page_offset = offset + 10;
        }
        else if (!next) {
            progress = mode === "full" ? { mode: "history", page_token: null, baseline: null, start_history_id: baseline, done: false } : { mode: "initial", page_token: null, baseline: null, start_history_id: null, checkpoint, done: true };
        }
        const { error: commitError } = await db.rpc("strike_commit_sync_page", { p_account: account.id, p_owner: owner, p_messages: messages, p_progress: progress });
        if (commitError)
            throw commitError;
        if (missing)
            await logLayerError({ layer: "ingestion", severity: "warning", userId: account.user_id, accountId: account.id, errorCode: "GMAIL_MESSAGES_UNAVAILABLE", errorMessage: `${missing} messages were unavailable during import.`, technicalDetails: { operation: "messages.get", httpStatus: 404, count: missing, correlationId: owner }, supabaseClient: db });
        return { processed: messages.length, missing };
    }
    catch (error) {
        const message = error instanceof Error ? error.message : JSON.stringify(error);
        const attempts = job.attempts + 1;
        await db.from("mailbox_sync_jobs").update({ status: attempts >= 5 ? "failed" : "pending", attempts, next_retry_at: new Date(Date.now() + Math.min(300000, 15000 * 2 ** attempts)).toISOString(), error_message: message, lease_owner: null, lease_expires_at: null }).eq("account_id", job.account_id).eq("lease_owner", owner).throwOnError();
        await logLayerError({ layer: "ingestion", severity: "error", userId: account?.user_id, accountId: job.account_id, errorCode: "MAILBOX_SYNC_FAILED", errorMessage: message, technicalDetails: { mode: job.mode, correlationId: owner, retryable: attempts < 5 }, supabaseClient: db });
        return { processed: 0, error: message };
    }
}
