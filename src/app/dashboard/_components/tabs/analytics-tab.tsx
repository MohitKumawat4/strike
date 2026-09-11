"use client";

import ui from "./modern-tabs.module.css";

import { useMemo, useState } from "react";
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
  Area,
  AreaChart,
} from "recharts";
import {
  BarChart2,
  TrendingUp,
  PieChart as PieChartIcon,
  Clock,
} from "lucide-react";

import type {
  ConnectedAccount,
  EmailMessage,
  ProcessingJob,
} from "../dashboard-shell";

type AnalyticsTabProps = {
  messages: EmailMessage[];
  accounts: ConnectedAccount[];
  jobs: ProcessingJob[];
};

const CHART_COLORS = {
  primary: "var(--brand-plum)",
  secondary: "var(--info)",
  grid: "var(--line-subtle)",
  text: "var(--muted)",
};
const CATEGORY_COLORS = [
  "var(--brand-plum)",
  "var(--info)",
  "var(--warning)",
  "var(--muted)",
  "var(--chart-line)",
];

export function AnalyticsTab({
  messages: allMessages,
  accounts,
  jobs,
}: AnalyticsTabProps) {
  const [accountFilter, setAccountFilter] = useState("all");
  const [volumeDays, setVolumeDays] = useState(14);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const messages = useMemo(
    () =>
      allMessages.filter(
        (message) =>
          accountFilter === "all" || message.account_id === accountFilter,
      ),
    [allMessages, accountFilter],
  );
  const scopedJobs = useMemo(() => {
    if (accountFilter === "all") return jobs;
    const ids = new Set(messages.map((message) => message.id));
    return jobs.filter((job) => ids.has(job.message_id));
  }, [jobs, messages, accountFilter]);
  const dailyVolume = useMemo(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    start.setDate(start.getDate() - volumeDays + 1);
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const days = Array.from({ length: volumeDays }, (_, index) => {
      const date = new Date(start);
      date.setDate(date.getDate() + index);
      return {
        date: date.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        }),
        count: 0,
        key: date.toDateString(),
      };
    });
    messages.forEach((message) => {
      if (!message.received_at) return;
      const date = new Date(message.received_at);
      if (date < start || date >= end) return;
      const day = days.find((day) => day.key === date.toDateString());
      if (day) day.count++;
    });
    return days;
  }, [messages, volumeDays]);

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
    return accounts
      .filter(
        (account) => accountFilter === "all" || account.id === accountFilter,
      )
      .map((a) => ({
        name: a.email_address.split("@")[0],
        emails: messages.filter((m) => m.account_id === a.id).length,
      }));
  }, [accounts, messages, accountFilter]);

  const timedJobs = useMemo(
    () =>
      scopedJobs.flatMap((job) => {
        if (!job.started_at || !job.completed_at) return [];
        const start = new Date(job.started_at).getTime();
        const end = new Date(job.completed_at).getTime();
        return Number.isFinite(start) && Number.isFinite(end) && end >= start
          ? [{ date: new Date(end), latency: (end - start) / 60000 }]
          : [];
      }),
    [scopedJobs],
  );
  const latencyData = useMemo(() => {
    const now = new Date();
    return Array.from({ length: 7 }, (_, index) => {
      const day = new Date(now);
      day.setDate(day.getDate() - 6 + index);
      const samples = timedJobs.filter(
        (job) => job.date.toDateString() === day.toDateString(),
      );
      return {
        date: day.toLocaleDateString("en-US", { weekday: "short" }),
        latency: samples.length
          ? Number(
              (
                samples.reduce((sum, job) => sum + job.latency, 0) /
                samples.length
              ).toFixed(2),
            )
          : null,
      };
    });
  }, [timedJobs]);
  const totalMessages = messages.length;
  const totalJobs = scopedJobs.length;
  const completedJobs = scopedJobs.filter(
    (j) => j.status === "completed",
  ).length;
  const avgLatency = timedJobs.length
    ? (
        timedJobs.reduce((sum, job) => sum + job.latency, 0) / timedJobs.length
      ).toFixed(2)
    : null;
  const categoryInsight = categoryBreakdown.find(
    (category) => category.name === selectedCategory,
  );

  return (
    <div className={ui.page}>
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

      <div className={ui.viewToolbar}>
        <div>
          <strong>See where your attention goes.</strong>
          <span>Totals reflect loaded messages and processing jobs.</span>
        </div>
        <label className={ui.selectLabel}>
          Mailbox
          <select
            aria-label="Analytics mailbox"
            value={accountFilter}
            onChange={(event) => setAccountFilter(event.target.value)}
          >
            <option value="all">All mailboxes</option>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.email_address}
              </option>
            ))}
          </select>
        </label>
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
          <span>Total processing jobs</span>
        </div>
        <div className="analytics-stat-card">
          <PieChartIcon size={18} />
          <strong>{completedJobs}</strong>
          <span>Completed</span>
        </div>
        <div className="analytics-stat-card">
          <Clock size={18} />
          <strong>{avgLatency === null ? "—" : `${avgLatency}m`}</strong>
          <span>
            {avgLatency === null
              ? "Awaiting timing data"
              : "Avg. recorded latency"}
          </span>
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
            <div
              className={ui.segmented}
              aria-label="Ingestion chart time range"
            >
              {[7, 14, 30].map((days) => (
                <button
                  type="button"
                  key={days}
                  aria-pressed={volumeDays === days}
                  onClick={() => setVolumeDays(days)}
                >
                  {days}d
                </button>
              ))}
            </div>
          </div>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={dailyVolume} barSize={18}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke={CHART_COLORS.grid}
                  vertical={false}
                />
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
                <Bar
                  dataKey="count"
                  fill={CHART_COLORS.primary}
                  radius={[4, 4, 0, 0]}
                />
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
                      .map((category) => (
                        <Cell
                          key={category.name}
                          fill={
                            CATEGORY_COLORS[
                              categoryBreakdown.findIndex(
                                (entry) => entry.name === category.name,
                              )
                            ]
                          }
                          opacity={
                            !selectedCategory ||
                            selectedCategory === category.name
                              ? 1
                              : 0.22
                          }
                        />
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
                <p>No classifications yet. Your categories will appear here.</p>
              </div>
            )}
            <p className={ui.chartInsight} aria-live="polite">
              {categoryInsight
                ? `${categoryInsight.value} ${categoryInsight.name.toLowerCase()} emails · ${totalMessages ? Math.round((categoryInsight.value / totalMessages) * 100) : 0}% of this mailbox selection`
                : "Select a category to explore its share of your inbox."}
            </p>
            <div className="chart-legend">
              {categoryBreakdown.map((cat, idx) => (
                <button
                  type="button"
                  className={ui.legendButton}
                  key={cat.name}
                  aria-pressed={selectedCategory === cat.name}
                  onClick={() =>
                    setSelectedCategory(
                      selectedCategory === cat.name ? null : cat.name,
                    )
                  }
                >
                  <i
                    style={{
                      background: CATEGORY_COLORS[idx % CATEGORY_COLORS.length],
                    }}
                  />
                  {cat.name} ({cat.value})
                </button>
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
              <p className={ui.chartInsight}>
                Last 7 days · recorded job durations in minutes
              </p>
            </div>
          </div>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={latencyData}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke={CHART_COLORS.grid}
                  vertical={false}
                />
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
                  <linearGradient
                    id="latencyGradient"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop
                      offset="5%"
                      stopColor={CHART_COLORS.primary}
                      stopOpacity={0.3}
                    />
                    <stop
                      offset="95%"
                      stopColor={CHART_COLORS.primary}
                      stopOpacity={0}
                    />
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
          {!latencyData.some((day) => day.latency !== null) && (
            <p className={ui.timingNotice}>
              No recorded job durations in the last 7 days. The latency chart
              will fill as timing data becomes available.
            </p>
          )}
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
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke={CHART_COLORS.grid}
                    horizontal={false}
                  />
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
                  <Bar
                    dataKey="emails"
                    fill={CHART_COLORS.secondary}
                    radius={[0, 4, 4, 0]}
                  />
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
    </div>
  );
}
