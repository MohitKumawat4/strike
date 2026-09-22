import {
  decodeHtmlEntities,
  convertHtmlToCleanText,
  cleanSummaryText,
} from "@/common/types/domain";

export { decodeHtmlEntities, convertHtmlToCleanText, cleanSummaryText };

/**
 * Safely decodes base64url-encoded Gmail payload body strings.
 */
function decodeBase64Payload(data?: string): string {
  if (!data) return "";
  try {
    const sanitized = data.replace(/-/g, "+").replace(/_/g, "/");
    return Buffer.from(sanitized, "base64").toString("utf-8");
  } catch {
    return "";
  }
}

/**
 * Recursively inspects a Gmail MIME part hierarchy to extract clean plain text and raw HTML.
 */
type MailPart = { mimeType?: string | null; body?: { data?: string | null } | null; parts?: MailPart[] | null };
export function extractCleanEmailContent(payload: MailPart | null | undefined, fallbackSnippet: string = ""): {
  bodyText: string;
  bodyHtml?: string;
} {
  let plain = "";
  let html = "";

  function traverse(part: MailPart | null | undefined) {
    if (!part) return;

    const mime = (part.mimeType || "").toLowerCase();

    if (mime === "text/plain" && part.body?.data && !plain) {
      plain = decodeBase64Payload(part.body.data);
    } else if (mime === "text/html" && part.body?.data && !html) {
      html = decodeBase64Payload(part.body.data);
    }

    if (part.parts && Array.isArray(part.parts)) {
      for (const subPart of part.parts) {
        traverse(subPart);
      }
    }
  }

  traverse(payload);

  // Fallback to top-level body if not found in multipart tree
  if (!plain && !html && payload?.body?.data) {
    const rawData = decodeBase64Payload(payload.body.data);
    if (
      payload.mimeType === "text/html" ||
      rawData.includes("<html") ||
      rawData.includes("<!DOCTYPE") ||
      rawData.includes("<body")
    ) {
      html = rawData;
    } else {
      plain = rawData;
    }
  }

  let bodyText = "";
  if (plain && plain.trim().length > 0) {
    // If plain text exists, clean and decode entities
    bodyText = decodeHtmlEntities(plain.trim());
  } else if (html && html.trim().length > 0) {
    // If only HTML exists (marketing/transactional emails), convert to clean text
    bodyText = convertHtmlToCleanText(html);
  } else {
    // Fallback to snippet
    bodyText = decodeHtmlEntities(fallbackSnippet);
  }

  return {
    bodyText: bodyText.trim(),
    bodyHtml: html || undefined,
  };
}

