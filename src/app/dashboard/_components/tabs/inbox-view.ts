import { decodeHtmlEntities } from "@/common/types/domain";
import type { EmailMessage } from "../dashboard-shell";

export function isPriority(message: EmailMessage, threshold: number) {
  return (
    message.ai_category?.toLowerCase() === "important" ||
    (typeof message.ai_importance === "number" &&
      message.ai_importance >= threshold)
  );
}

export function getInboxView(
  messages: EmailMessage[],
  filter: "recent" | "priority",
  query: string,
  threshold: number,
  selectedId: string | null,
  visibleLimit = 5,
) {
  const term = query.trim().toLowerCase();
  const priorityCount = messages.filter((message) =>
    isPriority(message, threshold),
  ).length;
  const matches = messages.filter(
    (message) =>
      (filter === "recent" || isPriority(message, threshold)) &&
      (!term ||
        decodeHtmlEntities(
          `${message.sender?.raw ?? ""} ${message.subject} ${message.snippet ?? ""}`,
        )
          .toLowerCase()
          .includes(term)),
  );
  // Search all loaded email, while keeping the overview to five rows.
  const recentMessages = matches.slice(0, visibleLimit);
  // A background refresh can insert mail ahead of the selected conversation.
  const retainedSelection = matches.find(
    (message) => message.id === selectedId,
  );
  const visibleMessages =
    retainedSelection &&
    !recentMessages.some((message) => message.id === retainedSelection.id)
      ? [...recentMessages.slice(0, Math.max(0, visibleLimit - 1)), retainedSelection]
      : recentMessages;
  const selected =
    visibleMessages.find((message) => message.id === selectedId) ??
    visibleMessages[0];
  return { priorityCount, matches, visibleMessages, selected };
}
