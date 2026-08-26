"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  Loader2,
  Play,
  RefreshCw,
  ShieldCheck,
  XCircle,
} from "lucide-react";

import type { ProcessingJob } from "../dashboard-shell";

type ProcessingTabProps = {
  jobs: ProcessingJob[];
};

/* Pipeline stage definitions in order */
const PIPELINE_STAGES = [
  { key: "ingestion", label: "Ingestion", icon: ShieldCheck },
  { key: "pre_filter", label: "Pre-Filtered", icon: ShieldCheck },
  { key: "triage", label: "Triaged", icon: ShieldCheck },
  { key: "summary", label: "Summarized", icon: ShieldCheck },
  { key: "delivery", label: "Delivered", icon: CheckCircle2 },
];

/* Job status badge mapping */
const JOB_STATUS_CONFIG: Record<string, { className: string; icon: typeof CheckCircle2 }> = {
  pending: { className: "badge-waiting", icon: Clock },
  running: { className: "badge-processing", icon: Loader2 },
  completed: { className: "badge-success", icon: CheckCircle2 },
  failed: { className: "badge-error", icon: XCircle },
  retrying: { className: "badge-waiting", icon: RefreshCw },
};

export function ProcessingTab({ jobs }: ProcessingTabProps) {
  const router = useRouter();
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  /* Compute stage counts from jobs */
  const stageCounts = PIPELINE_STAGES.map((stage) => ({
    ...stage,
    count: jobs.filter((j) => (j.current_stage || j.stage) === stage.key).length,
  }));

  /* Summary stats */
  const pending = jobs.filter((j) => j.status === "pending" || j.status === "retrying").length;
  const running = jobs.filter((j) => j.status === "running").length;
  const completed = jobs.filter((j) => j.status === "completed").length;
  const failed = jobs.filter((j) => j.status === "failed").length;

  async function handleProcessJobs() {
    setIsProcessing(true);
    setStatusMessage("Running processing pipeline…");

    try {
      const res = await fetch("/api/jobs/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ batchSize: 15 }),
      });
      const data = await res.json();

      if (data.status === "success") {
        setStatusMessage(`✓ Processed ${data.processed} jobs (${data.succeeded} succeeded)`);
        router.refresh();
      } else {
        setStatusMessage(`Error: ${data.message || "Failed"}`);
      }
    } catch {
      setStatusMessage("Processing failed");
    } finally {
      setTimeout(() => {
        setIsProcessing(false);
        setStatusMessage(null);
      }, 3500);
    }
  }

  return (
    <>
      {/* Header */}
      <div className="dashboard-title-row">
        <div>
          <p className="eyebrow">PROCESSING PIPELINE</p>
          <h1>Processing</h1>
          <p className="dashboard-subtitle">
            Track email processing stages and monitor job health.
          </p>
        </div>
        <div className="dashboard-toolbar">
          <button
            className="primary-button"
            disabled={isProcessing}
            onClick={handleProcessJobs}
            type="button"
          >
            {isProcessing ? (
              <Loader2 size={16} className="spin-icon" />
            ) : (
              <Play size={16} />
            )}
            <span>{statusMessage || (isProcessing ? "Processing…" : "Process Jobs Now")}</span>
          </button>
        </div>
      </div>

      {/* Pipeline Stage Visualization */}
      <div className="panel pipeline-panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">PIPELINE FLOW</p>
            <h2>Email Processing Stages</h2>
          </div>
        </div>
        <div className="pipeline-flow">
          {stageCounts.map((stage, idx) => {
            const Icon = stage.icon;
            return (
              <div className="pipeline-stage-wrapper" key={stage.key}>
                <div className={`pipeline-stage ${stage.count > 0 ? "pipeline-stage-active" : ""}`}>
                  <Icon size={20} />
                  <strong>{stage.count}</strong>
                  <span>{stage.label}</span>
                </div>
                {/* Arrow connector between stages */}
                {idx < stageCounts.length - 1 && (
                  <ArrowRight size={18} className="pipeline-arrow" />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Job Health Summary Cards */}
      <div className="processing-stats-grid">
        <div className="processing-stat-card">
          <Clock size={18} />
          <strong>{pending}</strong>
          <span>Pending</span>
        </div>
        <div className="processing-stat-card">
          <Loader2 size={18} className="spin-icon" />
          <strong>{running}</strong>
          <span>Running</span>
        </div>
        <div className="processing-stat-card">
          <CheckCircle2 size={18} />
          <strong>{completed}</strong>
          <span>Completed</span>
        </div>
        <div className="processing-stat-card">
          <XCircle size={18} />
          <strong>{failed}</strong>
          <span>Failed</span>
        </div>
      </div>

      {/* Recent Jobs Table */}
      {jobs.length > 0 ? (
        <div className="panel messages-table-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">RECENT JOBS</p>
              <h2>Processing History</h2>
            </div>
          </div>
          <table className="messages-table">
            <thead>
              <tr>
                <th>Job ID</th>
                <th>Stage</th>
                <th>Status</th>
                <th>Attempts</th>
                <th>Started</th>
              </tr>
            </thead>
            <tbody>
              {jobs.slice(0, 20).map((job) => {
                const statusConfig = JOB_STATUS_CONFIG[job.status] || JOB_STATUS_CONFIG.pending;
                const StatusIcon = statusConfig.icon;
                return (
                  <tr key={job.id} className="message-table-row">
                    <td>
                      <code>{job.id.slice(0, 8)}…</code>
                    </td>
                    <td>{job.current_stage || "—"}</td>
                    <td>
                      <span className={`status-badge ${statusConfig.className}`}>
                        <StatusIcon size={12} />
                        {job.status}
                      </span>
                    </td>
                    <td>{job.attempt_count ?? 0}</td>
                    <td>
                      {job.started_at
                        ? new Date(job.started_at).toLocaleString("en-US", {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        /* Empty State */
        <div className="panel empty-state-panel">
          <div className="empty-state">
            <ShieldCheck size={48} strokeWidth={1} />
            <h3>No processing jobs yet</h3>
            <p>Jobs will appear here once emails are synced and processed.</p>
          </div>
        </div>
      )}
    </>
  );
}
