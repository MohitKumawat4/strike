import { generateStructuredAiJson } from "../ai.client";
import { decodeHtmlEntities } from "@/modules/email/ingestion/initial-sync";

export const TRIAGE_PROMPT_VERSION = "2026.09.single-pass";

export type UserCustomPriorityRules = {
  instructions?: string;
  vipSenders?: string[];
  ignoreKeywords?: string[];
};

export type TriageInput = {
  subject: string;
  sender: string;
  recipient?: string;
  snippet?: string;
  bodyText?: string;
  userCustomRules?: UserCustomPriorityRules;
};

export type ExtractedActionItem = {
  action: string;
  deadline?: string;
  assignee?: string;
};

export type TriageResult = {
  category: "important" | "normal" | "promotional" | "spam";
  importance: number;
  confidence: number;
  reason: string;
  summary_text?: string;
  extracted_items?: ExtractedActionItem[];
};

function cleanSummaryOutputText(text: string): string {
  if (!text) return "";
  let cleaned = decodeHtmlEntities(text).trim();
  cleaned = cleaned.replace(/^(Executive\s+summary|Summary|Key\s+takeaways?|Brief):\s*/i, "");
  return cleaned;
}

/**
 * Builds the AI prompt instructions for single-pass classification, scoring,
 * and executive summary generation, incorporating user-defined VIP and custom rules.
 */
export function buildTriagePrompt(input: TriageInput): { systemPrompt: string; userPrompt: string } {
  let customInstructionsSection = "";
  if (input.userCustomRules) {
    const { instructions, vipSenders, ignoreKeywords } = input.userCustomRules;
    const rulesList: string[] = [];

    if (instructions && instructions.trim()) {
      rulesList.push(`- USER EXPLICIT PRIORITY GUIDANCE: ${instructions.trim()}`);
    }
    if (vipSenders && vipSenders.length > 0) {
      rulesList.push(`- VIP SENDER DOMAINS/ADDRESSES (Always score ≥ 0.85 Important): ${vipSenders.join(", ")}`);
    }
    if (ignoreKeywords && ignoreKeywords.length > 0) {
      rulesList.push(`- USER IGNORE / LOW-PRIORITY PATTERNS (Score < 0.30): ${ignoreKeywords.join(", ")}`);
    }

    if (rulesList.length > 0) {
      customInstructionsSection = `\n\nUSER-DEFINED CUSTOM TRIAGE PREFERENCES (STRICT PRIORITY):\n${rulesList.join("\n")}`;
    }
  }

  const systemPrompt = `You are Strike AI, an elite email triage & briefing assistant.
Your task is to analyze incoming emails in a single pass to:
1. Classify them into one of four categories:
   - "important" — Time-sensitive requests, invoices, payments, client contracts, critical system alerts, schedule invites, or urgent communications.
   - "normal" — General professional correspondence, personal discussions, standard non-urgent replies.
   - "promotional" — Marketing newsletters, product discounts, coupons, company announcements, promotional digests.
   - "spam" — Unsolicited bulk marketing, scam attempts, phishing, unwanted junk.${customInstructionsSection}
2. Provide a crisp 2-3 sentence executive summary explaining what the email is about and what is needed.
3. Extract any specific actionable tasks or to-dos with deadlines.

Output valid JSON matching this schema:
{
  "category": "important" | "normal" | "promotional" | "spam",
  "importance": number, // 0.00 to 1.00 (e.g. 0.95 for urgent/time-critical/VIP, 0.10 for spam/promo)
  "confidence": number, // 0.00 to 1.00
  "reason": string, // 1-2 sentence justification for the classification
  "summary_text": string, // Direct 2-3 sentence executive brief (do not prefix with "Summary:")
  "extracted_items": [
    {
      "action": string, // Specific action item or task required
      "deadline": string, // Mentioned deadline or "None"
      "assignee": string // Person responsible or "You"
    }
  ]
}`;

  const userPrompt = `Analyze the following email:
From: ${input.sender}
To: ${input.recipient || "User"}
Subject: ${input.subject}
Preview Snippet: ${input.snippet || "(No snippet)"}

Message Content:
${(input.bodyText || input.snippet || "").slice(0, 1800)}

Respond with JSON only.`;

  return { systemPrompt, userPrompt };
}

/**
 * Evaluates an email using AI structured JSON generation in a single pass,
 * generating classification, importance score, executive brief, and action items.
 */
