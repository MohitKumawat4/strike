export type PreFilterDecision = {
  shouldTriage: boolean;
  reason: string;
};

/** Fast, deterministic checks run before any model call to save AI tokens. */
export function preFilterEmail(input: {
  senderDomain?: string;
  sender?: string;
  subject: string;
  labels?: string[];
  ignoreKeywords?: string[];
}): PreFilterDecision {
  const labels = (input.labels || []).map((l) => l.toUpperCase());

  // 1. Native Gmail Category Filtration (Zero AI tokens used)
  if (labels.includes("CATEGORY_PROMOTIONS")) {
    return { shouldTriage: false, reason: "gmail_promotions_label" };
  }
  if (labels.includes("CATEGORY_SOCIAL")) {
    return { shouldTriage: false, reason: "gmail_social_label" };
  }
  if (labels.includes("SPAM") || labels.includes("TRASH")) {
    return { shouldTriage: false, reason: "gmail_spam_or_trash_label" };
  }

  // 2. User-defined Ignore Keywords matching
  if (input.ignoreKeywords && input.ignoreKeywords.length > 0) {
    const subjectLower = (input.subject || "").toLowerCase();
    for (const kw of input.ignoreKeywords) {
      const trimmed = kw.trim().toLowerCase();
      if (trimmed && subjectLower.includes(trimmed)) {
        return { shouldTriage: false, reason: `user_ignore_keyword:${trimmed}` };
      }
    }
  }

  // 3. Unsubscribe / promotional pattern heuristics
  if (/unsubscribe|view in browser/i.test(input.subject)) {
    return { shouldTriage: false, reason: "promotional_subject_pattern" };
  }

  return { shouldTriage: true, reason: "requires_triage" };
}
