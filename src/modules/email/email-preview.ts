import {
  convertHtmlToCleanText,
  decodeHtmlEntities,
} from "@/common/types/domain";

function shorten(text: string, limit: number) {
  if (text.length <= limit) return text;
  const slice = text.slice(0, limit - 1);
  const sentence = Math.max(
    slice.lastIndexOf(". "),
    slice.lastIndexOf("! "),
    slice.lastIndexOf("? "),
  );
  return (
    slice
      .slice(
        0,
        sentence > limit / 2
          ? sentence + 1
          : Math.max(slice.lastIndexOf(" "), limit - 30),
      )
      .trimEnd() + "…"
  );
}
/**
 * Strips inline image markers, base64 data URIs, markdown images, and redundant whitespace.
 */
function sanitizeEmailBodyText(raw: string): string {
  let cleaned = raw;
  // Strip markdown images: ![alt](url)
  cleaned = cleaned.replace(/!\[[^\]]*\]\([^)]*\)/g, "");
  // Strip plain text image placeholders common in email clients: [image: ...], [cid: ...]
  cleaned = cleaned.replace(/\[image:\s*[^\]]*\]/gi, "");
  cleaned = cleaned.replace(/\[cid:\s*[^\]]*\]/gi, "");
  // Strip inline base64 data URIs if any leaked
  cleaned = cleaned.replace(/data:image\/[a-zA-Z0-9.+-]+;base64,[a-zA-Z0-9+/=]+/gi, "");
  // Remove standalone image URLs (e.g. tracking pixels or direct links to jpg/png/gif)
  cleaned = cleaned.replace(/^\s*https?:\/\/\S+\.(?:png|jpe?g|gif|webp|svg|ico)(\?\S*)?\s*$/gim, "");
  // Normalize whitespace
  cleaned = cleaned
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return cleaned;
}

export function formatEmailPreview(message: {
  sender?: { raw?: string };
  subject?: string;
  body_text?: string;
  body_html?: string;
  snippet?: string;
  has_attachments?: boolean;
  provider_message_id: string;
}) {
  let rawBody = "";
  // Check if plain text exists
  if (message.body_text && message.body_text.trim().length > 0) {
    const text = message.body_text.trim();
    // If the plain text payload contains HTML tags, convert it to clean text
    rawBody = /<\/?[a-z][\s\S]*>/i.test(text)
      ? convertHtmlToCleanText(text)
      : decodeHtmlEntities(text);
  } else if (message.body_html && message.body_html.trim().length > 0) {
    // If only HTML exists, strip quoted blockquotes and convert to clean text
    const htmlWithoutQuotes = message.body_html.replace(
      /<blockquote\b[^>]*>[\s\S]*?<\/blockquote>/gi,
      "",
    );
    rawBody = convertHtmlToCleanText(htmlWithoutQuotes);
  } else {
    rawBody = decodeHtmlEntities(message.snippet || "");
  }

  // Cut off quoted email threads (e.g. "On ... wrote:" or "Original Message")
  let body = rawBody.split(/\n(?:On .{1,200}wrote:|[- ]*Original Message[- ]*|>)/i)[0];
  body = sanitizeEmailBodyText(body);

  const oneLine = (text: string, limit: number) =>
    shorten(
      decodeHtmlEntities(text)
        .replace(/[\r\n*_`~]+/g, " ")
        .trim(),
      limit,
    );

  return [
    "*New email*",
    `From: ${oneLine(message.sender?.raw || "Unknown sender", 160)}`,
    `Subject: ${oneLine(message.subject || "(No subject)", 220)}`,
    "",
    shorten(body, 3200) || "No readable text. Open the email in Gmail.",
    message.has_attachments ? "\nAttachments are available in Gmail." : "",
    `\nOpen in Gmail: https://mail.google.com/mail/u/0/#all/${encodeURIComponent(message.provider_message_id)}`,
  ]
    .filter((line) => line !== "")
    .join("\n");
}
