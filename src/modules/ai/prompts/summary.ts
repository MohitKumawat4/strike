import { generateStructuredAiJson } from "../ai.client";
import { decodeHtmlEntities, convertHtmlToCleanText } from "@/modules/email/ingestion/initial-sync";

export type ExtractedActionItem = {
  action: string;
  deadline?: string;
  assignee?: string;
};

export type SummaryAiOutput = {
  summary_text: string;
  extracted_items: ExtractedActionItem[];
};

export type SummaryInputParams = {
  subject: string;
  sender: string;
  recipient?: string;
  snippet?: string;
  bodyText?: string;
};

const SUMMARY_PROMPT_VERSION = "v1.0.0";

/**
 * Normalizes executive summaries by decoding entities and removing redundant "Executive summary:" prefixes.
 */
function cleanSummaryOutputText(text: string): string {
  if (!text) return "";
  let cleaned = decodeHtmlEntities(text).trim();
  // Strip redundant leading prefixes like "Executive summary:", "Summary:", etc.
  cleaned = cleaned.replace(/^(Executive\s+summary|Summary|Key\s+takeaways?|Brief):\s*/i, "");
  return cleaned;
}

/**
 * Generates an executive AI summary and extracts key action items from an email thread.
 */
export async function summarizeEmailWithAi(
  params: SummaryInputParams
): Promise<{
  result: SummaryAiOutput;
  model: string;
  promptVersion: string;
  inputTokens?: number;
  outputTokens?: number;
}> {
  const cleanSubject = decodeHtmlEntities(params.subject || "");
  const cleanSender = decodeHtmlEntities(params.sender || "");
  const cleanSnippet = decodeHtmlEntities(params.snippet || "");
  const cleanContent = params.bodyText
    ? (params.bodyText.includes("<") ? convertHtmlToCleanText(params.bodyText) : decodeHtmlEntities(params.bodyText))
    : cleanSnippet;

  const systemPrompt = `You are Strike's Executive Email Summarizer.
Your goal is to extract the core essence and any actionable to-dos from this email thread.
Write the summary in direct, natural language without prepending "Executive summary:" or "Summary:".

Output MUST be a valid JSON object matching this schema:
{
  "summary_text": "A clear, crisp 2-3 sentence summary explaining what this email is about and what is needed.",
  "extracted_items": [
    {
      "action": "Specific action item or task required",
      "deadline": "Deadline or date mentioned (or 'None')",
      "assignee": "Person responsible or 'You'"
    }
  ]
}`;

  const userPrompt = `Summarize the following email:
FROM: ${cleanSender}
TO: ${params.recipient || "User"}
SUBJECT: ${cleanSubject}
CONTENT:
${cleanContent.slice(0, 4000)}`;

  try {
    const aiResponse = await generateStructuredAiJson<SummaryAiOutput>({
      systemPrompt,
      userPrompt,
      responseSchemaName: "EmailSummaryResult",
    });

    const rawSummary = aiResponse.data.summary_text || `Email from ${cleanSender} regarding "${cleanSubject}".`;
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
        summary_text: summaryText,
        extracted_items: extractedItems,
      },
      model: aiResponse.model,
      promptVersion: SUMMARY_PROMPT_VERSION,
      inputTokens: aiResponse.inputTokens,
      outputTokens: aiResponse.outputTokens,
    };
  } catch (err) {
    console.warn("AI summary fell back to heuristic baseline:", err);

    const fallbackSummary = cleanSnippet
      ? cleanSummaryOutputText(cleanSnippet)
      : `Email received from ${cleanSender} regarding "${cleanSubject}".`;

    return {
      result: {
        summary_text: fallbackSummary,
        extracted_items: [
          {
            action: `Review email regarding ${cleanSubject}`,
            deadline: "None",
            assignee: "You",
          },
        ],
      },
      model: "strike-heuristic-fallback",
      promptVersion: SUMMARY_PROMPT_VERSION,
    };
  }
}
