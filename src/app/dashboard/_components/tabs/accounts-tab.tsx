"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Mail,
  Plus,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  Shield,
  Trash2,
  RefreshCw,
} from "lucide-react";

import type { ConnectedAccount } from "../dashboard-shell";
import { ConfirmModal } from "../confirm-modal";

type AccountsTabProps = {
  accounts: ConnectedAccount[];
  email: string;
  onConnectGmail: () => void;
};

/* Connection status visual mapping */
const STATUS_CONFIG: Record<string, { icon: typeof CheckCircle2; className: string; label: string }> = {
  connected: { icon: CheckCircle2, className: "account-status-connected", label: "Connected" },
  unhealthy: { icon: AlertTriangle, className: "account-status-unhealthy", label: "Unhealthy" },
  disconnected: { icon: XCircle, className: "account-status-disconnected", label: "Disconnected" },
};

export function AccountsTab({ accounts, email, onConnectGmail }: AccountsTabProps) {
  const router = useRouter();
  const [syncingAccountId, setSyncingAccountId] = useState<string | null>(null);
  const [disconnectingId, setDisconnectingId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [accountToDisconnect, setAccountToDisconnect] = useState<{ id: string; email: string } | null>(null);

  async function handleSync(accountId?: string) {
    setSyncingAccountId(accountId || "all");
    setStatusMessage("Syncing mailbox…");
    try {
      const res = await fetch("/api/accounts/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId }),
      });
      const data = await res.json();
      if (data.success) {
        setStatusMessage("✓ Synced!");
        router.refresh();
      } else {
        setStatusMessage(`Error: ${data.error || "Sync failed"}`);
      }
    } catch {
      setStatusMessage("Sync failed");
    } finally {
      setTimeout(() => {
        setSyncingAccountId(null);
        setStatusMessage(null);
      }, 2500);
    }
  }

  async function executeDisconnect() {
    if (!accountToDisconnect) return;

    setDisconnectingId(accountToDisconnect.id);
    try {
      const res = await fetch("/api/accounts/disconnect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId: accountToDisconnect.id }),
      });
      const data = await res.json();
      if (data.success) {
        setAccountToDisconnect(null);
        router.refresh();
      } else {
        setStatusMessage(`Error: ${data.error || "Failed to disconnect"}`);
      }
    } catch {
      setStatusMessage("Disconnect failed");
    } finally {
      setDisconnectingId(null);
    }
  }

  return (
    <>
      {/* Header */}
      <div className="dashboard-title-row">
        <div>
          <p className="eyebrow">CONNECTED ACCOUNTS</p>
          <h1>Accounts</h1>
          <p className="dashboard-subtitle">
            Manage your connected Gmail accounts and view sync details.
          </p>
        </div>
        <div className="dashboard-toolbar">
          {accounts.length > 0 && (
            <button
              className="period-button"
              disabled={Boolean(syncingAccountId)}
              onClick={() => handleSync()}
              type="button"
            >
              <RefreshCw size={14} className={syncingAccountId === "all" ? "spin-icon" : ""} />
              <span>{statusMessage || (syncingAccountId === "all" ? "Syncing…" : "Sync All")}</span>
            </button>
          )}
          <button
            className="primary-button"
            onClick={onConnectGmail}
            type="button"
          >
            <Plus size={16} />
            <span>Connect Gmail</span>
          </button>
        </div>
      </div>

      {/* User Profile Summary Card */}
      <div className="panel profile-card">
        <div className="profile-card-content">
          <div className="profile-avatar-large">
            {email.slice(0, 2).toUpperCase()}
          </div>
          <div className="profile-info">
            <h3 style={{ margin: 0 }}>{email}</h3>
            <p className="muted-text">Primary account holder</p>
            <div className="profile-stats">
              <span className="profile-stat">
                <Mail size={14} />
                {accounts.length} account{accounts.length !== 1 ? "s" : ""} connected
              </span>
              <span className="profile-stat">
                <Shield size={14} />
                Workspace active
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Connected Accounts Grid */}
      {accounts.length > 0 ? (
        <div className="accounts-grid">
          {accounts.map((account) => {
            const config = STATUS_CONFIG[account.connection_status] || STATUS_CONFIG.disconnected;
            const StatusIcon = config.icon;
            const isThisSyncing = syncingAccountId === account.id || syncingAccountId === "all";
            const isThisDisconnecting = disconnectingId === account.id;

            /* Calculate "connected since" from created_at */
            const connectedSince = account.created_at
              ? new Date(account.created_at).toLocaleDateString("en-US", {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })
              : "Unknown";

            const lastSync = account.last_successful_sync_at
              ? new Date(account.last_successful_sync_at).toLocaleString("en-US", {
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : "Never";

            return (
              <article className="panel account-card" key={account.id}>
                {/* Card Header */}
                <div className="account-card-header">
                  <div className="account-card-icon">
                    <Mail size={20} />
                  </div>
                  <div className="account-card-meta">
                    <h3>{account.email_address}</h3>
                    <span className={`account-status-chip ${config.className}`}>
                      <StatusIcon size={12} />
                      {config.label}
                    </span>
                  </div>
                </div>

                {/* Card Details */}
                <div className="account-card-details">
                  <div className="account-detail-row">
                    <Clock size={14} />
                    <span>Connected since</span>
                    <strong>{connectedSince}</strong>
                  </div>
                  <div className="account-detail-row">
                    <CheckCircle2 size={14} />
                    <span>Last sync</span>
                    <strong>{lastSync}</strong>
                  </div>
                  <div className="account-detail-row">
                    <Shield size={14} />
                    <span>Provider</span>
                    <strong>Gmail (Google Workspace)</strong>
                  </div>
                </div>

                {/* Card Actions Footer */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginTop: "16px",
                    paddingTop: "14px",
                    borderTop: "1px solid var(--line)",
                    gap: "8px",
                  }}
                >
                  <button
                    className="period-button"
                    disabled={isThisSyncing || isThisDisconnecting}
                    onClick={() => handleSync(account.id)}
                    style={{ fontSize: "0.78rem", padding: "5px 10px" }}
                    type="button"
                  >
                    <RefreshCw size={13} className={isThisSyncing ? "spin-icon" : ""} />
                    <span>{isThisSyncing ? "Syncing…" : "Sync"}</span>
                  </button>

                  <button
                    className="secondary-button danger-button"
                    disabled={isThisSyncing || isThisDisconnecting}
                    onClick={() => setAccountToDisconnect({ id: account.id, email: account.email_address })}
                    style={{ fontSize: "0.78rem", padding: "5px 10px" }}
                    type="button"
                  >
                    <Trash2 size={13} />
                    <span>{isThisDisconnecting ? "Disconnecting…" : "Disconnect"}</span>
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        /* Empty State */
        <div className="panel empty-state-panel">
          <div className="empty-state">
            <Mail size={48} strokeWidth={1} />
            <h3>No accounts connected</h3>
            <p>Connect your first Gmail account to start syncing your inbox.</p>
            <button className="primary-button" onClick={onConnectGmail} type="button">
              <Plus size={16} />
              <span>Connect Gmail</span>
            </button>
          </div>
        </div>
      )}

      {/* Styled Personalized Confirmation Modal */}
      {accountToDisconnect && (
        <ConfirmModal
          cancelLabel="Keep Connected"
          confirmLabel="Disconnect Account"
          description={`Are you sure you want to disconnect ${accountToDisconnect.email}? Strike will stop receiving push updates and syncing emails from this mailbox.`}
          isDestructive={true}
          isLoading={Boolean(disconnectingId)}
          isOpen={Boolean(accountToDisconnect)}
          onClose={() => setAccountToDisconnect(null)}
          onConfirm={executeDisconnect}
          title="Disconnect Mailbox"
        />
      )}
    </>
  );
}
