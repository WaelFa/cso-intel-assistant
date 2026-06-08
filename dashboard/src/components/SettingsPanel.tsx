"use client";

import React, { useState, useEffect } from "react";
import { Loader2, Save, CheckCircle2, AlertCircle, Clock } from "lucide-react";
import { useDashboard } from "../context/DashboardContext";

const COMMON_TIMEZONES = [
  "UTC",
  "Asia/Dubai",
  "Asia/Riyadh",
  "Asia/Qatar",
  "Asia/Kolkata",
  "Asia/Singapore",
  "Asia/Hong_Kong",
  "Europe/London",
  "Europe/Luxembourg",
  "America/New_York",
  "America/Los_Angeles",
];

// Common 5-field cron presets the user is most likely to want.
const CRON_PRESETS: { label: string; value: string; description: string }[] = [
  { label: "Every day at 06:30", value: "30 6 * * *", description: "Pre-market briefing" },
  { label: "Every day at 07:00", value: "0 7 * * *", description: "Just before the CSO logs in" },
  { label: "Every day at 07:40", value: "40 7 * * *", description: "20 min before an 8:00 login" },
  { label: "Every day at 08:00", value: "0 8 * * *", description: "Right at the start of the day" },
  { label: "Every Monday at 07:00", value: "0 7 * * 1", description: "Weekly digest (less frequent)" },
];

function describeCron(expr: string): string {
  const match = expr.trim().match(/^(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)$/);
  if (!match) return expr;
  const [, minute, hour, , , dow] = match;
  const h = hour === "*" ? "" : `${hour.padStart(2, "0")}:`;
  const m = minute === "*" ? "00" : minute.padStart(2, "0");
  if (dow !== "*") {
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    return `${days[parseInt(dow, 10) % 7] ?? dow} ${h}${m}`;
  }
  return `Daily at ${h}${m}`;
}

export default function SettingsPanel() {
  const {
    settings,
    isSettingsLoading,
    isSettingsSaving,
    settingsError,
    fetchSettings,
    saveSettings,
  } = useDashboard();

  // Local form state so typing doesn't immediately PUT every keystroke.
  const [cron, setCron] = useState("");
  const [timezone, setTimezone] = useState("UTC");
  const [justSaved, setJustSaved] = useState(false);

  useEffect(() => {
    if (settings) {
      setCron(settings.briefingCron);
      setTimezone(settings.briefingTimezone);
    }
  }, [settings]);

  const onSave = async () => {
    const ok = await saveSettings({ briefingCron: cron, briefingTimezone: timezone });
    if (ok) {
      setJustSaved(true);
      window.setTimeout(() => setJustSaved(false), 2500);
    }
  };

  const dirty = settings ? cron !== settings.briefingCron || timezone !== settings.briefingTimezone : false;

  return (
    <div className="config-card">
      <div className="config-card-header">
        <span className="name">
          <Clock size={14} style={{ marginRight: 8, verticalAlign: "-2px" }} />
          Overnight Briefing Scheduler
        </span>
        <span className="badge">live</span>
      </div>

      <p style={{ fontSize: 12, color: "var(--text-muted)", margin: 0, lineHeight: 1.5 }}>
        When the overnight intelligence briefing should be prepared. The system fans out to live
        market, regulatory, and competitor search and writes a snapshot to disk so the dashboard
        opens with fresh data on your first click.
      </p>

      {isSettingsLoading ? (
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 0" }}>
          <Loader2 size={14} className="animate-spin" />
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Loading current settings...</span>
        </div>
      ) : null}

      {settingsError ? (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: 10,
            backgroundColor: "#fef2f2",
            border: "1px solid #fecaca",
            borderRadius: 8,
            color: "#b91c1c",
            fontSize: 12,
          }}
        >
          <AlertCircle size={14} />
          {settingsError}
        </div>
      ) : null}

      {/* Cron expression */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <label
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: "var(--text-secondary)",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
          }}
        >
          Schedule (cron expression)
        </label>
        <input
          type="text"
          value={cron}
          onChange={(e) => setCron(e.target.value)}
          placeholder="40 7 * * *"
          style={{
            fontFamily: "monospace",
            fontSize: 13,
            padding: "8px 10px",
            border: "1px solid var(--border-color)",
            borderRadius: 8,
            background: "#f8fafc",
            color: "var(--text-primary)",
          }}
        />
        <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
          {cron ? describeCron(cron) : "5 fields: minute hour day-of-month month day-of-week"}
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
          {CRON_PRESETS.map((preset) => (
            <button
              key={preset.value}
              type="button"
              onClick={() => setCron(preset.value)}
              title={preset.description}
              style={{
                fontSize: 11,
                padding: "4px 8px",
                borderRadius: 6,
                border:
                  cron === preset.value
                    ? "1px solid var(--color-blue)"
                    : "1px solid var(--border-color)",
                background: cron === preset.value ? "rgba(59, 130, 246, 0.08)" : "white",
                color: cron === preset.value ? "var(--color-blue)" : "var(--text-secondary)",
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      {/* Timezone */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <label
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: "var(--text-secondary)",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
          }}
        >
          Timezone
        </label>
        <select
          value={timezone}
          onChange={(e) => setTimezone(e.target.value)}
          style={{
            fontSize: 13,
            padding: "8px 10px",
            border: "1px solid var(--border-color)",
            borderRadius: 8,
            background: "#f8fafc",
            color: "var(--text-primary)",
          }}
        >
          {COMMON_TIMEZONES.map((tz) => (
            <option key={tz} value={tz}>
              {tz}
            </option>
          ))}
        </select>
        <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
          All times are interpreted in this zone. Server runs in the runtime timezone; this setting
          translates the cron expression accordingly.
        </div>
      </div>

      {/* Save row */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          paddingTop: 8,
          borderTop: "1px solid #f1f5f9",
        }}
      >
        <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
          {settings?.updatedAt
            ? `Last updated: ${new Date(settings.updatedAt).toLocaleString()}`
            : "Using default schedule."}
        </div>
        <button
          type="button"
          onClick={onSave}
          disabled={!dirty || isSettingsSaving}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "8px 14px",
            borderRadius: 8,
            border: "none",
            background: !dirty || isSettingsSaving ? "#e2e8f0" : "var(--color-blue)",
            color: !dirty || isSettingsSaving ? "#94a3b8" : "white",
            fontSize: 12,
            fontWeight: 700,
            cursor: !dirty || isSettingsSaving ? "not-allowed" : "pointer",
          }}
        >
          {isSettingsSaving ? (
            <Loader2 size={12} className="animate-spin" />
          ) : justSaved ? (
            <CheckCircle2 size={12} />
          ) : (
            <Save size={12} />
          )}
          {justSaved ? "Saved" : isSettingsSaving ? "Saving..." : "Save Changes"}
        </button>
      </div>
    </div>
  );
}
