import { DashboardBrand } from "./_components/dashboard-brand";
import { Loader2 } from "lucide-react";

/**
 * Dashboard Loading Skeleton
 *
 * Rendered instantly by Next.js App Router when transitioning to /dashboard
 * while server components fetch Supabase tables and accounts in parallel.
 */
export default function DashboardLoading() {
  return (
    <div className="dashboard-app" aria-busy="true" aria-label="Loading dashboard">
      {/* Header bar skeleton */}
      <header className="dashboard-header">
        <div className="header-left">
          <DashboardBrand />
        </div>

        <div className="header-center">
          <div
            style={{
              width: "280px",
              height: "36px",
              borderRadius: "8px",
              background: "var(--surface-muted, #f4ecdf)",
              opacity: 0.6,
            }}
          />
        </div>

        <div className="header-actions">
          <div
            style={{
              width: "36px",
              height: "36px",
              borderRadius: "50%",
              background: "var(--surface-muted, #f4ecdf)",
              opacity: 0.6,
            }}
          />
        </div>
      </header>

      {/* Dashboard body skeleton */}
      <div className="dashboard-body">
        {/* Sidebar skeleton */}
        <aside className="dashboard-sidebar" style={{ opacity: 0.85 }}>
          <div style={{ padding: "20px 16px", display: "flex", flexDirection: "column", gap: "14px" }}>
            <div style={{ height: "32px", width: "140px", borderRadius: "6px", background: "var(--surface-muted, #f4ecdf)" }} />
            <div style={{ height: "1px", background: "var(--line, #eadfce)", margin: "8px 0" }} />
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                style={{
                  height: "34px",
                  width: `${80 + (i % 3) * 20}%`,
                  borderRadius: "6px",
                  background: "var(--surface-muted, #f4ecdf)",
                  opacity: 0.7 - i * 0.08,
                }}
              />
            ))}
          </div>
        </aside>

        {/* Main content skeleton */}
        <main className="dashboard-main" style={{ minHeight: "calc(100vh - 64px)" }}>
          <div className="dashboard-content" style={{ maxWidth: "1200px", margin: "0 auto", padding: "36px 32px" }}>
            {/* Title row loader */}
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "32px" }}>
              <Loader2 size={24} className="spin-icon" style={{ color: "var(--brand-plum, #502d55)" }} />
              <div>
                <h1 style={{ fontSize: "22px", fontWeight: 700, color: "var(--ink, #2b162f)", margin: 0 }}>
                  Opening your dashboard…
                </h1>
                <p style={{ fontSize: "13px", color: "var(--muted, #6e526a)", margin: "4px 0 0" }}>
                  Fetching inbox intelligence and system telemetry
                </p>
              </div>
            </div>

            {/* Metric cards skeleton grid */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "20px", marginBottom: "32px" }}>
              {Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  style={{
                    height: "120px",
                    background: "var(--surface, #ffffff)",
                    borderRadius: "12px",
                    border: "1px solid var(--line, #eadfce)",
                    padding: "20px",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                  }}
                >
                  <div style={{ width: "40%", height: "14px", borderRadius: "4px", background: "var(--surface-muted, #f4ecdf)" }} />
                  <div style={{ width: "65%", height: "28px", borderRadius: "6px", background: "var(--surface-muted, #f4ecdf)" }} />
                </div>
              ))}
            </div>

            {/* Message intelligence table skeleton */}
            <div
              style={{
                background: "var(--surface, #ffffff)",
                borderRadius: "12px",
                border: "1px solid var(--line, #eadfce)",
                padding: "24px",
                minHeight: "260px",
                display: "flex",
                flexDirection: "column",
                gap: "16px",
              }}
            >
              <div style={{ width: "200px", height: "18px", borderRadius: "4px", background: "var(--surface-muted, #f4ecdf)" }} />
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  style={{
                    height: "44px",
                    borderRadius: "8px",
                    background: "var(--surface-muted, #f4ecdf)",
                    opacity: 0.6 - i * 0.1,
                  }}
                />
              ))}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
