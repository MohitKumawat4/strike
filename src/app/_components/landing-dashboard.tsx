"use client";

import { useEffect, useRef, useState } from "react";
import {
  Activity,
  ArrowDownLeft,
  ArrowUpRight,
  AudioLines,
  Check,
  CheckCheck,
  ChevronDown,
  CircleCheck,
  Clock3,
  Inbox,
  Mail,
  MessageCircle,
  Pause,
  Play,
  Search,
  ShieldCheck,
  Sparkles,
  Sun,
  Undo2,
  X,
  Zap,
} from "lucide-react";
import styles from "./landing-dashboard.module.css";

type View = "inbox" | "briefing" | "activity";
type Filter = "priority" | "all" | "done";

const messages = [
  {
    id: "launch",
    sender: "Olivia Chen",
    company: "Acme Studio",
    initials: "OC",
    color: "peach",
    subject: "One last thing before we launch",
    snippet: "The team is ready. Just need your green light.",
    priority: true,
    time: "9:42 AM",
    category: "Approval needed",
    summary: "Olivia’s team is ready to launch the new website. The final designs are approved, and the only thing left is your go-ahead on the launch date.",
    action: "Confirm Friday’s launch by 2 PM today.",
    context: "The project is on track. No new blockers.",
  },
  {
    id: "contract",
    sender: "James Miller",
    company: "Northstar",
    initials: "JM",
    color: "lavender",
    subject: "Your signature, and we’re good to go",
    snippet: "Updated agreement attached for your review.",
    priority: true,
    time: "9:28 AM",
    category: "Time-sensitive",
    summary: "James has sent the revised partnership agreement. It includes the payment terms you discussed and is ready for your final review and signature.",
    action: "Review the agreement before tomorrow’s kickoff.",
    context: "Payment terms updated to net 30, as requested.",
  },
  {
    id: "feedback",
    sender: "Sofia Patel",
    company: "Forma",
    initials: "SP",
    color: "green",
    subject: "A quick decision on the new direction",
    snippet: "Two options. I have a favorite, but would love yours.",
    priority: true,
    time: "9:06 AM",
    category: "Decision needed",
    summary: "Sofia has narrowed the brand direction down to two concepts. She recommends the warmer palette, but needs your preference before the team moves into production.",
    action: "Choose a direction before the 3 PM design review.",
    context: "Both options are within the approved scope.",
  },
  {
    id: "meeting",
    sender: "Daniel Kim",
    company: "Your team",
    initials: "DK",
    color: "blue",
    subject: "Notes from this morning’s standup",
    snippet: "Everything we covered, all in one place.",
    priority: false,
    time: "8:51 AM",
    category: "For your reference",
    summary: "Daniel shared the morning standup notes. Engineering is finishing the onboarding flow, and the content team is preparing the launch announcement.",
    action: "No response needed. Catch up whenever you have a moment.",
    context: "Next team check-in: tomorrow at 9 AM.",
  },
  {
    id: "newsletter",
    sender: "The Sunday Edit",
    company: "Newsletter",
    initials: "SE",
    color: "sand",
    subject: "A few good things for your reading list",
    snippet: "Five ideas about doing more meaningful work.",
    priority: false,
    time: "8:30 AM",
    category: "Read later",
    summary: "This week’s newsletter covers creative routines, thoughtful product design, and a reading list for the weekend. Nothing needs your attention right now.",
    action: "Save this for a slower moment.",
    context: "A regular newsletter from your subscriptions.",
  },
  {
    id: "receipt",
    sender: "Paper & Co.",
    company: "Receipt",
    initials: "PC",
    color: "rose",
    subject: "Your order is on its way",
    snippet: "A little something for your desk. Arriving Monday.",
    priority: false,
    time: "8:12 AM",
    category: "For your reference",
    summary: "Your stationery order has shipped and is expected to arrive Monday. The receipt and tracking details are in the original email.",
    action: "No action needed. Your order is on its way.",
    context: "Order confirmation and shipping update.",
  },
];

