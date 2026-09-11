export type PipelineControls = {
  receive_emails: boolean;
  filter_unwanted: boolean;
  use_ai: boolean;
  send_whatsapp: boolean;
};
export const DEFAULT_PIPELINE: PipelineControls = {
  receive_emails: true,
  filter_unwanted: true,
  use_ai: true,
  send_whatsapp: true,
};
export function getPipelineControls(preferences: unknown): PipelineControls {
  const prefs = (preferences ?? {}) as Record<string, unknown>;
  const saved = (prefs.pipeline ?? {}) as Partial<PipelineControls>;
  const legacy = prefs.disable_processing === true;
  return {
    receive_emails: saved.receive_emails ?? true,
    filter_unwanted: saved.filter_unwanted ?? !legacy,
    use_ai: saved.use_ai ?? !legacy,
    send_whatsapp: saved.send_whatsapp ?? !legacy,
  };
}
export function afterResume(receivedAt: string, cutoff: unknown): boolean {
  if (typeof cutoff !== "string") return true;
  return new Date(receivedAt).getTime() >= new Date(cutoff).getTime();
}
export function updatedPipelinePreferences(
  preferences: Record<string, unknown>,
  controls: PipelineControls,
  now: string,
) {
  const previous = getPipelineControls(preferences);
  return {
    ...preferences,
    disable_processing: false,
    pipeline: controls,
    ...(!previous.receive_emails && controls.receive_emails
      ? { receive_after: now }
      : {}),
    ...(!previous.send_whatsapp && controls.send_whatsapp
      ? { deliver_after: now }
      : {}),
  };
}