export async function triageEmailWithAi(
  params: TriageInput
): Promise<{
  result: TriageResult;
  model: string;
  promptVersion: string;
  inputTokens?: number;
  outputTokens?: number;
}> {
  const { systemPrompt, userPrompt } = buildTriagePrompt(params);

  try {
    const aiResponse = await generateStructuredAiJson<{
      category: "important" | "normal" | "promotional" | "spam";
      importance: number;
      confidence: number;
      reason: string;
      summary_text?: string;
      extracted_items?: Array<{
        action?: string;
        deadline?: string;
        assignee?: string;
      }>;
    }>({
      systemPrompt,
      userPrompt,
      responseSchemaName: "EmailTriageAndSummaryResult",
    });

    const validCategories = ["important", "normal", "spam", "promotional"] as const;
    const category = validCategories.includes(aiResponse.data.category)
      ? aiResponse.data.category
      : "normal";

    const importance = Math.max(0, Math.min(1, Number(aiResponse.data.importance) || 0.5));
    const confidence = Math.max(0, Math.min(1, Number(aiResponse.data.confidence) || 0.8));

    const rawSummary = aiResponse.data.summary_text || params.snippet || params.subject || "";
    const summaryText = cleanSummaryOutputText(rawSummary);

    const extractedItems = (Array.isArray(aiResponse.data.extracted_items)
      ? aiResponse.data.extracted_items
      : []
    ).map((item) => ({
      action: decodeHtmlEntities(item.action || ""),
      deadline: item.deadline ? decodeHtmlEntities(item.deadline) : "None",
      assignee: item.assignee ? decodeHtmlEntities(item.assignee) : "You",
    }));

    return {
      result: {
        category,
        importance: Number(importance.toFixed(2)),
        confidence: Number(confidence.toFixed(2)),
        reason: aiResponse.data.reason || "Processed via Strike single-pass AI.",
        summary_text: summaryText,
        extracted_items: extractedItems,
      },
      model: aiResponse.model,
      promptVersion: TRIAGE_PROMPT_VERSION,
      inputTokens: aiResponse.inputTokens,
      outputTokens: aiResponse.outputTokens,
    };
  } catch (error) {
    console.warn("AI single-pass triage failed, falling back to deterministic heuristic classification:", error);
    // Advanced deterministic heuristic classification engine
    const textToAnalyze = `${params.subject} ${params.sender} ${params.snippet || ""} ${params.bodyText || ""}`.toLowerCase();

    // 1. Check for Important / Urgent
    const isImportant =
      textToAnalyze.includes("urgent") ||
      textToAnalyze.includes("action required") ||
      textToAnalyze.includes("important:") ||
      textToAnalyze.includes("invoice") ||
      textToAnalyze.includes("payment") ||
      textToAnalyze.includes("billing") ||
      textToAnalyze.includes("security alert") ||
      textToAnalyze.includes("verification code") ||
      textToAnalyze.includes("contract") ||
      textToAnalyze.includes("deadline") ||
      textToAnalyze.includes("interview") ||
      textToAnalyze.includes("meeting scheduled");

    // 2. Check for Promotional / Marketing
    const isPromotional =
      textToAnalyze.includes("unsubscribe") ||
      textToAnalyze.includes("newsletter") ||
      textToAnalyze.includes("special offer") ||
      textToAnalyze.includes("discount") ||
      textToAnalyze.includes("sale") ||
      textToAnalyze.includes("promo") ||
      textToAnalyze.includes("% off") ||
      textToAnalyze.includes("deals") ||
      textToAnalyze.includes("digest");

    // 3. Check for Spam
    const isSpam =
      textToAnalyze.includes("winner") ||
      textToAnalyze.includes("lottery") ||
      textToAnalyze.includes("crypto gift") ||
      textToAnalyze.includes("claim prize");

    let category: "important" | "normal" | "promotional" | "spam" = "normal";
    let importance = 0.50;
    let reason = "Standard correspondence without immediate action triggers.";

    if (isSpam) {
      category = "spam";
      importance = 0.05;
      reason = "Detected suspicious marketing or spam characteristics.";
    } else if (isImportant) {
      category = "important";
      importance = 0.88;
      reason = "Contains urgent keywords, billing details, or explicit action triggers.";
    } else if (isPromotional) {
      category = "promotional";
      importance = 0.20;
      reason = "Marketing newsletter or promotional discount communication.";
    }

    return {
      result: {
        category,
        importance,
        confidence: 0.85,
        reason,
        summary_text: params.snippet || params.subject || "",
        extracted_items: [],
      },
      model: "strike-heuristic-classifier",
      promptVersion: TRIAGE_PROMPT_VERSION,
    };
  }
}
