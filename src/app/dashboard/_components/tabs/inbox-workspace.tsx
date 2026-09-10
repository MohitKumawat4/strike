"use client";

import { useId, useMemo, useState } from "react";
import {
  ArrowUpRight,
  Check,
  ChevronRight,
  Clock3,
  Inbox,
  Mail,
  MessageSquare,
  Search,
  ShieldCheck,
  Sparkles,
  X,
  Zap,
} from "lucide-react";
import {
  cleanSummaryText,
  convertHtmlToCleanText,
  decodeHtmlEntities,
} from "@/common/types/domain";
import type {
  ConnectedAccount,
  EmailMessage,
  UserSettings,
} from "../dashboard-shell";
import styles from "./inbox-workspace.module.css";
import { getInboxView, isPriority } from "./inbox-view";

type InboxWorkspaceProps = {
  messages: EmailMessage[];
  accounts: ConnectedAccount[];
  receivedCount: number;
  userSettings?: UserSettings | null;
  onConnectGmail: () => void;
  onViewMessages?: () => void;
  onManageWhatsApp?: () => void;
  showFilters?: boolean;
  visibleLimit?: number;
  title?: string;
  onSelectMessage?: (message: EmailMessage) => void;
};

function senderName(message: EmailMessage) {
  const raw = decodeHtmlEntities(message.sender?.raw);
  return raw?.split("<")[0]?.trim() || raw || "Unknown sender";
}

function shortDate(value: string | null) {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime())
    ? date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
    : "—";
}

