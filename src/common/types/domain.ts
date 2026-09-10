export const processingStatuses = [
  "RECEIVED",
  "PRE_FILTERED",
  "TRIAGED",
  "DISCARDED",
  "SUMMARIZING",
  "SUMMARY_READY",
  "DELIVERY_PENDING",
  "DELIVERING",
  "DELIVERED",
  "FAILED",
  "DELAYED",
] as const;

export type ProcessingStatus = (typeof processingStatuses)[number];

export type EmailAddress = {
  name?: string;
  address: string;
};

/**
 * Universal HTML entity decoder (works in browser & server runtimes without external dependencies).
 * Converts named, decimal, and hex entities like &#39;, &quot;, &amp;, &lt;, &gt;, etc. to clean UTF-8.
 */
export function decodeHtmlEntities(str?: string | null): string {
  if (!str) return "";
  return str
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&lsquo;|&rsquo;|&#8216;|&#8217;/gi, "'")
    .replace(/&ldquo;|&rdquo;|&#8220;|&#8221;/gi, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/gi, " ")
    .replace(/&ndash;|&#8211;/gi, "–")
    .replace(/&mdash;|&#8212;/gi, "—")
    .replace(/&hellip;|&#8230;/gi, "…")
    .replace(/&bull;|&#8226;/gi, "•")
    .replace(/&trade;|&#8482;/gi, "™")
    .replace(/&copy;|&#169;/gi, "©")
    .replace(/&reg;|&#174;/gi, "®")
    .replace(/&#(\d+);/g, (_, dec) => {
      try {
        return String.fromCodePoint(parseInt(dec, 10));
      } catch {
        return "";
      }
    })
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => {
      try {
        return String.fromCodePoint(parseInt(hex, 16));
      } catch {
        return "";
      }
    });
}

/**
 * Universal HTML-to-clean-text converter (works in browser & server runtimes).
 * Strips styles, scripts, comments, and unparsed tags, then formats readable paragraphs.
 */
export function convertHtmlToCleanText(html?: string | null): string {
  if (!html) return "";

  let text = html;

  // 1. Strip script, style, head, and svg tags completely including inner contents
  text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "");
  text = text.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "");
  text = text.replace(/<head[^>]*>[\s\S]*?<\/head>/gi, "");
  text = text.replace(/<svg[^>]*>[\s\S]*?<\/svg>/gi, "");
  text = text.replace(/<!--[\s\S]*?-->/g, "");

  // 2. Replace block-level tags and break tags with newlines
  text = text.replace(/<\/(p|div|tr|h[1-6]|table|blockquote|section|header|footer|article)>/gi, "\n");
  text = text.replace(/<(br|hr)\s*\/?>/gi, "\n");
  text = text.replace(/<li[^>]*>/gi, "\n• ");
  text = text.replace(/<\/li>/gi, "");

  // 3. Remove all remaining HTML tags
  text = text.replace(/<[^>]+>/g, " ");

  // 4. Decode HTML entities
  text = decodeHtmlEntities(text);

  // 5. Clean up redundant whitespace while preserving logical paragraph breaks
  text = text.replace(/[ \t]+/g, " ");
  text = text.replace(/\n\s*\n\s*\n+/g, "\n\n");

  return text
    .split("\n")
    .map((line) => line.trim())
    .join("\n")
    .trim();
}

/**
 * Formats executive summaries by decoding entities and removing redundant "Executive summary:" prefixes.
 */
export function cleanSummaryText(summary?: string | null): string {
  if (!summary) return "";
  let cleaned = decodeHtmlEntities(summary).trim();
  // Strip redundant leading prefixes like "Executive summary:", "Summary:", etc.
  cleaned = cleaned.replace(/^(Executive\s+summary|Summary|Key\s+takeaways?|Brief):\s*/i, "");
  return cleaned;
}
