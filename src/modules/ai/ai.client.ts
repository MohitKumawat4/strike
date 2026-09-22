import { getServerEnv } from "@/config/server-env";

export type AiGenerateJsonParams = {
  systemPrompt?: string;
  userPrompt: string;
  responseSchemaName?: string;
};

/* ─────────────────────────────────────────────────────────────────────────────
 * Token-Bucket Rate Limiter
 * Caps Gemini API calls at MAX_REQUESTS_PER_MINUTE to prevent bursty traffic
 * patterns that trigger Google Cloud's automated abuse detection.
 * ───────────────────────────────────────────────────────────────────────────── */
const MAX_REQUESTS_PER_MINUTE = 15;
const BUCKET_REFILL_INTERVAL_MS = 60_000; // 1 minute window
let tokenBucket = MAX_REQUESTS_PER_MINUTE;
let lastRefillTimestamp = Date.now();

/**
 * Refills the token bucket based on elapsed time since last refill.
 * Tokens accumulate proportionally but never exceed the max capacity.
 */
function refillTokenBucket(): void {
  const now = Date.now();
  const elapsed = now - lastRefillTimestamp;
  // Calculate how many tokens to add based on time elapsed
  const tokensToAdd = Math.floor((elapsed / BUCKET_REFILL_INTERVAL_MS) * MAX_REQUESTS_PER_MINUTE);
  if (tokensToAdd > 0) {
    tokenBucket = Math.min(MAX_REQUESTS_PER_MINUTE, tokenBucket + tokensToAdd);
    lastRefillTimestamp = now;
  }
}

/**
 * Waits until a rate-limit token is available before proceeding.
 * Uses exponential polling to avoid busy-waiting.
 */
async function acquireRateLimitToken(): Promise<void> {
  const MAX_WAIT_MS = 30_000; // Maximum 30s wait before giving up
  const startTime = Date.now();
  let pollInterval = 500; // Start polling at 500ms intervals

  while (true) {
    refillTokenBucket();
    if (tokenBucket > 0) {
      tokenBucket--;
      return;
    }
    // Check if we've waited too long
    if (Date.now() - startTime > MAX_WAIT_MS) {
      throw new Error("Rate limit: exceeded 30s wait for Gemini API token. Try again later.");
    }
    // Wait with increasing intervals (500ms → 1s → 2s, capped at 4s)
    await new Promise((resolve) => setTimeout(resolve, pollInterval));
    pollInterval = Math.min(4000, pollInterval * 2);
  }
}

/* ─────────────────────────────────────────────────────────────────────────────
 * Concurrency Semaphore
 * Limits the number of in-flight Gemini API calls to prevent parallel
 * processing batches from overwhelming the API simultaneously.
 * ───────────────────────────────────────────────────────────────────────────── */
const MAX_CONCURRENT_REQUESTS = 3;
let activeRequests = 0;
const waitQueue: Array<() => void> = [];

/**
 * Acquires a concurrency slot, waiting if all slots are occupied.
 */
async function acquireConcurrencySlot(): Promise<void> {
  if (activeRequests < MAX_CONCURRENT_REQUESTS) {
    activeRequests++;
    return;
  }
  // All slots occupied — wait in queue until one frees up
  return new Promise<void>((resolve) => {
    waitQueue.push(() => {
      activeRequests++;
      resolve();
    });
  });
}

/**
 * Releases a concurrency slot, unblocking the next queued request if any.
 */
function releaseConcurrencySlot(): void {
  activeRequests--;
  const next = waitQueue.shift();
  if (next) next();
}

/* ─────────────────────────────────────────────────────────────────────────────
 * Gemini API Call with 429 Backoff
 * Handles rate-limit (429) responses with exponential backoff + jitter
 * instead of silently falling through to the next model.
 * ───────────────────────────────────────────────────────────────────────────── */
