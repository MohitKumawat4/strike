"use client";

import { useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Area,
  AreaChart,
} from "recharts";
import { BarChart2, TrendingUp, PieChart as PieChartIcon, Clock } from "lucide-react";

import type { ConnectedAccount, EmailMessage, ProcessingJob } from "../dashboard-shell";

type AnalyticsTabProps = {
  messages: EmailMessage[];
  accounts: ConnectedAccount[];
  jobs: ProcessingJob[];
};

/* Muted violet dusk color palette for charts */
const CHART_COLORS = {
  primary: "#7a3a7a",
  secondary: "#9b4291",
  tertiary: "#4348a6",
  quaternary: "#c76232",
  background: "rgba(122, 58, 122, 0.15)",
  grid: "rgba(255, 255, 255, 0.06)",
  gridLight: "rgba(38, 22, 34, 0.08)",
  text: "var(--muted)",
};

/* Category colors for pie chart */
const CATEGORY_COLORS = ["#7a3a7a", "#9b4291", "#4348a6", "#c76232", "#65285f"];

export function AnalyticsTab({ messages, accounts, jobs }: AnalyticsTabProps) {
  /* Compute daily ingestion volume for the last 14 days */
  const dailyVolume = useMemo(() => {
    const days: Record<string, number> = {};
    const now = new Date();

    // Initialize last 14 days with zero
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const key = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      days[key] = 0;
    }

    // Count messages per day
    messages.forEach((msg) => {
      if (!msg.received_at) return;
      const d = new Date(msg.received_at);
      const key = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      if (key in days) days[key]++;
    });

    return Object.entries(days).map(([date, count]) => ({ date, count }));
  }, [messages]);

  /* Category breakdown driven by live AI classifications */
  const categoryBreakdown = useMemo(() => {
    let important = 0;
    let normal = 0;
    let promotional = 0;
    let spam = 0;
    let uncategorized = 0;

    messages.forEach((msg) => {
      switch (msg.ai_category) {
        case "important":
          important++;
          break;
        case "normal":
          normal++;
          break;
        case "promotional":
          promotional++;
          break;
        case "spam":
          spam++;
          break;
        default:
          uncategorized++;
          break;
      }
    });

    const results = [
      { name: "Important", value: important },
      { name: "Normal", value: normal },
      { name: "Promotional", value: promotional },
      { name: "Spam", value: spam },
    ];

    if (uncategorized > 0 || messages.length === 0) {
      results.push({ name: "Uncategorized", value: uncategorized });
    }

    return results;
  }, [messages]);

  /* Account comparison: count messages per connected account */
  const accountVolume = useMemo(() => {
    return accounts.map((a) => ({
      name: a.email_address.split("@")[0],
      emails: messages.filter((m) => m.account_id === a.id).length,
    }));
  }, [accounts, messages]);

  /* Processing latency (placeholder — will be real once jobs have timing data) */
  const latencyData = useMemo(() => {
    const days: { date: string; latency: number }[] = [];
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      days.push({
        date: d.toLocaleDateString("en-US", { weekday: "short" }),
        latency: 0,
      });
    }
    return days;
  }, []);

  /* Summary stats */
  const totalMessages = messages.length;
  const totalJobs = jobs.length;
  const completedJobs = jobs.filter((j) => j.status === "completed").length;
  const avgLatency = 0; // Placeholder until timing data exists

  return (
    <>
      {/* Header */}
      <div className="dashboard-title-row">
        <div>
          <p className="eyebrow">INTELLIGENCE ANALYTICS</p>
          <h1>Analytics</h1>
          <p className="dashboard-subtitle">
            Visual insights into your email processing pipeline.
          </p>
        </div>
      </div>

      {/* Summary Stats Row */}
      <div className="analytics-stats-grid">
        <div className="analytics-stat-card">
          <BarChart2 size={18} />
          <strong>{totalMessages}</strong>
          <span>Total messages</span>
        </div>
        <div className="analytics-stat-card">
          <TrendingUp size={18} />
          <strong>{totalJobs}</strong>
          <span>Jobs processed</span>
        </div>
        <div className="analytics-stat-card">
          <PieChartIcon size={18} />
          <strong>{completedJobs}</strong>
          <span>Completed</span>
        </div>
        <div className="analytics-stat-card">
          <Clock size={18} />
          <strong>{avgLatency}m</strong>
          <span>Avg. latency</span>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="analytics-charts-grid">
        {/* Ingestion Volume — Bar Chart */}
        <div className="panel chart-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">INGESTION VOLUME</p>
              <h2>Emails per day</h2>
            </div>
          </div>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={dailyVolume} barSize={18}>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} vertical={false} />
                <XAxis
                  dataKey="date"
                  tick={{ fill: CHART_COLORS.text, fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: CHART_COLORS.text, fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={{
                    background: "var(--surface)",
                    border: "1px solid var(--line)",
                    borderRadius: 8,
                    fontSize: 12,
                    color: "var(--ink)",
                  }}
                />
                <Bar dataKey="count" fill={CHART_COLORS.primary} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Category Breakdown — Donut Chart */}
        <div className="panel chart-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">CLASSIFICATION</p>
              <h2>Category breakdown</h2>
            </div>
          </div>
          <div className="chart-container chart-container-centered">
            {categoryBreakdown.some((c) => c.value > 0) ? (
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie
                    data={categoryBreakdown.filter((c) => c.value > 0)}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    dataKey="value"
                    strokeWidth={2}
                    stroke="var(--surface)"
                  >
                    {categoryBreakdown
                      .filter((c) => c.value > 0)
                      .map((_, idx) => (
                        <Cell key={idx} fill={CATEGORY_COLORS[idx % CATEGORY_COLORS.length]} />
                      ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: "var(--surface)",
                      border: "1px solid var(--line)",
                      borderRadius: 8,
                      fontSize: 12,
                      color: "var(--ink)",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="chart-empty-state">
                <PieChartIcon size={32} strokeWidth={1} />
                <p>No data yet — awaiting AI triage (Phase 6)</p>
              </div>
            )}
            <div className="chart-legend">
              {categoryBreakdown.map((cat, idx) => (
                <span className="chart-legend-item" key={cat.name}>
                  <i style={{ background: CATEGORY_COLORS[idx % CATEGORY_COLORS.length] }} />
                  {cat.name} ({cat.value})
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Processing Latency — Area Chart */}
        <div className="panel chart-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">PERFORMANCE</p>
              <h2>Processing latency</h2>
            </div>
          </div>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={latencyData}>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} vertical={false} />
                <XAxis
                  dataKey="date"
                  tick={{ fill: CHART_COLORS.text, fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: CHART_COLORS.text, fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  unit="m"
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={{
                    background: "var(--surface)",
                    border: "1px solid var(--line)",
                    borderRadius: 8,
                    fontSize: 12,
                    color: "var(--ink)",
                  }}
                />
                <defs>
                  <linearGradient id="latencyGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={CHART_COLORS.primary} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={CHART_COLORS.primary} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area
                  type="monotone"
                  dataKey="latency"
                  stroke={CHART_COLORS.primary}
                  fill="url(#latencyGradient)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Account Comparison — Horizontal Bar Chart */}
        <div className="panel chart-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">ACCOUNTS</p>
              <h2>Email volume by account</h2>
            </div>
          </div>
          <div className="chart-container">
            {accountVolume.length > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={accountVolume} layout="vertical" barSize={20}>
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} horizontal={false} />
                  <XAxis
                    type="number"
                    tick={{ fill: CHART_COLORS.text, fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    allowDecimals={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    tick={{ fill: CHART_COLORS.text, fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    width={100}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "var(--surface)",
                      border: "1px solid var(--line)",
                      borderRadius: 8,
                      fontSize: 12,
                      color: "var(--ink)",
                    }}
                  />
                  <Bar dataKey="emails" fill={CHART_COLORS.secondary} radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="chart-empty-state">
                <BarChart2 size={32} strokeWidth={1} />
                <p>Connect accounts to compare volume</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
