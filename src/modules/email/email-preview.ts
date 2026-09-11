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
export function formatEmailPreview(message: {
  sender?: { raw?: string };
  subject?: string;
  body_text?: string;
  body_html?: string;
  snippet?: string;
  has_attachments?: boolean;
  provider_message_id: string;
}) {
  const html = (message.body_html || "").replace(
    /<blockquote\b[^>]*>[\s\S]*?<\/blockquote>/gi,
    "",
  );
  let body = convertHtmlToCleanText(
    message.body_text || html || message.snippet || "",
  );
  body = body.split(/\n(?:On .{1,200}wrote:|[- ]*Original Message[- ]*|>)/i)[0];
  body = body
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
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
    shorten(body, 1800) || "No readable text. Open the email in Gmail.",
    message.has_attachments ? "\nAttachments are available in Gmail." : "",
    `\nOpen in Gmail: https://mail.google.com/mail/u/0/#all/${encodeURIComponent(message.provider_message_id)}`,
    "\nEmail preview · No AI used",
  ]
    .filter((line) => line !== "")
    .join("\n");
}