const GEMINI_MAX_RETRIES = 2; // Retry up to 2 times on 429 responses

/**
 * Calls the Gemini generateContent endpoint with built-in 429 backoff.
 * Returns null if the call fails after all retries.
 */
async function callGeminiWithBackoff(
  endpoint: string,
  body: Record<string, unknown>,
): Promise<{ json: Record<string, unknown> } | null> {
  for (let attempt = 0; attempt <= GEMINI_MAX_RETRIES; attempt++) {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(20000),
    });

    if (response.ok) {
      const json = await response.json();
      return { json };
    }

    // Explicit 429 handling: backoff with jitter before retrying
    if (response.status === 429 && attempt < GEMINI_MAX_RETRIES) {
      const baseDelay = Math.pow(2, attempt + 1) * 1000; // 2s, 4s
      const jitter = Math.random() * 1000; // 0-1s random jitter
      console.warn(`Gemini 429 rate limited (attempt ${attempt + 1}/${GEMINI_MAX_RETRIES + 1}), backing off ${Math.round(baseDelay + jitter)}ms`);
      await new Promise((resolve) => setTimeout(resolve, baseDelay + jitter));
      continue;
    }

    // Non-retryable error (400, 403, 500, etc.) — bail immediately
    if (!response.ok) {
      console.warn(`Gemini API error: ${response.status} ${response.statusText}`);
      return null;
    }
  }
  return null;
}

/* ─────────────────────────────────────────────────────────────────────────────
 * Primary Export: generateStructuredAiJson
 * Universal AI client supporting Google Gemini and OpenAI.
 * Uses structured JSON mode for guaranteed typed outputs.
 *
 * Safeguards applied:
 *  - Token-bucket rate limiter (15 RPM max)
 *  - Concurrency semaphore (3 concurrent max)
 *  - Single primary model + 1 fallback (not 4-model cascade)
 *  - Explicit 429 backoff with jitter
 * ───────────────────────────────────────────────────────────────────────────── */
export async function generateStructuredAiJson<T>(
  params: AiGenerateJsonParams
): Promise<{ data: T; model: string; inputTokens?: number; outputTokens?: number }> {
  const env = getServerEnv();

  // 1. Try Gemini API if GEMINI_API_KEY is configured
  if (env.GEMINI_API_KEY) {
    // Rate limit: wait for an available token before proceeding
    await acquireRateLimitToken();
    // Concurrency: wait for an available slot
    await acquireConcurrencySlot();

    try {
      // Single primary model with one fallback — avoids 4x request multiplication
      const candidateModels = ["gemini-2.0-flash", "gemini-1.5-flash"];

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

          // Use the backoff-aware fetch wrapper instead of raw fetch
          const result = await callGeminiWithBackoff(endpoint, {
            contents,
            generationConfig: {
              responseMimeType: "application/json",
              temperature: 0.2,
            },
          });

          if (result) {
            // Type the Gemini API response structure for safe property access
            const geminiResponse = result.json as {
              candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
              usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
            };
            const candidateText = geminiResponse.candidates?.[0]?.content?.parts?.[0]?.text;
            const usageMetadata = geminiResponse.usageMetadata;

            if (candidateText) {
              const parsed = JSON.parse(candidateText as string) as T;
              return {
                data: parsed,
                model: `google/${modelName}`,
                inputTokens: usageMetadata?.promptTokenCount,
                outputTokens: usageMetadata?.candidatesTokenCount,
              };
            }
          }
        } catch {
          // Try the single fallback model
        }
      }
    } finally {
      // Always release the concurrency slot, even on error
      releaseConcurrencySlot();
    }
  }

  // 2. Try OpenAI if OPENAI_API_KEY is configured (no rate limiter needed — OpenAI has built-in)
  if (env.OPENAI_API_KEY) {
    try {
      const { OpenAI } = await import("openai");
      const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY, timeout: 20000, maxRetries: 0 });
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
