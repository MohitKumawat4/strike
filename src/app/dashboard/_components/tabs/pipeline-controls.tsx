"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Inbox, ShieldCheck, Sparkles, MessageSquare } from "lucide-react";
import {
  getPipelineControls,
  type PipelineControls as Controls,
} from "@/common/pipeline-controls";
import type { UserSettings } from "../dashboard-shell";
import ui from "./modern-tabs.module.css";

export function PipelineControls({
  userSettings,
  onSave,
}: {
  userSettings?: UserSettings | null;
  onSave?: (settings: UserSettings) => void;
}) {
  const initial = getPipelineControls({
    pipeline: userSettings?.pipeline,
    disable_processing: userSettings?.disable_processing,
  });
  return (
    <ControlsForm
      key={JSON.stringify(initial)}
      initial={initial}
      userSettings={userSettings}
      onSave={onSave}
    />
  );
}
function ControlsForm({
  initial,
  userSettings,
  onSave,
}: {
  initial: Controls;
  userSettings?: UserSettings | null;
  onSave?: (settings: UserSettings) => void;
}) {
  const router = useRouter();
  const [controls, setControls] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");
  const changed = JSON.stringify(controls) !== JSON.stringify(saved);
  async function save() {
    setSaving(true);
    setStatus("");
    try {
      const response = await fetch("/api/settings/pipeline", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(controls),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || "Could not save controls.");
      setSaved(controls);
      setStatus("Changes saved.");
      onSave?.({
        ...userSettings,
        pipeline: controls,
        disable_processing: false,
      });
      router.refresh();
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : "Could not save controls.",
      );
    } finally {
      setSaving(false);
    }
  }
  const items = [
    {
      key: "receive_emails",
      title: "Receive emails",
      text: "Fetch new emails from your connected Gmail accounts.",
      icon: Inbox,
    },
    {
      key: "filter_unwanted",
      title: "Filter unwanted emails",
      text: "Skip unwanted mail using Gmail labels and your existing rules.",
      icon: ShieldCheck,
    },
    {
      key: "use_ai",
      title: "Use AI",
      text: "Off sends a cleaned email preview without using AI quota.",
      icon: Sparkles,
    },
    {
      key: "send_whatsapp",
      title: "Send to WhatsApp",
      text: "Send email alerts and scheduled greetings to your connected number.",
      icon: MessageSquare,
    },
  ] as const;
  return (
    <section
      className={`panel ${ui.controlPanel}`}
      aria-labelledby="pipeline-controls-title"
    >
      <div className="panel-heading">
        <div>
          <h2 id="pipeline-controls-title">Pipeline controls</h2>
          <p className={ui.chartInsight}>
            Choose what runs. Your emails stay available in the dashboard.
          </p>
        </div>
        <span className={ui.tag}>
          {changed ? "Unsaved changes" : "Saved settings"}
        </span>
      </div>
      <fieldset className={ui.controlGrid} disabled={saving}>
        <legend className={ui.srOnly}>Pipeline stages</legend>
        {items.map((item) => (
          <label
            key={item.key}
            className={ui.controlCard}
            data-enabled={controls[item.key]}
          >
            <span className={ui.controlTop}>
              <item.icon size={19} />
              <span>
                {controls[item.key] ? "On" : "Off"}
                <input
                  type="checkbox"
                  role="switch"
                  aria-label={item.title}
                  checked={controls[item.key]}
                  onChange={(event) => {
                    setControls({
                      ...controls,
                      [item.key]: event.target.checked,
                    });
                    setStatus("");
                  }}
                />
              </span>
            </span>
            <strong>{item.title}</strong>
            <small>{item.text}</small>
          </label>
        ))}
      </fieldset>
      <div className={ui.controlBottom}>
        <p>
          {!controls.use_ai
            ? "AI is off: emails that pass your filters use a basic preview. No AI summary, score, or extracted actions."
            : "AI is on: the existing priority scoring and summary rules apply."}
          <br />
          {!controls.receive_emails
            ? "Receiving is paused. Already queued emails can still finish processing."
            : !controls.send_whatsapp
              ? "WhatsApp is paused. Emails remain in your dashboard."
              : "Resuming does not resend old emails."}
        </p>
        <button
          type="button"
          className="primary-button"
          disabled={saving || !changed}
          onClick={save}
        >
          {saving ? "Saving…" : "Save changes"}
        </button>
      </div>
      <p role="status" className={ui.statusText}>
        {status}
      </p>
    </section>
  );
}
