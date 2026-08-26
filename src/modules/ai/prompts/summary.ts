import { generateStructuredAiJson } from "../ai.client";

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
  const systemPrompt = `You are Strike's Executive Email Summarizer.
Your goal is to extract the core essence and any actionable to-dos from this email thread.

Output MUST be a valid JSON object matching this schema:
{
  "summary_text": "A clear, crisp 2-3 sentence executive summary explaining what this email is about and what is needed.",
  "extracted_items": [
    {
      "action": "Specific action item or task required",
      "deadline": "Deadline or date mentioned (or 'None')",
      "assignee": "Person responsible or 'You'"
    }
  ]
}`;

  const userPrompt = `Summarize the following email:
FROM: ${params.sender}
TO: ${params.recipient || "User"}
SUBJECT: ${params.subject}
CONTENT:
${(params.bodyText || params.snippet || "").slice(0, 4000)}`;

  try {
    const aiResponse = await generateStructuredAiJson<SummaryAiOutput>({
      systemPrompt,
      userPrompt,
      responseSchemaName: "EmailSummaryResult",
    });

    const summaryText = aiResponse.data.summary_text || `Email from ${params.sender} regarding "${params.subject}".`;
    const extractedItems = Array.isArray(aiResponse.data.extracted_items)
      ? aiResponse.data.extracted_items
      : [];

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

    return {
      result: {
        summary_text: params.snippet
          ? `Executive summary: ${params.snippet}`
          : `Email received from ${params.sender} regarding "${params.subject}".`,
        extracted_items: [
          {
            action: `Review email regarding ${params.subject}`,
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