export function InboxWorkspace({
  messages,
  accounts,
  receivedCount,
  userSettings,
  onConnectGmail,
  onViewMessages,
  onManageWhatsApp,
  onSelectMessage,
  showFilters = true,
  visibleLimit = 5,
  title = "Recent Intelligence Stream",
}: InboxWorkspaceProps) {
  const [selectedId, setSelectedId] = useState<string | null>(
    messages[0]?.id ?? null,
  );
  const [filter, setFilter] = useState<"recent" | "priority">("recent");
  const [query, setQuery] = useState("");
  const readerId = useId();
  const threshold = userSettings?.importance_threshold ?? 0.7;
  const { priorityCount, matches, visibleMessages, selected } = useMemo(
    () => getInboxView(messages, filter, query, threshold, selectedId, visibleLimit),
    [messages, filter, query, threshold, selectedId, visibleLimit],
  );
  const account = accounts.find((item) => item.id === selected?.account_id);
  const summary = cleanSummaryText(selected?.summary?.summary_text);
  const excerpt = convertHtmlToCleanText(
    selected?.body_text || selected?.snippet || selected?.body_html || "",
  );
  const actions = selected?.summary?.extracted_items ?? [];
  const destination = userSettings?.whatsapp_destination;

  function selectMessage(message: EmailMessage) {
    setSelectedId(message.id);
    if (window.matchMedia("(max-width: 700px)").matches)
      onSelectMessage?.(message);
  }

  return (
    <section
      className={styles.workspace}
      aria-label="Recent activity"
      data-mobile-drawer={Boolean(onSelectMessage)}
    >
      <header className={styles.workspaceHeading}>
        <div>
          <p className={styles.eyebrow}>YOUR INBOX, DISTILLED</p>
          <h2>{title}</h2>
        </div>
        <span className={styles.totalCount}>{receivedCount} messages</span>
      </header>
      <div className={styles.columns}>
        <div className={styles.inbox}>
          <div className={styles.listHeading}>
            <strong>Your inbox</strong>
            <span>{showFilters ? "Latest messages" : "Select to read"}</span>
          </div>
          {showFilters && <>
          <div className={styles.filters} aria-label="Filter overview messages">
            <button
              type="button"
              aria-pressed={filter === "recent"}
              onClick={() => setFilter("recent")}
            >
              Recent<span>{messages.length}</span>
            </button>
            <button
              type="button"
              aria-pressed={filter === "priority"}
              onClick={() => setFilter("priority")}
            >
              <Zap size={12} />
              Priority<span>{priorityCount}</span>
            </button>
          </div>
          <div className={styles.search}>
            <Search size={15} aria-hidden="true" />
            <input
              aria-label="Search overview emails"
              placeholder="Find a sender or conversation…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Clear email search"
              >
                <X size={14} />
              </button>
            )}
          </div>
          </>}
          <div className={styles.messageList}>
            {visibleMessages.map((message) => {
              const priority = isPriority(message, threshold);
              const name = senderName(message);
              return (
                <button
                  type="button"
                  key={message.id}
                  className={styles.message}
                  aria-pressed={selected?.id === message.id}
                  aria-controls={readerId}
                  onClick={() => selectMessage(message)}
                >
                  <span className={styles.avatar}>
                    {name[0]?.toUpperCase() || "M"}
                  </span>
                  <span className={styles.messageText}>
                    <span className={styles.messageTop}>
                      <strong>{name}</strong>
                      <time dateTime={message.received_at ?? undefined}>
                        {shortDate(message.received_at)}
                      </time>
                    </span>
                    <span className={styles.address}>
                      {decodeHtmlEntities(message.sender?.raw)}
                    </span>
                    <span className={styles.subject}>
                      {decodeHtmlEntities(message.subject) || "(No Subject)"}
                    </span>
                    <span className={styles.snippet}>
                      {cleanSummaryText(message.summary?.summary_text) ||
                        convertHtmlToCleanText(message.snippet) ||
                        "Open to see the message details."}
                    </span>
                    <span className={styles.messageBottom}>
                      <span
                        className={
                          priority ? styles.priorityBadge : styles.categoryBadge
                        }
                      >
                        {priority && <Zap size={10} />}
                        {priority
                          ? "Priority"
                          : message.ai_category?.replaceAll("_", " ") ||
                            "Awaiting classification"}
                      </span>
                      <ChevronRight size={14} />
                    </span>
                  </span>
                </button>
              );
            })}
            {!visibleMessages.length && (
              <div className={styles.emptyState}>
                <Inbox size={30} strokeWidth={1.3} />
                <h3>
                  {messages.length
                    ? "A clear view."
                    : "A little room for clarity."}
                </h3>
                <p>
                  {query
                    ? "No messages match your search. Try a sender or subject."
                    : filter === "priority"
                      ? "No loaded emails meet your priority threshold."
                      : "Your recently synced emails will appear here as they arrive."}
                </p>
                {messages.length ? (
                  <button
                    type="button"
                    onClick={() => {
                      setQuery("");
                      setFilter("recent");
                    }}
                  >
                    Show recent messages
                    <ArrowUpRight size={14} />
                  </button>
                ) : (
                  <button type="button" onClick={onConnectGmail}>
                    Connect an inbox
                    <ArrowUpRight size={14} />
                  </button>
                )}
              </div>
            )}
          </div>
          <footer className={styles.listFooter}>
            <span aria-live="polite">
              Showing {visibleMessages.length} of {matches.length} loaded
            </span>
            {onViewMessages && (
              <button type="button" onClick={onViewMessages}>
                View all messages
                <ArrowUpRight size={13} />
              </button>
            )}
          </footer>
        </div>

        <div className={styles.contextColumn}>
          <section
            className={styles.reader}
            id={readerId}
            aria-label="Selected email brief"
          >
            <header className={styles.readerHeading}>
              <span>
                <Sparkles size={14} /> THE SHORT VERSION
              </span>
              <span>{summary ? "AI BRIEF" : "MESSAGE DETAILS"}</span>
            </header>
            {selected ? (
              <div key={selected.id} className={styles.readingContent}>
                <div className={styles.sender}>
                  <span className={styles.avatar}>
                    {senderName(selected)[0]?.toUpperCase() || "M"}
                  </span>
                  <div>
                    <strong>{senderName(selected)}</strong>
                    <span title={account?.email_address}>
                      {account?.email_address ||
                        decodeHtmlEntities(selected.sender?.raw)}
                    </span>
                  </div>
                  <time>{shortDate(selected.received_at)}</time>
                </div>
                <h3>
                  {decodeHtmlEntities(selected.subject) || "(No Subject)"}
                </h3>
                <p className={styles.briefLabel}>
                  {summary ? "EXECUTIVE SUMMARY" : "ORIGINAL EMAIL EXCERPT"}
                </p>
                <p className={styles.summary}>
                  {summary ||
                    (excerpt
                      ? `${excerpt.slice(0, 700)}${excerpt.length > 700 ? "…" : ""}`
                      : "A summary isn’t available yet. Open the full details to inspect this message.")}
                </p>

                {actions.length > 0 && (
                  <div className={styles.actionCard}>
                    <p>
                      <Zap size={13} />
                      YOUR NEXT MOVE
                    </p>
                    <ol>
                      {actions.map((item, index) => (
                        <li key={`${index}-${item.action}`}>
                          <span className={styles.actionNumber}>
                            {String(index + 1).padStart(2, "0")}
                          </span>
                          <div>
                            <strong>{decodeHtmlEntities(item.action)}</strong>
                            {item.deadline && (
                              <small>
                                <Clock3 size={11} />
                                {decodeHtmlEntities(item.deadline)}
                              </small>
                            )}
                            {item.assignee && (
                              <small>
                                For {decodeHtmlEntities(item.assignee)}
                              </small>
                            )}
                          </div>
                        </li>
                      ))}
                    </ol>
                  </div>
                )}

                {selected.ai_reason && (
                  <details className={styles.reason}>
                    <summary>
                      <ShieldCheck size={13} />
                      Why this classification?
                      <ChevronRight size={13} />
                    </summary>
                    <p>{decodeHtmlEntities(selected.ai_reason)}</p>
                  </details>
                )}
                {summary && excerpt && (
                  <details className={styles.original}>
                    <summary>
                      Read the original excerpt
                      <ChevronRight size={13} />
                    </summary>
                    <p>
                      {excerpt.slice(0, 1600)}
                      {excerpt.length > 1600 ? "…" : ""}
                    </p>
                  </details>
                )}
                <div className={styles.readerActions}>
                  {onSelectMessage && (
                    <button
                      type="button"
                      onClick={() => onSelectMessage(selected)}
                    >
                      Open full details
                      <ArrowUpRight size={14} />
                    </button>
                  )}
                  <a
                    href={
                      selected.provider_message_id
                        ? `https://mail.google.com/mail/u/0/#all/${selected.thread_id || selected.provider_message_id}`
                        : `https://mail.google.com/mail/u/0/#search/${encodeURIComponent(selected.subject || "")}`
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Mail size={13} />
                    Open in Gmail
                    <ArrowUpRight size={13} />
                  </a>
                </div>
              </div>
            ) : (
              <div className={styles.readerEmpty}>
                <Sparkles size={29} strokeWidth={1.2} />
                <h3>A little clarity, right here.</h3>
                <p>
                  Select a message to see its context, summary, and next steps.
                </p>
              </div>
            )}
          </section>

          <section
            className={styles.delivery}
            aria-label="WhatsApp Stream Integration"
          >
            <div className={styles.deliveryTop}>
              <span>
                <MessageSquare size={16} />
                <strong>And it meets you here.</strong>
              </span>
              <span className={styles.previewLabel}>BRIEF PREVIEW</span>
            </div>
            {selected && summary ? (
              <div className={styles.chatBubble} key={selected.id}>
                <span>
                  <Zap size={12} fill="currentColor" />
                  Strike
                </span>
                <p>
                  {summary.slice(0, 280)}
                  {summary.length > 280 ? "…" : ""}
                </p>
                {actions[0] && (
                  <strong>{decodeHtmlEntities(actions[0].action)}</strong>
                )}
                <small>Preview only · delivery not verified</small>
              </div>
            ) : (
              <p className={styles.deliveryEmpty}>
                {selected
                  ? "A preview will appear when this email has an AI summary."
                  : "Select a summarized email to preview its brief."}
              </p>
            )}
            <div className={styles.destination}>
              <span>
                {destination ? (
                  <Check size={13} />
                ) : (
                  <MessageSquare size={13} />
                )}
                <span>
                  {destination || "Add your WhatsApp number"}
                  <small>
                    {destination
                      ? "Number configured"
                      : "Receive priority summaries and action items"}
                  </small>
                </span>
              </span>
              {onManageWhatsApp && (
                <button type="button" onClick={onManageWhatsApp}>
                  {destination
                    ? "Manage & Test Number"
                    : "Connect WhatsApp Number"}
                  <ArrowUpRight size={13} />
                </button>
              )}
            </div>
          </section>
        </div>
      </div>
    </section>
  );
}
