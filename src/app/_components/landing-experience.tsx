"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { AnimatePresence, MotionConfig, motion, useMotionValue, useMotionValueEvent, useReducedMotion, useScroll, useSpring, useTransform } from "framer-motion";
import { ArrowDown, ArrowDownLeft, ArrowUpRight, AudioLines, Check, CheckCheck, Fingerprint, LockKeyhole, Mail, Menu, MessageCircle, Minus, Plus, Radio, ShieldCheck, SlidersHorizontal, X, Zap } from "lucide-react";
import { createSupabaseBrowserClient } from "@/database/supabase/browser";
import { isSupabaseConfigured } from "@/config/supabase";
import LandingDashboard from "./landing-dashboard";
import s from "./landing-experience.module.css";

function StrikeMark({ className = "" }: { className?: string }) {
  return <svg className={className} width="28" height="32" viewBox="0 0 28 32" fill="none" aria-hidden="true"><path d="M15 1H26L17.5 12H27L9 31L12 19H1L15 1Z" fill="currentColor" /></svg>;
}

function Brand() {
  return <Link className={s.brand} href="/" aria-label="Strike home"><StrikeMark /><span>strike<span className={s.brandDot}>.</span></span></Link>;
}

function Reveal({ children, className = "", delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  const reduceMotion = useReducedMotion();
  return <motion.div className={className} initial={reduceMotion ? false : { opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "0px 0px -40px 0px" }} transition={{ duration: 0.65, delay, ease: [0.22, 1, 0.36, 1] }}>{children}</motion.div>;
}

function SignalSculpture({ paused }: { paused: boolean }) {
  const scene = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const tiltX = useSpring(y, { stiffness: 70, damping: 22 });
  const tiltY = useSpring(x, { stiffness: 70, damping: 22 });
  const { scrollYProgress } = useScroll({ target: scene, offset: ["start start", "end start"] });
  const scrollRotate = useTransform(scrollYProgress, [0, 1], [-28, 15]);
  const scrollY = useTransform(scrollYProgress, [0, 1], [0, 100]);
  // Set data-paused="true" only when paused to prevent SSR/client hydration mismatch (useReducedMotion returns null on SSR)
  return (
    <div ref={scene} className={s.signalScene} data-paused={paused ? "true" : undefined} onPointerMove={(event) => {
      if (paused || reduced || event.pointerType !== "mouse") return;
      const rect = event.currentTarget.getBoundingClientRect();
      x.set(((event.clientX - rect.left) / rect.width - 0.5) * 22);
      y.set(-((event.clientY - rect.top) / rect.height - 0.5) * 18);
    }} onPointerLeave={() => { x.set(0); y.set(0); }} aria-label="A dimensional lime signal loop turns scattered email into one clear priority">
      <div className={s.sceneGrid} aria-hidden="true" />
      <div className={s.orbitLine} aria-hidden="true" />
      <span className={s.sceneCoordinate}>S / 01 — SIGNAL ENGINE</span>
      <span className={s.scenePlus} aria-hidden="true">+</span>
      <div className={s.sculptureShadow} aria-hidden="true" />
      <motion.div className={s.sculptureParallax} style={paused || reduced ? undefined : { rotateX: tiltX, rotateY: tiltY, y: scrollY }} aria-hidden="true">
        <motion.div className={s.sculpture} style={{ rotateZ: paused || reduced ? -28 : scrollRotate }}>
          <div className={s.sculptureFloat}>
            {Array.from({ length: 44 }, (_, i) => <div key={i} className={`${s.loopLayer} ${i === 43 ? s.loopFace : ""}`} style={{ transform: `translateZ(${i * 1.25}px)`, borderColor: i === 43 ? undefined : `hsl(${82 + i * 0.12} ${49 + i * 0.65}% ${37 + i * 0.6}%)` }} />)}
            <div className={s.core}><StrikeMark /><span>intelligence, in the loop</span></div>
          </div>
        </motion.div>
      </motion.div>
      <div className={`${s.floatingEmail} ${s.noiseEmail}`} aria-hidden="true"><span className={s.emailIcon}><Mail size={17} /></span><div><span>Inbox, a moment ago</span><strong>Just following up…</strong><div className={s.emailSkeleton}><i /><i /></div></div><span className={s.emailCount}>+24</span></div>
      <div className={`${s.floatingEmail} ${s.signalEmail}`} aria-hidden="true"><div className={s.signalEmailTop}><span><i /> THE ONE THAT MATTERS</span><ArrowUpRight size={15} /></div><strong>The contract is ready.<br />Your signature is all it needs.</strong><div className={s.signalEmailBottom}><span className={s.personAvatar}>JL</span><span>Jamie Lee <span>· Just now</span></span><span className={s.priorityBadge}>Priority</span></div></div>
      <div className={s.sceneCaption}><span className={s.signalDot} /> A little intelligence. A lot of headspace.</div>
    </div>
  );
}

const journey = [
  { number: "01", label: "CONNECT", title: <>Your inbox.<br />Same as ever.</>, description: "Connect your Gmail and keep working the way you do. Strike quietly watches for new messages in the background.", detail: "Gmail in. Nothing new to manage.", icon: Mail },
  { number: "02", label: "DISTILL", title: <>The signal.<br />Without the noise.</>, description: "Deadlines. Decisions. People counting on you. Strike reads the context and brings the emails that need your attention to the surface.", detail: "Priority is about context, not keywords.", icon: SlidersHorizontal },
  { number: "03", label: "DELIVER", title: <>A brief.<br />Then back to life.</>, description: "Get the important details and your next move, delivered to WhatsApp as a text or voice brief. Stay informed, even when you’re away from your desk.", detail: "Your next move, wherever you are.", icon: MessageCircle },
];

function Journey({ paused }: { paused: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const [step, setStep] = useState(0);
  const reduced = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 0.45", "end 0.7"] });
  useMotionValueEvent(scrollYProgress, "change", (value) => {
    if (paused || reduced || window.matchMedia("(max-width: 600px)").matches) return;
    setStep(Math.min(2, Math.floor(value * 3)));
  });
  const rotate = useTransform(scrollYProgress, [0, 0.5, 1], [-8, 4, -3]);
  return <section id="how-it-works" className={s.journeySection}>
    <div className={s.sectionTop}><span className={s.eyebrow}>A SMALL SHIFT. A DIFFERENT DAY.</span><span className={s.sectionIndex}>02 / THE FLOW</span></div>
    <div className={s.journeyGrid} ref={ref}>
      <div className={s.journeyCopy}>{journey.map((item, index) => <div className={s.journeyStep} key={item.number} id={`flow-${item.number}`}><Reveal><div className={s.stepLabel}><span>{item.number}</span>{item.label}</div><h2>{item.title}</h2><p>{item.description}</p><div className={s.stepDetail}><item.icon size={16} />{item.detail}</div><div className={s.stepProgress} aria-hidden="true">{journey.map((_, dot) => <i key={dot} className={index === dot ? s.currentProgress : ""} />)}</div></Reveal></div>)}</div>
      <div className={s.journeyVisual}><div className={s.journeyVisualSticky}>
        <div className={s.phoneOrbit} aria-hidden="true" />
        <motion.div className={s.phone} style={paused || reduced ? undefined : { rotateZ: rotate }}>
          <div className={s.phoneCamera} aria-hidden="true" /><div className={s.phoneStatus}><strong>9:41</strong><span>● ▰</span></div>
          <div className={s.phoneAppHeader}><span className={s.phoneBrand}><StrikeMark /></span><div><strong>Strike</strong><span>Your inbox, distilled.</span></div><ShieldCheck size={17} /></div>
          <div className={s.phoneContent}><div className={s.phoneDate}>A BETTER KIND OF NOTIFICATION</div>
            <AnimatePresence mode="wait" initial={false}>
              <motion.div key={step} initial={{ opacity: 0, y: paused || reduced ? 0 : 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: paused || reduced ? 0 : -8 }} transition={{ duration: 0.25 }}>
                {step === 0 ? <><div className={s.phoneMessage}><span className={s.phoneMessageLabel}><Mail size={14} /> GMAIL CONNECTED</span><h3>A lighter inbox<br />starts here.</h3><p>You’re connected. We’ll take it from here.</p><div className={s.connectedAccount}><span>J</span><div><strong>jamie@studio.co</strong><small>Watching for what matters</small></div><Check size={16} /></div></div><div className={s.incomingMail}><Mail size={15} /><span>New project proposal</span><span>now</span></div><div className={s.incomingMail}><Mail size={15} /><span>Your weekly roundup</span><span>now</span></div><div className={s.incomingMail}><Mail size={15} /><span>Contract ready to sign</span><span>now</span></div></> : step === 1 ? <><div className={s.phoneMessage}><span className={s.phoneMessageLabel}><Radio size={14} /> SIGNAL FOUND</span><h3>One decision.<br />Worth your time.</h3><p>We found a deadline in your latest messages.</p><div className={s.contextTags}><span>Key client</span><span>Due today</span><span>Signature needed</span></div></div><div className={s.priorityMessage}><span><Zap size={14} /> HIGH PRIORITY</span><strong>Contract ready to sign</strong><p>From Jamie Lee · Northstar</p><div className={s.scoreTrack}><i /></div><small>Needs your attention</small></div><div className={s.quietMessage}><Check size={14} /> The newsletter can wait.</div></> : <><div className={s.phoneMessage}><span className={s.phoneMessageLabel}><MessageCircle size={14} /> YOUR MORNING BRIEF</span><h3>Here’s your<br />next move.</h3><p>Jamie sent the final Northstar contract. The terms are approved — just your signature left.</p><div className={s.phoneAction}><span>01</span><div><strong>Sign the Northstar contract</strong><small>Before 4:00 PM today</small></div></div><span className={s.deliveredTime}>9:41 <CheckCheck size={13} /></span></div><div className={s.voiceNote} aria-hidden="true"><span><AudioLines size={20} /></span><div className={s.waveform}>{Array.from({ length: 27 }, (_, i) => <i key={i} style={{ height: `${8 + ((i * 17 + 5) % 24)}px`, animationDelay: `${i * 0.06}s` }} />)}</div><span>0:18</span></div><div className={s.quietMessage}><CheckCheck size={14} /> Delivered to your WhatsApp.</div></>}
              </motion.div>
            </AnimatePresence>
          </div><div className={s.phoneHomeBar} />
        </motion.div>
        <span className={s.phoneSample}>ILLUSTRATIVE PREVIEW</span>
        <div className={s.journeyStepControls} aria-label="Preview each step">{journey.map((item, i) => <button key={i} type="button" aria-label={`Preview step ${i + 1}: ${item.label.toLowerCase()}`} aria-pressed={step === i} onClick={() => setStep(i)}>{item.number}</button>)}</div>
      </div></div>
    </div>
  </section>;
}

const faqs = [
  { question: "What does Strike actually do?", answer: "Strike connects to your Gmail, evaluates incoming email for urgency and relevance, and turns important messages into summaries with clear action items. Those briefs can be delivered to your WhatsApp as text or voice, so you can stay informed without living in your inbox." },
  { question: "Do I need to change how I use email?", answer: "No. You keep your Gmail address, inbox, and existing workflow. Strike works alongside them. You can review processed messages and adjust your delivery preferences from your Strike dashboard." },
  { question: "Can I choose what reaches my WhatsApp?", answer: "Yes. Your dashboard includes delivery preferences and an urgency threshold, so you can decide which messages deserve a notification. You can review and adjust these settings as your priorities change." },
  { question: "How is my email data handled?", answer: "Strike uses Google OAuth to connect your account without asking for your Gmail password. Message content is processed to classify and summarize email, including through AI service providers. You can disconnect your account from the dashboard. Our privacy policy explains what is collected, how it is used, and how to request deletion." },
  { question: "Is the dashboard on this page my real inbox?", answer: "It’s an interactive example with fictional emails. Feel free to search, switch views, listen to a sample brief, and mark messages done. To use Strike with your own email, create an account and connect Gmail from your dashboard." },
];

export default function LandingExperience() {
  const [signedIn, setSignedIn] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [paused, setPaused] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const reduced = useReducedMotion();
  const dashboardRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll();
  const progress = useSpring(scrollYProgress, { stiffness: 100, damping: 30 });
  const { scrollYProgress: dashboardProgress } = useScroll({ target: dashboardRef, offset: ["start end", "start 0.18"] });
  const dashboardTilt = useTransform(dashboardProgress, [0, 1], [13, 0]);
  const dashboardScale = useTransform(dashboardProgress, [0, 1], [0.91, 1]);
  const dashboardY = useTransform(dashboardProgress, [0, 1], [70, 0]);

  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    let active = true;
    const client = createSupabaseBrowserClient();
    const { data: { subscription } } = client.auth.onAuthStateChange((_event, session) => {
      if (active) setSignedIn(Boolean(session?.user));
    });
    void client.auth.getUser().then(({ data }) => { if (active) setSignedIn(Boolean(data.user)); }).catch(() => {});
    return () => { active = false; subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
        document.querySelector<HTMLButtonElement>('[aria-controls="mobile-navigation"]')?.focus();
      }
    };
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, [menuOpen]);

  const destination = signedIn ? "/dashboard" : "/signup";
  const actionLabel = signedIn ? "Open dashboard" : "Get started";
  // data-motion-paused is set to "true" only when paused by the user, matching CSS selector .page[data-motion-paused="true"]
  return <MotionConfig reducedMotion={paused ? "always" : "user"}><div className={s.page} data-motion-paused={paused ? "true" : undefined}>
    <a className={s.skipLink} href="#main">Skip to content</a>
    {!paused && <motion.div className={s.scrollProgress} style={{ scaleX: reduced ? scrollYProgress : progress }} aria-hidden="true" />}
    <header className={s.header}><div className={s.navInner}><Brand /><nav className={s.desktopNav} aria-label="Main navigation"><a href="#product">The product</a><a href="#how-it-works">How it works</a><a href="#privacy">Built on trust</a></nav><div className={s.navActions}><Link href={signedIn ? "/dashboard" : "/login"} className={s.login}>{signedIn ? "Your workspace" : "Log in"}</Link><Link className={s.navCta} href={destination}>{actionLabel}<ArrowUpRight size={15} /></Link><button className={s.menuToggle} type="button" aria-label={menuOpen ? "Close navigation" : "Open navigation"} aria-expanded={menuOpen} aria-controls="mobile-navigation" onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? <X size={21} /> : <Menu size={21} />}</button></div></div>
      {menuOpen && <nav id="mobile-navigation" className={s.mobileNav} aria-label="Mobile navigation"><a href="#product" onClick={() => setMenuOpen(false)}>The product<ArrowUpRight size={18} /></a><a href="#how-it-works" onClick={() => setMenuOpen(false)}>How it works<ArrowUpRight size={18} /></a><a href="#privacy" onClick={() => setMenuOpen(false)}>Built on trust<ArrowUpRight size={18} /></a><Link href={signedIn ? "/dashboard" : "/login"}>{signedIn ? "Your workspace" : "Log in"}<ArrowUpRight size={18} /></Link></nav>}
    </header>

    <main id="main">
      <section className={s.hero}>
        <div className={s.heroCopy}><Reveal><span className={s.heroEyebrow}><span className={s.signalDot} /> EMAIL INTELLIGENCE. HUMAN PRIORITIES.</span></Reveal><Reveal delay={0.08}><h1>Stay in <br />the loop.<br /><span className={s.heroSerif}>Out of the <br />inbox.</span><span className={s.headingPeriod}>*</span></h1></Reveal><Reveal delay={0.16}><p className={s.heroDescription}>Your inbox is full. <br />Your attention shouldn’t be.<br /><span>Strike turns the emails that matter into clear, actionable briefs. Straight to your WhatsApp.</span></p><div className={s.heroActions}><Link href={destination} className={s.primaryButton}>{signedIn ? "Open your dashboard" : "Find your focus"}<ArrowUpRight size={19} /></Link><a href="#product" className={s.textButton}><span className={s.playIcon}><ArrowDown size={15} /></span>See it in action</a></div></Reveal></div>
        <SignalSculpture paused={paused} />
        <div className={s.heroFootnote}><span><ShieldCheck size={15} /> Your Gmail. Your WhatsApp. A little more space.</span><a href="#product">SCROLL TO FIND YOUR SIGNAL<ArrowDown size={14} /></a></div>
      </section>

      <div className={s.integrationStrip}><span>FITS INTO YOUR DAY.<br /><strong>Not the other way around.</strong></span><div className={s.integrationFlow}><span><svg width="25" height="20" viewBox="0 0 25 20" aria-hidden="true"><path d="M2 18V3L12.5 11L23 3V18" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinejoin="round" /></svg>Gmail</span><i /><span className={s.integrationStrike}><StrikeMark />strike</span><i /><span><MessageCircle size={26} strokeWidth={1.6} />WhatsApp</span></div><span className={s.stripNote}>Less switching.<br />More doing.</span></div>

      <section id="product" className={s.productSection}><div className={s.productInner}><div className={s.sectionTop}><span className={s.eyebrow}><span className={s.signalDot} /> YOUR DAILY DOSE OF CLARITY</span><span className={s.sectionIndex}>01 / THE PRODUCT</span></div><Reveal className={s.productHeading}><h2>A busy inbox.<br /><span>A quiet mind.</span></h2><div><p>Everything that needs you.<br />Nothing that doesn’t.</p><span className={s.demoHint}><ArrowDownLeft size={19} /> This is a real playground. Try it.</span></div></Reveal>
        <div className={s.dashboardPerspective} ref={dashboardRef}><motion.div style={paused || reduced ? undefined : { rotateX: dashboardTilt, scale: dashboardScale, y: dashboardY }} className={s.dashboardMotion}><LandingDashboard /></motion.div></div>
        <div className={s.productCaption}><span><span className={s.signalDot} /> Interactive demo · Fictional inbox, real interactions</span><span>BUILT FOR YOUR NEXT MOVE<ArrowUpRight size={13} /></span></div>
        <div className={s.productPrinciples}><Reveal><span>01 — FIND THE SIGNAL</span><h3>Important beats unread.</h3><p>Surface the deadlines, decisions, and conversations that need you.</p></Reveal><Reveal delay={0.08}><span>02 — GET THE GIST</span><h3>Less reading. More knowing.</h3><p>Get the context and next steps, without digging through the thread.</p></Reveal><Reveal delay={0.16}><span>03 — KEEP MOVING</span><h3>Your brief comes to you.</h3><p>Text or voice, delivered to WhatsApp. Your attention stays yours.</p></Reveal></div>
      </div></section>

      <Journey paused={paused} />

      <section className={s.manifesto}><Reveal><span className={s.eyebrow}>THIS IS WHAT HEADSPACE LOOKS LIKE.</span><h2>Be there for the deal.<br />The big idea.<br /><span>The rest of your life.</span></h2><div className={s.manifestoBottom}><StrikeMark /><p>Your best work doesn’t happen in your inbox.<br />We’re here to help you get back to it.</p><a href={destination} className={s.roundArrow} aria-label={actionLabel}><ArrowUpRight size={25} /></a></div></Reveal><span className={s.manifestoAsterisk} aria-hidden="true">✳</span></section>

      <section id="privacy" className={s.trustSection}><div className={s.sectionTop}><span className={s.eyebrow}>PERSONAL MEANS PERSONAL.</span><span className={s.sectionIndex}>03 / BUILT ON TRUST</span></div><div className={s.trustGrid}><Reveal><div className={s.trustArt} aria-hidden="true"><div className={s.trustRing} /><div className={s.fingerprint}><Fingerprint size={100} strokeWidth={0.8} /></div><span className={s.trustStamp}><ShieldCheck size={14} /> YOUR INBOX. YOUR CONTROL.</span></div></Reveal><Reveal><h2>Earned access.<br /><span>Never assumed.</span></h2><p>Your email is personal. Connecting it to something new should feel like a decision you understand.</p><div className={s.trustRow}><LockKeyhole size={19} /><div><h3>Your password stays with Google.</h3><p>Connect through Google OAuth. Strike never asks for your Gmail password.</p></div></div><div className={s.trustRow}><SlidersHorizontal size={19} /><div><h3>You set the boundaries.</h3><p>Choose your delivery preferences and disconnect your Gmail account from your dashboard.</p></div></div><div className={s.trustRow}><ShieldCheck size={19} /><div><h3>Clarity about your data, too.</h3><p>Understand what’s processed, which services help deliver your briefs, and how to request deletion.</p></div></div><Link href="/privacy" className={s.privacyLink}>Read our privacy policy<ArrowUpRight size={16} /></Link></Reveal></div></section>

      <section id="questions" className={s.faqSection}><Reveal><span className={s.eyebrow}>A LITTLE MORE CLARITY.</span><h2>Good questions.<br /><span>Straight answers.</span></h2><p>Still curious?<br /><a href="mailto:mohitkumawatwork@gmail.com">Say hello <ArrowUpRight size={14} /></a></p></Reveal><div className={s.faqList}>{faqs.map((faq, i) => <div key={faq.question} className={`${s.faqItem} ${openFaq === i ? s.faqOpen : ""}`}><h3><button type="button" aria-expanded={openFaq === i} aria-controls={`faq-answer-${i}`} id={`faq-question-${i}`} onClick={() => setOpenFaq(openFaq === i ? null : i)}><span>{faq.question}</span>{openFaq === i ? <Minus size={18} /> : <Plus size={18} />}</button></h3><div id={`faq-answer-${i}`} role="region" aria-labelledby={`faq-question-${i}`} hidden={openFaq !== i}><p>{faq.answer}</p></div></div>)}</div></section>

      <section className={s.finalCta}><div className={s.ctaTop}><span className={s.eyebrow}><span className={s.signalDot} /> LESS NOISE STARTS HERE.</span><span>MAKE ROOM FOR WHAT MATTERS.</span></div><Reveal><h2>A little less inbox.<br /><span>A little more you.</span></h2><Link href={destination} className={s.primaryButton}>{signedIn ? "Open your dashboard" : "Get started with Strike"}<ArrowUpRight size={20} /></Link><p>Connect your Gmail. Find your signal.</p></Reveal><div className={s.ctaOrbit} aria-hidden="true"><StrikeMark /></div></section>
    </main>

    <footer className={s.footer}><div className={s.footerTop}><Brand /><p>Intelligence for your inbox.<br />Space for everything else.</p><a href="#main" className={s.backTop}>Back to top<ArrowUpRight size={17} /></a></div><div className={s.footerBottom}><span>© {new Date().getFullYear()} Strike</span><div><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link><a href="mailto:mohitkumawatwork@gmail.com">Contact</a><button type="button" aria-pressed={paused} onClick={() => setPaused(!paused)}><span className={paused ? s.motionOff : s.motionOn} />{paused ? "Motion paused" : "Pause motion"}</button></div><span>LESS, BUT BETTER.</span></div></footer>
  </div></MotionConfig>;
}
