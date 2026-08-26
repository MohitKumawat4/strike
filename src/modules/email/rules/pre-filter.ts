export type PreFilterDecision = {
  shouldTriage: boolean;
  reason: string;
};

/** Fast, deterministic checks run before any model call. */
export function preFilterEmail(input: {
  senderDomain?: string;
  subject: string;
}): PreFilterDecision {
  if (/unsubscribe|view in browser/i.test(input.subject)) {
    return { shouldTriage: false, reason: "promotional_subject_pattern" };
  }

  return { shouldTriage: true, reason: "requires_triage" };
}
