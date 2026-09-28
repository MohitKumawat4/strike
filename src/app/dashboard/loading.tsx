import Link from "next/link";
import localFont from "next/font/local";
import { DashboardBrand } from "./_components/dashboard-brand";
import styles from "./_components/dashboard-shell.module.css";
import {
  AlertCircle,
  BarChart2,
  Bell,
  FileText,
  Flame,
  Inbox,
  LayoutDashboard,
  LogOut,
  Mail,
  Menu,
  Search,
  Settings2,
  Sun,
} from "lucide-react";

const dashboardFont = localFont({
  src: "../_fonts/geist-latin.woff2",
  display: "swap",
  variable: "--font-dashboard",
});

/**
 * Strike Kinetic Brand Loader
 *
 * A high-craftsmanship brand loader derived strictly from the Strike lightning geometry.
 * Features:
 *  - Spatial float and tilt motion (the loader has momentum and weight, not a static fixed shape)
 *  - Slower, stateful, readable line progression across each facet of the lightning bolt
 *  - Subtle, translucent breathing illumination (never a harsh or abrupt fill)
 */
function StrikeBrandLoader() {
  return (
    <div className="strike-loader-stage" aria-hidden="true">
      {/* Soft ambient atmospheric glow that gently breathes */}
      <div className="strike-ambient-glow" />

      {/* Kinetic Strike Brand Logo SVG */}
      <svg
        className="strike-brand-scene"
        width="64"
        height="74"
        viewBox="0 0 28 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {/* Subtle translucent gradient for the soft inner breath (never solid or harsh) */}
          <linearGradient id="strikeSubtleGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="var(--lime, #d6f58a)" stopOpacity="0.8" />
            <stop offset="100%" stopColor="var(--brand-plum, #506b38)" stopOpacity="0.4" />
          </linearGradient>

          {/* Liquid luminous stroke gradient for the slow, readable line progression */}
          <linearGradient id="strikeFlowGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
            <stop offset="35%" stopColor="var(--lime, #d6f58a)" stopOpacity="0.9" />
            <stop offset="100%" stopColor="var(--brand-plum, #506b38)" stopOpacity="0.4" />
          </linearGradient>
        </defs>

        {/* Faint blueprint silhouette track */}
        <path
          d="M15 1H26L17.5 12H27L9 31L12 19H1L15 1Z"
          fill="none"
          stroke="var(--line, rgba(214, 245, 138, 0.2))"
          strokeWidth="1.25"
          strokeLinejoin="round"
          strokeLinecap="round"
          opacity="0.25"
        />

        {/* Translucent ambient breathing fill: smoothly rises to ~0.25 opacity, never harsh */}
        <path
          className="strike-bolt-breath-fill"
          d="M15 1H26L17.5 12H27L9 31L12 19H1L15 1Z"
          fill="url(#strikeSubtleGrad)"
        />

        {/* Slower, stateful, readable traveling stroke */}
        <path
          className="strike-bolt-stateful-stroke"
          d="M15 1H26L17.5 12H27L9 31L12 19H1L15 1Z"
          fill="none"
          stroke="url(#strikeFlowGrad)"
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}

/**
 * Dashboard Loading Shell
 *
 * Keeps only the persistent top navbar and sidebar, which load instantly without
 * database dependencies. The main canvas features a floating, kinetic Strike brand
 * animation that provides a calm, elegant, and hypnotic loading experience.
 */
export default function DashboardLoading() {
  return (
    <div
      className={`dashboard-app ${styles.shell} ${dashboardFont.variable}`}
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label="Loading dashboard"
    >
      <style>{`
        /* Continuous spatial floating and subtle perspective tilt */
        @keyframes strikeFloatAndTilt {
          0% {
            transform: translateY(0px) rotate(0deg);
          }
          25% {
            transform: translateY(-8px) rotate(-4.5deg);
          }
          50% {
            transform: translateY(2px) rotate(2deg);
          }
          75% {
            transform: translateY(-6px) rotate(5deg);
          }
          100% {
            transform: translateY(0px) rotate(0deg);
          }
        }

        /* Slower, stateful, readable line progression around the lightning bolt */
        @keyframes strikeStrokeStateful {
          0% {
            stroke-dasharray: 4 110;
            stroke-dashoffset: 0;
            opacity: 0.25;
          }
          18% {
            stroke-dasharray: 38 110;
            stroke-dashoffset: -10;
            opacity: 0.95;
          }
          45% {
            stroke-dasharray: 55 110;
            stroke-dashoffset: -38;
            opacity: 1;
          }
          60% {
            stroke-dasharray: 68 110;
            stroke-dashoffset: -52;
            opacity: 1;
          }
          78% {
            stroke-dasharray: 86 110;
            stroke-dashoffset: -76;
            opacity: 0.9;
          }
          88% {
            stroke-dasharray: 107 110;
            stroke-dashoffset: -96;
            opacity: 0.8;
          }
          100% {
            stroke-dasharray: 4 110;
            stroke-dashoffset: -107;
            opacity: 0.25;
          }
        }

        /* Subtle, translucent breathing fill (gentle rise and fall, never a solid or abrupt pop) */
        @keyframes strikeSubtleBreath {
          0%, 35% {
            opacity: 0.02;
          }
          62% {
            opacity: 0.16;
          }
          82% {
            opacity: 0.25;
            filter: drop-shadow(0 0 10px rgba(214, 245, 138, 0.3));
          }
          94% {
            opacity: 0.12;
            filter: drop-shadow(0 0 4px rgba(214, 245, 138, 0.1));
          }
          100% {
            opacity: 0.02;
          }
        }

        /* Ambient atmospheric background breathing */
        @keyframes strikeAmbientPulse {
          0%, 100% {
            transform: scale(0.9);
            opacity: 0.35;
          }
          50% {
            transform: scale(1.15);
            opacity: 0.65;
          }
        }

        .strike-loader-stage {
          position: relative;
          width: 120px;
          height: 120px;
          display: flex;
          align-items: center;
          justify-content: center;
          animation: strikeFloatAndTilt 5.6s ease-in-out infinite;
        }

        .strike-ambient-glow {
          position: absolute;
          width: 130px;
          height: 130px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(214, 245, 138, 0.18) 0%, rgba(80, 107, 56, 0.06) 50%, transparent 72%);
          animation: strikeAmbientPulse 3.8s ease-in-out infinite;
          pointer-events: none;
        }

        .strike-brand-scene {
          position: relative;
          z-index: 2;
          overflow: visible;
        }

        .strike-bolt-stateful-stroke {
          animation: strikeStrokeStateful 3.8s cubic-bezier(0.45, 0.05, 0.25, 1) infinite;
        }

        .strike-bolt-breath-fill {
          animation: strikeSubtleBreath 3.8s ease-in-out infinite;
        }
      `}</style>

      {/* Persistent Top Header / Navbar */}
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
            className="header-avatar"
            style={{ width: "31px", height: "31px", borderRadius: "50%", display: "grid", placeItems: "center", background: "var(--avatar-surface, #e6ebd8)", color: "var(--avatar-ink, #576d40)", fontSize: "11px", fontWeight: 600 }}
          >
            ST
          </span>
        </div>
      </header>

      {/* Dashboard Body with Fixed Sidebar & Main Content Canvas */}
      <div className="dashboard-body">
        {/* Persistent Desktop Sidebar Navigation */}
        <aside className={`dashboard-sidebar ${styles.sidebarSurface}`}>
          <div className={styles.sidebarIntro}>
            <DashboardBrand />
            <div className={styles.workspaceIdentity}>
              <span style={{ display: "grid", placeItems: "center", width: "28px", height: "28px", borderRadius: "5px", background: "var(--surface-pill, #e1ebce)", color: "var(--brand-plum, #506b38)", fontSize: "11px", fontWeight: 700 }}>
                ST
              </span>
              <div>
                <strong>Your workspace</strong>
                <small>Personal email intelligence</small>
              </div>
            </div>
          </div>

          <p className={styles.navLabel}>YOUR DAILY SPACE</p>

          <nav aria-label="Dashboard navigation" className="sidebar-nav">
            <div className="nav-item active" style={{ cursor: "default" }}>
              <LayoutDashboard size={18} />
              <span>Overview</span>
            </div>
            <div className="nav-item" style={{ cursor: "default" }}>
              <Inbox size={18} />
              <span>Messages</span>
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
              <Link href="/privacy" className="sidebar-legal-link">Privacy</Link>
              <span className="sidebar-legal-dot">•</span>
              <Link href="/terms" className="sidebar-legal-link">Terms</Link>
            </div>
            <div className="sidebar-user-row">
              <span
                className="sidebar-user-avatar"
                style={{ width: "30px", height: "30px", borderRadius: "50%", display: "grid", placeItems: "center", background: "var(--avatar-surface, #e6ebd8)", color: "var(--avatar-ink, #576d40)", fontSize: "11px", fontWeight: 650 }}
              >
                ST
              </span>
              <div className="sidebar-user-info">
                <span className="sidebar-user-name">Workspace</span>
                <span className="sidebar-user-email">Syncing updates…</span>
              </div>
              <div className="sidebar-signout-btn" style={{ opacity: 0.5, cursor: "default" }} title="Sign out">
                <LogOut size={15} />
              </div>
            </div>
          </div>
        </aside>

        {/* Spacious Main Canvas hosting exclusively the kinetic Strike brand loader */}
        <main
          className="dashboard-main"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            minHeight: "calc(100vh - 60px)",
            width: "100%",
          }}
        >
          <StrikeBrandLoader />
        </main>
      </div>
    </div>
  );
}
