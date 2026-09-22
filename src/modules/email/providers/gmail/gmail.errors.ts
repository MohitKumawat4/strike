/**
 * Detects whether a Gmail API error represents a 404 Not Found condition
 * (e.g. message deleted, draft discarded, or history ID expired).
 * Checks HTTP response status, code fields, and Google API error messages.
 */
export function isGmailNotFound(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const value = error as {
    code?: unknown;
    status?: unknown;
    message?: unknown;
    response?: {
      status?: number;
      data?: {
        error?: {
          code?: number;
          status?: string;
          message?: string;
        };
      };
    };
    errors?: Array<{ reason?: string; message?: string }>;
  };

  // 1. Direct status or response HTTP status
  if (value.response?.status === 404 || value.status === 404) return true;

  // 2. Numeric code or string "404" / "NOT_FOUND"
  if (Number(value.code) === 404 || value.code === "404" || value.code === "NOT_FOUND") return true;

  // 3. Nested Google API response error payload
  if (value.response?.data?.error?.code === 404 || value.response?.data?.error?.status === "NOT_FOUND") return true;

  // 4. Google SDK errors array
  if (value.errors?.some((e) => e.reason === "notFound" || e.message?.toLowerCase().includes("not found"))) return true;

  // 5. Message substring inspection (critical for wrapped GaxiosError / Next.js server chunks)
  if (typeof value.message === "string") {
    const msg = value.message.toLowerCase();
    if (
      msg.includes("requested entity was not found") ||
      msg.includes("not found") ||
      msg.includes("history id is too old")
    ) {
      return true;
    }
  }

  return false;
}
