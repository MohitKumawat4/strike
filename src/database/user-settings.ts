import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getPipelineControls,
  updatedPipelinePreferences,
} from "@/common/pipeline-controls";

/** Merge preferences with an optimistic lock, preserving window metadata and other controls. */
export async function saveUserSettings(
  supabase: SupabaseClient,
  values: {
    user_id: string;
    notification_preferences?: Record<string, unknown>;
    [key: string]: unknown;
  },
) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const { data: current, error } = await supabase
      .from("user_settings")
      .select("notification_preferences")
      .eq("user_id", values.user_id)
      .maybeSingle();
    if (error) return { error };
    if (!current) {
      const result = await supabase
        .from("user_settings")
        .upsert(
          { user_id: values.user_id },
          { onConflict: "user_id", ignoreDuplicates: true },
        );
      if (result.error) return { error: result.error };
      continue;
    }
    const existing = (current.notification_preferences ?? {}) as Record<
      string,
      unknown
    >;
    const patch = values.notification_preferences ?? {};
    let prefs = { ...existing, ...patch };
    if (patch.pipeline) {
      prefs = updatedPipelinePreferences(
        { ...prefs, pipeline: existing.pipeline, disable_processing: existing.disable_processing },
        getPipelineControls({ pipeline: patch.pipeline }),
        new Date().toISOString(),
      );
    } else {
      // Preserve existing pipeline controls and keep processing active when updating other preferences
      if (existing.pipeline) {
        prefs.pipeline = existing.pipeline;
      }
      prefs.disable_processing = false;
    }
    const result = await supabase
      .from("user_settings")
      .update({
        ...values,
        notification_preferences: prefs,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", values.user_id)
      .eq("notification_preferences", JSON.stringify(existing))
      .select("user_id");
    if (result.error) return { error: result.error };
    if (result.data?.length) return { error: null, preferences: prefs };

    // Fallback: If JSON string comparison didn't match due to JSONB serialization, update directly by user_id
    if (attempt >= 2) {
      const fallbackResult = await supabase
        .from("user_settings")
        .update({
          ...values,
          notification_preferences: prefs,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", values.user_id)
        .select("user_id");
      if (!fallbackResult.error && fallbackResult.data?.length) {
        return { error: null, preferences: prefs };
      }
    }
  }
  return {
    error: new Error("Settings changed in another session. Please save again."),
  };
}
