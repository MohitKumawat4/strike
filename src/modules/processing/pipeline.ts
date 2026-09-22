import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { logLayerError, type ExecutionLayer } from "@/common/logging/layer-logger";
import { executeIngestionStage, executePreFilterStage, executeTriageStage, executeSummaryStage, executeDeliveryStage, type EmailMessageRecord } from "./stages";
export type ProcessingJobRecord = {
    id: string;
    message_id: string;
    stage: "ingestion" | "pre_filter" | "triage" | "summary" | "delivery";
    status: string;
    attempts: number;
    lease_owner: string;
};
const handlers = { ingestion: executeIngestionStage, pre_filter: executePreFilterStage, triage: executeTriageStage, summary: executeSummaryStage, delivery: executeDeliveryStage };
export async function claimNextJobs(db: SupabaseClient, limit = 5, userId?: string): Promise<ProcessingJobRecord[]> {
    const { data, error } = await db.rpc("strike_claim_jobs", { p_owner: randomUUID(), p_limit: limit, p_user: userId ?? null });
    if (error)
        throw error;
    return data || [];
}
export async function processSingleJob(db: SupabaseClient, job: ProcessingJobRecord) {
    let userId: string | undefined;
    // Heartbeats are fenced by the claim token. An expired worker cannot commit outputs.
    const heartbeat = setInterval(() => { void db.from("processing_jobs").update({ lease_expires_at: new Date(Date.now() + 120000).toISOString(), last_heartbeat_at: new Date().toISOString() }).eq("id", job.id).eq("lease_owner", job.lease_owner).eq("status", "running").gt("lease_expires_at", new Date().toISOString()).then(({ error }) => { if (error)
        console.error("Job heartbeat failed", job.id); }); }, 30000);
    try {
        const { data: message, error } = await db.from("email_messages").select("*").eq("id", job.message_id).single();
        if (error)
            throw error;
        if (!message)
            throw new Error("MESSAGE_NOT_FOUND");
        userId = message.user_id;
        const handler = handlers[job.stage];
        if (!handler)
            throw new Error("UNKNOWN_STAGE");
        const result = await handler(db, message as EmailMessageRecord);
        if (!result.success)
            throw new Error(result.error || "STAGE_FAILED");
        const { error: finishError } = await db.rpc("strike_finish_job", { p_job: job.id, p_owner: job.lease_owner, p_result: result });
        if (finishError)
            throw finishError;
        return { success: true, stage: job.stage, nextStage: result.nextStage };
    }
    catch (error) {
        const message = error instanceof Error ? error.message : JSON.stringify(error);
        const { error: writeError } = await db.from("processing_jobs").update({ status: job.attempts >= 3 ? "failed" : "retrying", next_retry_at: new Date(Date.now() + Math.min(300000, 15000 * 2 ** job.attempts)).toISOString(), error_code: "STAGE_FAILED", error_message: message, lease_owner: null, lease_expires_at: null }).eq("id", job.id).eq("lease_owner", job.lease_owner);
        if (writeError)
            throw writeError;
        const layer: ExecutionLayer = job.stage === "pre_filter" ? "filtration" : job.stage === "summary" ? "summarization" : job.stage;
        await logLayerError({ layer, userId, messageId: job.message_id, jobId: job.id, errorCode: "STAGE_FAILED", errorMessage: message, severity: job.attempts >= 3 ? "error" : "warning", supabaseClient: db });
        return { success: false, stage: job.stage, error: message };
    }
    finally {
        clearInterval(heartbeat);
    }
}
export async function runProcessingBatch(db: SupabaseClient, maxBatchSize = 5, maxPasses = 1, userId?: string) {
    let processed = 0, succeeded = 0, failed = 0;
    for (let pass = 0; pass < maxPasses; pass++) {
        const jobs = await claimNextJobs(db, maxBatchSize, userId);
        if (!jobs.length)
            break;
        const results = await Promise.allSettled(jobs.map(job => processSingleJob(db, job)));
        for (const result of results) {
            processed++;
            if (result.status === "fulfilled" && result.value.success)
                succeeded++;
            else
                failed++;
        }
    }
    return { processed, succeeded, failed };
}
export async function logSystemEvent(db: SupabaseClient, event: {
    event_type: string;
    severity: string;
    payload: Record<string, unknown>;
}) {
    const { error } = await db.from("system_events").insert({ ...event, entity_type: "system", entity_id: randomUUID() });
    if (error)
        console.error("System event could not be saved", error.code);
}
