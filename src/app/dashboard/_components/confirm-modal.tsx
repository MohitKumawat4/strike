"use client";

import { useEffect } from "react";
import { AlertTriangle, Trash2, X } from "lucide-react";

type ConfirmModalProps = {
  isOpen: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isDestructive?: boolean;
  isLoading?: boolean;
  onConfirm: () => void;
  onClose: () => void;
};

export function ConfirmModal({
  isOpen,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  isDestructive = false,
  isLoading = false,
  onConfirm,
  onClose,
}: ConfirmModalProps) {
  // Close on Escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && isOpen && !isLoading) {
        onClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isLoading, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="modal-overlay"
      onClick={isLoading ? undefined : onClose}
      aria-modal="true"
      role="dialog"
    >
      <div
        className="modal-card"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: 440,
          width: "90%",
          padding: "24px",
          background: "var(--surface)",
          border: "1px solid var(--line)",
          borderRadius: 16,
          boxShadow: "0 20px 40px rgba(0, 0, 0, 0.4)",
          animation: "scaleIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
        }}
      >
        {/* Modal Header Icon */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16 }}>
          <div
            style={{
              width: 42,
              height: 42,
              borderRadius: 12,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: isDestructive ? "rgba(199, 98, 50, 0.15)" : "var(--brand-plum)",
              color: isDestructive ? "var(--peach-glow)" : "var(--brand-plum-text)",
            }}
          >
            {isDestructive ? <AlertTriangle size={20} /> : <Trash2 size={20} />}
          </div>
          <button
            aria-label="Close modal"
            className="icon-button"
            disabled={isLoading}
            onClick={onClose}
            style={{ width: 28, height: 28 }}
            type="button"
          >
            <X size={16} />
          </button>
        </div>

        {/* Modal Title & Text */}
        <h3 style={{ margin: "0 0 8px 0", fontSize: "1.1rem", fontWeight: 600, color: "var(--ink)" }}>
          {title}
        </h3>
        <p style={{ margin: "0 0 24px 0", fontSize: "0.88rem", color: "var(--muted)", lineHeight: 1.5 }}>
          {description}
        </p>

        {/* Action Buttons */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            gap: "12px",
            marginTop: "8px",
          }}
        >
          {/* Cancel button */}
          <button
            className="secondary-button"
            disabled={isLoading}
            onClick={onClose}
            style={{
              padding: "8px 16px",
              fontSize: "0.85rem",
              borderRadius: "8px",
              fontWeight: 500,
              cursor: isLoading ? "not-allowed" : "pointer",
              transition: "all 0.15s ease",
            }}
            type="button"
          >
            {cancelLabel}
          </button>

          {/* Action / Destructive button */}
          <button
            className={isDestructive ? "secondary-button danger-button" : "primary-button"}
            disabled={isLoading}
            onClick={onConfirm}
            style={{
              padding: "8px 18px",
              fontSize: "0.85rem",
              borderRadius: "8px",
              fontWeight: 600,
              cursor: isLoading ? "not-allowed" : "pointer",
              transition: "all 0.15s ease",
              ...(isDestructive
                ? {
                    backgroundColor: "rgba(180, 50, 50, 0.08)",
                    borderColor: "rgba(180, 50, 50, 0.3)",
                    color: "#c62828",
                  }
                : {}),
            }}
            type="button"
          >
            {isLoading ? "Processing…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