const waveform = [9, 17, 12, 26, 34, 18, 28, 39, 24, 15, 31, 42, 23, 34, 18, 11, 26, 36, 22, 14, 29, 19, 36, 25, 12, 21, 32, 17, 26, 13, 8];

export default function LandingDashboard() {
  const [view, setView] = useState<View>("inbox");
  const [filter, setFilter] = useState<Filter>("priority");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState("launch");
  const [doneIds, setDoneIds] = useState<string[]>([]);
  const [playing, setPlaying] = useState(false);
  const [voiceError, setVoiceError] = useState("");
  const [actionLog, setActionLog] = useState<{ id: string; text: string }[]>([]);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  useEffect(() => () => {
    if (utteranceRef.current && "speechSynthesis" in window) {
      utteranceRef.current.onend = null;
      utteranceRef.current.onerror = null;
      window.speechSynthesis.cancel();
    }
  }, []);

  const priorities = messages.filter((message) => message.priority && !doneIds.includes(message.id));
  const visibleMessages = messages.filter((message) => {
    const matchesFilter = filter === "all" || (filter === "done" ? doneIds.includes(message.id) : message.priority && !doneIds.includes(message.id));
    const matchesSearch = `${message.sender} ${message.company} ${message.subject} ${message.summary}`.toLowerCase().includes(query.toLowerCase());
    return matchesFilter && matchesSearch;
  });
  const selected = visibleMessages.find((message) => message.id === selectedId) ?? visibleMessages[0];
  const isDone = selected ? doneIds.includes(selected.id) : false;

  function stopVoice() {
    if (utteranceRef.current && "speechSynthesis" in window) {
      utteranceRef.current.onend = null;
      utteranceRef.current.onerror = null;
      window.speechSynthesis.cancel();
      utteranceRef.current = null;
    }
    setPlaying(false);
    setVoiceError("");
  }

  function switchView(nextView: View) {
    stopVoice();
    setView(nextView);
  }

  function playBrief(text: string) {
    if (playing) {
      stopVoice();
      return;
    }
    if (!("speechSynthesis" in window) || !("SpeechSynthesisUtterance" in window)) {
      setVoiceError("Voice isn’t available in this browser. Your written brief is right here.");
      return;
    }
    stopVoice();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-US";
    utterance.rate = 0.96;
    utterance.onend = () => {
      setPlaying(false);
      utteranceRef.current = null;
    };
    utterance.onerror = (event) => {
      setPlaying(false);
      utteranceRef.current = null;
      if (event.error !== "interrupted" && event.error !== "canceled") {
        setVoiceError("Voice playback is unavailable. You can read the brief below.");
      }
    };
    utteranceRef.current = utterance;
    setPlaying(true);
    try {
      window.speechSynthesis.speak(utterance);
    } catch {
      setPlaying(false);
      utteranceRef.current = null;
      setVoiceError("Voice playback is unavailable. You can read the brief below.");
    }
  }

  function toggleDone() {
    if (!selected) return;
    stopVoice();
    setDoneIds((previous) => isDone ? previous.filter((id) => id !== selected.id) : [...previous, selected.id]);
    setActionLog((previous) => [{ id: `${selected.id}-${previous.length}`, text: `${isDone ? "Reopened" : "Completed"}: ${selected.subject}` }, ...previous]);
  }

  return (
    <div className={styles.dashboard} aria-label="Interactive Strike dashboard demo">
      <aside className={styles.sidebar}>
        <div className={styles.wordmark}><Zap size={25} fill="currentColor" strokeWidth={1.5} /><span>strike<span className={styles.wordmarkDot}>.</span></span></div>
        <div className={styles.workspace}><span className={styles.workspaceIcon}>A</span><span>Alex’s workspace<small>Personal workspace</small></span><ChevronDown size={12} /></div>
        <span className={styles.navLabel}>YOUR DAILY SPACE</span>
        <nav className={styles.sideNav} aria-label="Demo dashboard navigation">
          <button type="button" className={view === "inbox" ? styles.navActive : ""} onClick={() => switchView("inbox")} aria-pressed={view === "inbox"}><Inbox size={16} /><span>Inbox</span><span className={styles.navCount}>{priorities.length}</span></button>
          <button type="button" className={view === "briefing" ? styles.navActive : ""} onClick={() => switchView("briefing")} aria-pressed={view === "briefing"}><AudioLines size={16} /><span>Daily briefing</span></button>
          <button type="button" className={view === "activity" ? styles.navActive : ""} onClick={() => switchView("activity")} aria-pressed={view === "activity"}><Activity size={16} /><span>Activity</span></button>
        </nav>
        <div className={styles.sidebarBottom}>
          <div className={styles.connection}><span className={styles.connectionIcon}><Mail size={15} /></span><div>Gmail connected<small>Sample connection</small></div><span className={styles.connectionDot} /></div>
          <div className={styles.sidebarNote}><ShieldCheck size={15} /><span>Your inbox.<br />Your business.</span></div>
          <div className={styles.profile}><span className={styles.profileAvatar}>AL</span><span>Alex Lee<small>Make room for your day.</small></span></div>
        </div>
      </aside>

      <div className={styles.main}>
        <header className={styles.topbar}>
          <div className={styles.breadcrumb}>Your workspace<span>/</span><strong>{view === "inbox" ? "Priority inbox" : view === "briefing" ? "Daily briefing" : "Activity"}</strong></div>
          <span className={styles.demoLabel}><span />INTERACTIVE DEMO</span>
        </header>

        <div className={styles.overview}>
          <div><p className={styles.greeting}><Sun size={13} /> A FRESH START</p><h3>Good morning, Alex<span>.</span></h3><p className={styles.overviewSubtitle}>{priorities.length ? <>Your inbox is sorted. <strong>{priorities.length} things need you.</strong></> : <>All caught up. <strong>The day is yours.</strong></>}</p></div>
          <div className={styles.overviewMark} aria-hidden="true"><Sparkles size={27} strokeWidth={1.3} /></div>
        </div>

        <div className={styles.stats}>
          <div><span className={styles.statIcon}><Mail size={16} /></span><div><strong>{messages.length.toString().padStart(2, "0")}</strong><span>emails sorted</span></div><span className={styles.statTag}>Sample inbox</span></div>
          <div><span className={`${styles.statIcon} ${styles.limeIcon}`}><Zap size={16} /></span><div><strong>{priorities.length.toString().padStart(2, "0")}</strong><span>need your attention</span></div></div>
          <div><span className={styles.statIcon}><CheckCheck size={17} /></span><div><strong>{doneIds.length.toString().padStart(2, "0")}</strong><span>off your mind</span></div></div>
        </div>

        {view === "inbox" && <div className={styles.inboxLayout}>
          <section className={styles.inboxPanel} aria-label="Sample email inbox">
            <div className={styles.inboxHeading}><h4>Your inbox</h4><span>Today <ChevronDown size={11} /></span></div>
            <div className={styles.filterRow} aria-label="Filter sample emails">
              {(["priority", "all", "done"] as const).map((value) => <button type="button" key={value} onClick={() => { stopVoice(); setFilter(value); }} className={filter === value ? styles.filterActive : ""} aria-pressed={filter === value}>{value === "priority" ? "Priority" : value === "all" ? "All mail" : "Done"}<span>{value === "priority" ? priorities.length : value === "all" ? messages.length : doneIds.length}</span></button>)}
            </div>
            <label className={styles.search}><Search size={14} /><input value={query} onChange={(event) => { stopVoice(); setQuery(event.target.value); }} placeholder="Find something in your inbox" aria-label="Search demo emails" />{query && <button type="button" aria-label="Clear search" onClick={() => { stopVoice(); setQuery(""); }}><X size={13} /></button>}</label>
            <div className={styles.messageList}>
              {visibleMessages.map((message) => <button type="button" key={message.id} className={`${styles.message} ${selected?.id === message.id ? styles.selectedMessage : ""}`} onClick={() => { stopVoice(); setSelectedId(message.id); }} aria-pressed={selected?.id === message.id}>
                <span className={`${styles.avatar} ${styles[message.color]}`}>{message.initials}</span>
                <span className={styles.messageContent}><span className={styles.messageMeta}><strong>{message.sender}</strong><time>{message.time}</time></span><span className={styles.messageSubject}>{message.subject}</span><span className={styles.messageSnippet}>{message.snippet}</span><span className={styles.messageBottom}><span className={doneIds.includes(message.id) ? styles.doneBadge : message.priority ? styles.priorityBadge : styles.quietBadge}>{doneIds.includes(message.id) ? <><Check size={9} /> Done</> : message.priority ? <><span /> {message.category}</> : message.category}</span>{selected?.id === message.id && <ArrowUpRight size={13} />}</span></span>
              </button>)}
              {visibleMessages.length === 0 && <div className={styles.empty}><CircleCheck size={27} strokeWidth={1.3} /><strong>{query ? "Nothing matches just yet." : filter === "done" ? "A clean slate." : "You’re all caught up."}</strong><p>{query ? "Try a name, subject, or a different filter." : filter === "done" ? "Mark an email done to find it here." : "The important things are taken care of."}</p></div>}
            </div>
            <div className={styles.inboxFoot}><Sparkles size={12} /><span>A little clarity, courtesy of Strike.</span></div>
          </section>

          <section className={styles.detailPanel} aria-label="Selected email brief">
            {selected ? <>
              <div className={styles.detailHeader}><span><Sparkles size={13} /> THE SHORT VERSION</span><span className={styles.aiBadge}>AI BRIEF</span></div>
              <div className={styles.detailContent}>
                <div className={styles.senderLine}><span className={`${styles.avatar} ${styles[selected.color]}`}>{selected.initials}</span><div><strong>{selected.sender}</strong><span>{selected.company} <ArrowDownLeft size={10} /></span></div><span className={styles.detailTime}>{selected.time}</span></div>
                <h4>{selected.subject}</h4>
                <p className={styles.summary}>{selected.summary}</p>
                <div className={styles.actionCard}><span><Zap size={13} /> YOUR NEXT MOVE</span><p>{selected.action}</p></div>
                <p className={styles.context}><Check size={11} />{selected.context}</p>
                <div className={styles.detailActions}><button type="button" className={styles.listenButton} onClick={() => playBrief(`${selected.summary} Your next move: ${selected.action}`)} aria-label={playing ? "Stop voice brief" : "Listen to voice brief"}>{playing ? <Pause size={13} fill="currentColor" /> : <Play size={13} fill="currentColor" />} {playing ? "Stop brief" : "Listen to brief"}<AudioLines size={14} /></button><button type="button" className={styles.doneButton} onClick={toggleDone}>{isDone ? <Undo2 size={13} /> : <Check size={14} />}{isDone ? "Reopen" : "Mark done"}</button></div>
                {voiceError && <p className={styles.voiceError} role="status">{voiceError}</p>}
              </div>
              <div className={styles.whatsapp}><div className={styles.whatsappHeader}><MessageCircle size={14} /><strong>And it meets you here.</strong><span>WHATSAPP PREVIEW</span></div><div className={styles.chatBubble}><span className={styles.chatName}>Strike <Zap size={9} fill="currentColor" /></span><p>{selected.sender.split(" ")[0]} needs your attention. {selected.action}</p><span className={styles.chatTime}>9:43 <CheckCheck size={12} /></span></div></div>
            </> : <div className={styles.detailEmpty}><Sparkles size={30} strokeWidth={1.2} /><h4>Room to breathe.</h4><p>Select another filter to explore your sample inbox.</p></div>}
          </section>
        </div>}

        {view === "briefing" && <section className={styles.briefingView} aria-label="Sample daily briefing">
          <div className={styles.briefingPlayer}><span className={styles.briefingEyebrow}><AudioLines size={14} /> YOUR DAY, DISTILLED</span><h4>Less reading.<br />More living.</h4><p>A spoken overview of what needs your attention. Press play and take your day with you.</p><div className={styles.audioControl}><button type="button" onClick={() => playBrief(priorities.length ? `Good morning, Alex. ${priorities.length} things need your attention. ${priorities.map((message) => `${message.sender} says: ${message.summary} ${message.action}`).join(" ")}` : "Good morning, Alex. You have taken care of everything in your priority inbox. Enjoy the rest of your day.")} aria-label={playing ? "Stop daily briefing" : "Play daily briefing"}>{playing ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}</button><div className={`${styles.waveform} ${playing ? styles.waveformPlaying : ""}`} aria-hidden="true">{waveform.map((height, index) => <span key={index} style={{ height, animationDelay: `${index * -0.07}s` }} />)}</div><span>{playing ? "Playing" : "Play brief"}</span></div><span className={styles.voiceNote}>Sample brief · Your browser’s voice</span>{voiceError && <p className={styles.voiceError} role="status">{voiceError}</p>}</div>
          <div className={styles.briefingAgenda}><div className={styles.agendaHeading}><h4>Here’s what matters.</h4><span>{priorities.length} things</span></div>{priorities.map((message, index) => <button type="button" key={message.id} className={styles.agendaItem} onClick={() => { stopVoice(); setFilter("priority"); setQuery(""); setSelectedId(message.id); setView("inbox"); }}><span className={styles.agendaNumber}>0{index + 1}</span><span><strong>{message.category}</strong><p>{message.action}</p><small>{message.sender} · {message.company}</small></span><ArrowUpRight size={16} /></button>)}{priorities.length === 0 && <div className={styles.empty}><CircleCheck size={27} /><strong>Everything is taken care of.</strong><p>You can revisit completed emails in your inbox.</p></div>}<div className={styles.agendaFoot}><Sun size={15} /> That’s it. The rest can wait.</div></div>
        </section>}

        {view === "activity" && <section className={styles.activityView} aria-label="Demo activity history"><div className={styles.activityIntro}><span className={styles.briefingEyebrow}><Activity size={14} /> QUIETLY, IN THE BACKGROUND</span><h4>A little order.<br />A lot of peace of mind.</h4><p>See how a message becomes a clear next step. Everything here is sample data, so feel free to explore.</p><div className={styles.activityHealth}><span /> Demo workspace ready</div></div><div className={styles.timeline}>
          {actionLog.map((event) => <div className={styles.timelineItem} key={event.id}><span className={styles.timelineIcon}><CircleCheck size={15} /></span><div><strong>{event.text}</strong><p>Your demo inbox has been updated.</p></div><time>Just now</time></div>)}
          <div className={styles.timelineItem}><span className={styles.timelineIcon}><MessageCircle size={15} /></span><div><strong>WhatsApp brief prepared</strong><p>A concise summary, ready to preview.</p></div><time>9:43 AM</time></div>
          <div className={styles.timelineItem}><span className={styles.timelineIcon}><Sparkles size={15} /></span><div><strong>Three priorities found</strong><p>Approvals, decisions, and the things that need you.</p></div><time>9:42 AM</time></div>
          <div className={styles.timelineItem}><span className={styles.timelineIcon}><Inbox size={15} /></span><div><strong>Sample inbox organized</strong><p>Six messages given a little more clarity.</p></div><time>9:42 AM</time></div>
          <div className={styles.timelineItem}><span className={styles.timelineIcon}><Mail size={15} /></span><div><strong>Sample Gmail connected</strong><p>Your demo starts here.</p></div><time>9:41 AM</time></div>
        </div></section>}

        <footer className={styles.dashboardFooter}><span><span className={styles.footerDot} /> A calmer inbox starts here.</span><span><Clock3 size={10} /> Sample data. Real possibilities.</span></footer>
      </div>
    </div>
  );
}
