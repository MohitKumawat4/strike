import { getServerEnv } from "@/config/server-env";

export type AiGenerateJsonParams = {
  systemPrompt?: string;
  userPrompt: string;
  responseSchemaName?: string;
};

/**
 * Universal AI client supporting Google Gemini and OpenAI.
 * Uses structured JSON mode for guaranteed typed outputs.
 */
export async function generateStructuredAiJson<T>(
  params: AiGenerateJsonParams
): Promise<{ data: T; model: string; inputTokens?: number; outputTokens?: number }> {
  const env = getServerEnv();

  // 1. Try Gemini API if GEMINI_API_KEY is configured
  if (env.GEMINI_API_KEY) {
    const candidateModels = ["gemini-2.0-flash", "gemini-1.5-flash-latest", "gemini-1.5-flash", "gemini-1.5-pro"];

    for (const modelName of candidateModels) {
      try {
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${env.GEMINI_API_KEY}`;

        const contents = [];
        if (params.systemPrompt) {
          contents.push({
            role: "user",
            parts: [{ text: `SYSTEM INSTRUCTIONS:\n${params.systemPrompt}` }],
          });
          contents.push({
            role: "model",
            parts: [{ text: "Understood. I will follow these instructions and output valid JSON." }],
          });
        }

        contents.push({
          role: "user",
          parts: [{ text: params.userPrompt }],
        });

        const response = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents,
            generationConfig: {
              responseMimeType: "application/json",
              temperature: 0.2,
            },
          }),
        });

        if (response.ok) {
          const json = await response.json();
          const candidateText = json.candidates?.[0]?.content?.parts?.[0]?.text;
          const usageMetadata = json.usageMetadata;

          if (candidateText) {
            const parsed = JSON.parse(candidateText) as T;
            return {
              data: parsed,
              model: `google/${modelName}`,
              inputTokens: usageMetadata?.promptTokenCount,
              outputTokens: usageMetadata?.candidatesTokenCount,
            };
          }
        }
      } catch {
        // Try next model alias
      }
    }
  }

  // 2. Try OpenAI if OPENAI_API_KEY is configured
  if (env.OPENAI_API_KEY) {
    try {
      const { OpenAI } = await import("openai");
      const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });
      const modelName = "gpt-4o-mini";

      const messages: Array<{ role: "system" | "user"; content: string }> = [];
      if (params.systemPrompt) {
        messages.push({ role: "system", content: params.systemPrompt });
      }
      messages.push({ role: "user", content: params.userPrompt });

      const completion = await openai.chat.completions.create({
        model: modelName,
        messages,
        response_format: { type: "json_object" },
        temperature: 0.2,
      });

      const content = completion.choices[0]?.message?.content;
      if (content) {
        const parsed = JSON.parse(content) as T;
        return {
          data: parsed,
          model: `openai/${modelName}`,
          inputTokens: completion.usage?.prompt_tokens,
          outputTokens: completion.usage?.completion_tokens,
        };
      }
    } catch (openAiErr) {
      console.warn("OpenAI API call failed:", openAiErr);
    }
  }

  throw new Error("No configured AI provider succeeded. Ensure GEMINI_API_KEY or OPENAI_API_KEY is valid.");
}
