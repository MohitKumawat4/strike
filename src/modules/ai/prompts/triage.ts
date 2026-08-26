import { generateStructuredAiJson } from "../ai.client";

export const TRIAGE_PROMPT_VERSION = "2026.08.v1";

export type TriageInput = {
  subject: string;
  sender: string;
  recipient?: string;
  snippet?: string;
  bodyText?: string;
};

export type TriageResult = {
  category: "important" | "normal" | "promotional" | "spam";
  importance: number;
  confidence: number;
  reason: string;
};

/**
 * Builds the AI prompt instructions for classifying and scoring emails.
 */
export function buildTriagePrompt(input: TriageInput): { systemPrompt: string; userPrompt: string } {
  const systemPrompt = `You are Strike AI, an elite email triage assistant.
Your task is to analyze incoming emails and classify them with high precision into one of four categories:
1. "important" — Time-sensitive, urgent requests, invoices, payments, client contracts, critical system alerts, schedule invites, or communications requiring swift action.
2. "normal" — General professional correspondence, personal discussions, standard non-urgent replies.
3. "promotional" — Marketing newsletters, product discounts, coupons, company announcements, promotional digests.
4. "spam" — Unsolicited bulk marketing, scam attempts, phishing, unwanted junk.

Output valid JSON matching this schema:
{
  "category": "important" | "normal" | "promotional" | "spam",
  "importance": number, // 0.00 to 1.00 (e.g. 0.95 for urgent/time-critical, 0.10 for spam/promo)
  "confidence": number, // 0.00 to 1.00
  "reason": string // 1-2 sentence justification for the classification
}`;

  const userPrompt = `Analyze the following email:
From: ${input.sender}
To: ${input.recipient || "User"}
Subject: ${input.subject}
Preview Snippet: ${input.snippet || "(No snippet)"}

Message Content:
${(input.bodyText || input.snippet || "").slice(0, 1500)}

Respond with JSON only.`;

  return { systemPrompt, userPrompt };
}

/**
 * Evaluates an email using AI structured JSON generation,
 * with comprehensive heuristic fallback.
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
    }>({
      systemPrompt,
      userPrompt,
      responseSchemaName: "EmailTriageResult",
    });

    const validCategories = ["important", "normal", "spam", "promotional"] as const;
    const category = validCategories.includes(aiResponse.data.category)
      ? aiResponse.data.category
      : "normal";

    const importance = Math.max(0, Math.min(1, Number(aiResponse.data.importance) || 0.5));
    const confidence = Math.max(0, Math.min(1, Number(aiResponse.data.confidence) || 0.8));

    return {
      result: {
        category,
        importance: Number(importance.toFixed(2)),
        confidence: Number(confidence.toFixed(2)),
        reason: aiResponse.data.reason || "Classified via AI intelligence model.",
      },
      model: aiResponse.model,
      promptVersion: TRIAGE_PROMPT_VERSION,
      inputTokens: aiResponse.inputTokens,
      outputTokens: aiResponse.outputTokens,
    };
  } catch (err) {
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
      },
      model: "strike-heuristic-classifier",
      promptVersion: TRIAGE_PROMPT_VERSION,
    };
  }
}
