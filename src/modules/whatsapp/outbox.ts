import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getPipelineControls, afterResume } from "@/common/pipeline-controls";
import { sendStrikeEmailAlert, type StrikeEmailAlertParams, WhatsAppHttpError } from "./whatsapp";
export function providerMessageId(result: unknown): string | null {
    const r = result as {
        messages?: {
            id?: string;
        }[];
        meta_response?: {
            messages?: {
                id?: string;
            }[];
        };
    } | null;
    return r?.meta_response?.messages?.[0]?.id || r?.messages?.[0]?.id || null;
}
/** Uncertain sends are never automatically retried. Provider receipts reconcile them. */
export async function runDeliveryOutbox(db: SupabaseClient, userId?: string) {
    const owner = randomUUID();
    const { data, error } = await db.rpc("strike_claim_delivery", { p_owner: owner, p_user: userId ?? null });
    if (error)
        throw error;
    const item = data?.[0];
    if (!item)
        return { processed: 0 };
    let attempted = false;
    let provider: string | null = null;
    try {
        const { data: s, error: settingsError } = await db.from("user_settings").select("notification_preferences,whatsapp_destination").eq("user_id", item.user_id).single();
        if (settingsError)
            throw settingsError;
        const { data: m, error: messageError } = await db.from("email_messages").select("received_at").eq("id", item.message_id).single();
        if (messageError)
            throw messageError;
        const prefs = s.notification_preferences || {};
        if (!getPipelineControls(prefs).send_whatsapp || prefs.notify_on_important === false || s.whatsapp_destination !== item.destination || !afterResume(m.received_at, prefs.deliver_after) || Date.now() - Date.parse(m.received_at) > 86400000) {
            await db.from("delivery_outbox").update({ status: "skipped", error_code: "DELIVERY_POLICY_CHANGED", lease_owner: null, lease_expires_at: null }).eq("id", item.id).eq("lease_owner", owner).throwOnError();
            return { processed: 1, skipped: true };
        }
        attempted = true;
        const result = await sendStrikeEmailAlert(item.payload as StrikeEmailAlertParams);
        provider = providerMessageId(result);
        if (!provider)
            throw new Error("PROVIDER_ACCEPTANCE_ID_MISSING");
        const { error: acceptError } = await db.rpc("strike_accept_delivery", { p_id: item.id, p_owner: owner, p_provider: provider });
        if (acceptError)
            throw acceptError;
        return { processed: 1, accepted: true };
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const rejected = error instanceof WhatsAppHttpError && error.status >= 400 && error.status < 500;
        const paused = message === "WHATSAPP_PAUSED";
        await db.from("delivery_outbox").update({ status: paused ? "skipped" : !attempted ? "pending" : rejected ? "failed" : "unknown", error_code: paused ? "WHATSAPP_PAUSED" : rejected ? "PROVIDER_REJECTED" : "SEND_OUTCOME_UNKNOWN", error_message: message, ...(provider ? { provider_message_id: provider } : {}), lease_owner: null, lease_expires_at: null }).eq("id", item.id).eq("lease_owner", owner).throwOnError();
        return { processed: 1, error: message };
    }
}
