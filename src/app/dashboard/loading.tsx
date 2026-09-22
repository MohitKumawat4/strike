import localFont from "next/font/local";
import { DashboardBrand } from "./_components/dashboard-brand";
import styles from "./_components/dashboard-shell.module.css";
import overviewStyles from "./_components/tabs/overview-tab.module.css";
import inboxStyles from "./_components/tabs/inbox-workspace.module.css";
import {
  AlertCircle,
  BarChart2,
  Bell,
  CalendarDays,
  ChevronDown,
  FileText,
  Flame,
  Inbox,
  LayoutDashboard,
  Mail,
  Menu,
  Plus,
  Search,
  Settings2,
  Sparkles,
  Sun,
  TriangleAlert,
  Zap,
} from "lucide-react";

const dashboardFont = localFont({
  src: "../_fonts/geist-latin.woff2",
  display: "swap",
  variable: "--font-dashboard",
});

/**
 * Dashboard Loading Skeleton
 *
 * Faithfully mirrors the active dashboard's geometry, sidebar, layout, and olive/forest theme.
 * Rendered by Next.js App Router while parallel database queries complete.
 */
export default function DashboardLoading() {
  return (
    <div
      className={`dashboard-app ${styles.shell} ${dashboardFont.variable}`}
      aria-busy="true"
      aria-label="Loading dashboard"
    >
      <style>{`
        @keyframes skShimmer {
          0%, 100% { opacity: 0.45; }
          50% { opacity: 0.85; }
        }
        .sk-pulse {
          animation: skShimmer 1.8s ease-in-out infinite;
          background: var(--surface-muted);
        }
      `}</style>

      {/* Top Header - Fixed & offset by desktop sidebar */}
      <header className="dashboard-header">
        <div className="header-left">
          <div className="mobile-nav-toggle" aria-hidden="true">
            <Menu size={18} />
          </div>
          <div className={styles.mobileBrand}>
            <DashboardBrand />
          </div>
          <div className={styles.breadcrumb}>
            <span>Workspace</span>
            <span>/</span>
            <strong>Overview</strong>
          </div>
        </div>

        <div className="header-center">
          <div className="search-box" style={{ cursor: "default" }}>
            <Search size={15} aria-hidden="true" />
            <span className="search-placeholder">
              Search tabs, emails, VIP rules…
            </span>
            <kbd className="search-kbd">⌘ K</kbd>
          </div>
        </div>

        <div className="header-actions">
          <div className="icon-button" style={{ cursor: "default" }} aria-hidden="true">
            <Sun size={18} />
          </div>
          <div className="icon-button" style={{ cursor: "default" }} aria-hidden="true">
            <Bell size={18} />
            <span className="notification-dot" />
          </div>
          <span
            className="header-avatar sk-pulse"
            style={{ width: "31px", height: "31px", borderRadius: "50%", display: "inline-block" }}
          />
        </div>
      </header>

      {/* Dashboard Body with Fixed Sidebar & Main Content */}
      <div className="dashboard-body">
        {/* Desktop Fixed Dark Forest Sidebar */}
        <aside className={`dashboard-sidebar ${styles.sidebarSurface}`}>
          <div className={styles.sidebarIntro}>
            <DashboardBrand />
            <div className={styles.workspaceIdentity}>
              <span
                className="sk-pulse"
                style={{ width: "28px", height: "28px", borderRadius: "5px", display: "inline-block" }}
              />
              <div>
                <strong>Your workspace</strong>
                <small>Personal email intelligence</small>
              </div>
            </div>
          </div>

          <p className={styles.navLabel}>YOUR DAILY SPACE</p>

          <nav aria-label="Dashboard navigation skeleton" className="sidebar-nav">
            <div className="nav-item active" style={{ cursor: "default" }}>
              <LayoutDashboard size={18} />
              <span>Overview</span>
            </div>
            <div className="nav-item" style={{ cursor: "default" }}>
              <Inbox size={18} />
              <span>Messages</span>
              <span
                className="sk-pulse"
                style={{ width: "22px", height: "14px", borderRadius: "4px", marginLeft: "auto", display: "inline-block" }}
              />
            </div>
            <div className="nav-item" style={{ cursor: "default" }}>
              <Mail size={18} />
              <span>Accounts</span>
            </div>
            <div className="nav-item" style={{ cursor: "default" }}>
              <Flame size={18} />
              <span>Processing</span>
            </div>
            <div className="nav-item" style={{ cursor: "default" }}>
              <BarChart2 size={18} />
              <span>Analytics</span>
            </div>
            <div className="nav-item" style={{ cursor: "default" }}>
              <FileText size={18} />
              <span>Templates</span>
            </div>
            <div className="nav-item" style={{ cursor: "default" }}>
              <AlertCircle size={18} />
              <span>Error logs</span>
            </div>
            <div className="nav-item" style={{ cursor: "default" }}>
              <Settings2 size={18} />
              <span>Settings</span>
            </div>
          </nav>

          <div className={styles.sidebarConnection}>
            <Mail size={16} />
            <div>
              <strong>Connected mailboxes</strong>
              <small>Your inbox, in the loop.</small>
            </div>
            <span />
          </div>

          <div className="sidebar-footer">
            <div className="sidebar-legal">
              <span className="sidebar-legal-link">Privacy</span>
              <span className="sidebar-legal-dot">•</span>
              <span className="sidebar-legal-link">Terms</span>
            </div>
            <div className="sidebar-user-row">
              <span
                className="sidebar-user-avatar sk-pulse"
                style={{ width: "30px", height: "30px", borderRadius: "50%", display: "inline-block" }}
              />
              <div className="sidebar-user-info" style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <span className="sk-pulse" style={{ width: "65px", height: "10px", borderRadius: "3px", display: "block" }} />
                <span className="sk-pulse" style={{ width: "95px", height: "8px", borderRadius: "3px", display: "block" }} />
              </div>
            </div>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="dashboard-main">
          <section className="dashboard-content">
            <div className={overviewStyles.overview}>
              {/* Title & Toolbar Row */}
              <div className={overviewStyles.titleRow}>
                <div>
                  <p className={overviewStyles.eyebrow}>
                    <span className={overviewStyles.liveDot} /> YOUR COMMAND CENTER
                  </p>
                  <h1>
                    Dashboard <span>Overview.</span>
                  </h1>
                  <p className={overviewStyles.subtitle}>
                    Your inbox intelligence stream across all connected accounts.
                  </p>
                </div>
                <div className={overviewStyles.toolbar}>
                  <div className={overviewStyles.periodButton} style={{ opacity: 0.85, cursor: "default" }}>
                    <CalendarDays size={15} />
                    <span>7 Days</span>
                    <ChevronDown size={13} />
                  </div>
                  <div className={overviewStyles.primaryButton} style={{ opacity: 0.85, cursor: "default" }}>
                    <Plus size={16} />
                    <span>Connect Gmail</span>
                  </div>
                </div>
              </div>

              {/* 4 Metric Cards */}
              <section aria-label="Email metrics" className={overviewStyles.metrics}>
                {/* Metric 1 */}
                <article className={overviewStyles.metric}>
                  <div className={overviewStyles.metricTop}>
                    <span className={overviewStyles.metricIcon}>
                      <Mail size={17} />
                    </span>
                    <span>Received Today</span>
                    <span className={overviewStyles.metricTrend}>
                      <i />
                      Activity
                    </span>
                  </div>
                  <div className={overviewStyles.metricValueRow}>
                    <span className="sk-pulse" style={{ width: "52px", height: "32px", borderRadius: "6px", display: "inline-block" }} />
                    <span className={overviewStyles.metricBadge}>Today</span>
                  </div>
                  <span className="sk-pulse" style={{ width: "130px", height: "12px", borderRadius: "4px", display: "inline-block", marginTop: "4px" }} />
                </article>

                {/* Metric 2: Priority Signal */}
                <article className={`${overviewStyles.metric} ${overviewStyles.priorityMetric}`}>
                  <div className={overviewStyles.metricTop}>
                    <span className={overviewStyles.metricIcon}>
                      <Sparkles size={17} />
                    </span>
                    <span>Important Signals</span>
                    <span className={overviewStyles.metricTrend}>
                      <i />
                      Priority
                    </span>
                  </div>
                  <div className={overviewStyles.metricValueRow}>
                    <span className="sk-pulse" style={{ width: "46px", height: "32px", borderRadius: "6px", display: "inline-block" }} />
                    <span className={overviewStyles.metricBadge}>Filtered</span>
                  </div>
                  <span className="sk-pulse" style={{ width: "140px", height: "12px", borderRadius: "4px", display: "inline-block", marginTop: "4px" }} />
                </article>

                {/* Metric 3 */}
                <article className={overviewStyles.metric}>
                  <div className={overviewStyles.metricTop}>
                    <span className={overviewStyles.metricIcon}>
                      <Zap size={17} />
                    </span>
                    <span>WhatsApp Stream</span>
                    <span className={overviewStyles.metricTrend}>
                      <i />
                      Sync
                    </span>
                  </div>
                  <div className={overviewStyles.metricValueRow}>
                    <span className="sk-pulse" style={{ width: "58px", height: "32px", borderRadius: "6px", display: "inline-block" }} />
                    <span className={overviewStyles.metricBadge}>Meta API</span>
                  </div>
                  <span className="sk-pulse" style={{ width: "125px", height: "12px", borderRadius: "4px", display: "inline-block", marginTop: "4px" }} />
                </article>

                {/* Metric 4 */}
                <article className={overviewStyles.metric}>
                  <div className={overviewStyles.metricTop}>
                    <span className={overviewStyles.metricIcon}>
                      <TriangleAlert size={17} />
                    </span>
                    <span>Needs Attention</span>
                    <span className={overviewStyles.metricTrend}>
                      <i />
                      Healthy
                    </span>
                  </div>
                  <div className={overviewStyles.metricValueRow}>
                    <span className="sk-pulse" style={{ width: "38px", height: "32px", borderRadius: "6px", display: "inline-block" }} />
                    <span className={overviewStyles.metricBadge}>Clean</span>
                  </div>
                  <span className="sk-pulse" style={{ width: "115px", height: "12px", borderRadius: "4px", display: "inline-block", marginTop: "4px" }} />
                </article>
              </section>

              {/* Inbox Workspace 2-Column Skeleton */}
              <div className={inboxStyles.workspace}>
                <div className={inboxStyles.workspaceHeading}>
                  <div>
                    <span className={inboxStyles.eyebrow}>INBOX WORKSPACE</span>
                    <h2>Triage. Summary. Delivery.</h2>
                  </div>
                  <span className={inboxStyles.totalCount}>Loading inbox stream…</span>
                </div>

                <div className={inboxStyles.columns}>
                  {/* Left Column: Stream */}
                  <div className={inboxStyles.inbox}>
                    <div className={inboxStyles.listHeading}>
                      <strong>Signal stream</strong>
                      <span>Recent</span>
                    </div>

                    <div className={inboxStyles.filters}>
                      <div className="sk-pulse" style={{ width: "45px", height: "26px", borderRadius: "5px" }} />
                      <div className="sk-pulse" style={{ width: "65px", height: "26px", borderRadius: "5px" }} />
                      <div className="sk-pulse" style={{ width: "75px", height: "26px", borderRadius: "5px" }} />
                    </div>

                    <div className={inboxStyles.search}>
                      <Search size={14} style={{ opacity: 0.5 }} />
                      <span className="sk-pulse" style={{ width: "120px", height: "12px", borderRadius: "3px" }} />
                    </div>

                    <div className={inboxStyles.messageList}>
                      {Array.from({ length: 4 }).map((_, i) => (
                        <div
                          key={i}
                          className={inboxStyles.message}
                          style={{ cursor: "default" }}
                        >
                          <div
                            className={`sk-pulse ${inboxStyles.avatar}`}
                            style={{ width: "30px", height: "30px", borderRadius: "5px", flexShrink: 0 }}
                          />
                          <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: "6px" }}>
                            <div className={inboxStyles.messageTop}>
                              <span className="sk-pulse" style={{ width: "110px", height: "12px", borderRadius: "3px", display: "inline-block" }} />
                              <span className="sk-pulse" style={{ width: "35px", height: "10px", borderRadius: "3px", display: "inline-block" }} />
                            </div>
                            <span className="sk-pulse" style={{ width: `${75 + (i % 2) * 15}%`, height: "13px", borderRadius: "3px", display: "inline-block" }} />
                            <span className="sk-pulse" style={{ width: `${50 + (i % 3) * 15}%`, height: "10px", borderRadius: "3px", display: "inline-block" }} />
                            <div className={inboxStyles.messageBottom}>
                              <div style={{ display: "flex", gap: "6px" }}>
                                <span className="sk-pulse" style={{ width: "48px", height: "16px", borderRadius: "3px", display: "inline-block" }} />
                                <span className="sk-pulse" style={{ width: "36px", height: "16px", borderRadius: "3px", display: "inline-block" }} />
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Right Column: Brief Preview */}
                  <div className={inboxStyles.contextColumn}>
                    <div className={inboxStyles.reader}>
                      <div className={inboxStyles.readerHeading}>
                        <span style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "11px", fontWeight: 550, color: "var(--muted)" }}>
                          <Sparkles size={14} style={{ color: "var(--brand-plum)" }} />
                          Executive Briefing Preview
                        </span>
                        <span className="sk-pulse" style={{ width: "60px", height: "18px", borderRadius: "10px" }} />
                      </div>

                      <div style={{ padding: "24px 26px", display: "flex", flexDirection: "column", gap: "20px" }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                          <span className="sk-pulse" style={{ width: "70%", height: "16px", borderRadius: "4px" }} />
                          <span className="sk-pulse" style={{ width: "40%", height: "12px", borderRadius: "4px" }} />
                        </div>

                        <div
                          style={{
                            padding: "16px",
                            borderRadius: "8px",
                            border: "1px solid var(--line-subtle)",
                            background: "var(--surface-muted)",
                            display: "flex",
                            flexDirection: "column",
                            gap: "8px",
                          }}
                        >
                          <span className="sk-pulse" style={{ width: "95%", height: "12px", borderRadius: "3px" }} />
                          <span className="sk-pulse" style={{ width: "88%", height: "12px", borderRadius: "3px" }} />
                          <span className="sk-pulse" style={{ width: "60%", height: "12px", borderRadius: "3px" }} />
                        </div>

                        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                          <span className="sk-pulse" style={{ width: "100px", height: "11px", borderRadius: "3px" }} />
                          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                            <span className="sk-pulse" style={{ width: "16px", height: "16px", borderRadius: "4px", flexShrink: 0 }} />
                            <span className="sk-pulse" style={{ width: "80%", height: "12px", borderRadius: "3px" }} />
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                            <span className="sk-pulse" style={{ width: "16px", height: "16px", borderRadius: "4px", flexShrink: 0 }} />
                            <span className="sk-pulse" style={{ width: "65%", height: "12px", borderRadius: "3px" }} />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Operations Section */}
              <div className={overviewStyles.operationsHeading}>
                <span className={overviewStyles.eyebrow}>BEHIND YOUR BRIEF</span>
                <span>Connected. Processing. Delivering.</span>
              </div>
              <section className={overviewStyles.operationsGrid}>
                {/* Health Panel */}
                <article className={`${overviewStyles.panel} ${overviewStyles.healthPanel}`}>
                  <div className={overviewStyles.panelHeader}>
                    <div>
                      <p className={overviewStyles.eyebrow}>PROCESSING HEALTH</p>
                      <h2>Pipeline Active & Clear</h2>
                    </div>
                    <span className={overviewStyles.healthBadge}>
                      <i className={overviewStyles.liveDot} />
                      99.9% Uptime
                    </span>
                  </div>
                  <div className={overviewStyles.healthVisual}>
                    <div className={overviewStyles.healthGrid} aria-hidden="true" />
                    <span className={overviewStyles.flowEndpoint}>
                      <Mail size={17} />
                      <span>INBOX</span>
                    </span>
                    <div className={overviewStyles.latency}>
                      <span className="sk-pulse" style={{ width: "36px", height: "18px", borderRadius: "4px" }} />
                      <span>AVG. LATENCY</span>
                    </div>
                    <span className={overviewStyles.flowEndpoint}>
                      <Zap size={17} />
                      <span>DELIVERY</span>
                    </span>
                  </div>
                </article>

                {/* Telemetry / Integration Panel */}
                <article className={overviewStyles.panel}>
                  <div className={overviewStyles.panelHeader}>
                    <div>
                      <p className={overviewStyles.eyebrow}>TELEMETRY & STATUS</p>
                      <h2>System Ingestion Ready</h2>
                    </div>
                    <span className={overviewStyles.healthBadge}>
                      <i className={overviewStyles.liveDot} />
                      Standby
                    </span>
                  </div>
                  <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "12px" }}>
                    <div className="sk-pulse" style={{ width: "100%", height: "38px", borderRadius: "6px" }} />
                    <div className="sk-pulse" style={{ width: "100%", height: "38px", borderRadius: "6px" }} />
                    <div className="sk-pulse" style={{ width: "70%", height: "38px", borderRadius: "6px" }} />
                  </div>
                </article>
              </section>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
