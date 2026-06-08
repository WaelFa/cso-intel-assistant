"use client";

import React, { useState, useEffect, useMemo } from "react";
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

const DAYS: { value: number; label: string; short: string }[] = [
  { value: 1, label: "Monday", short: "Mon" },
  { value: 2, label: "Tuesday", short: "Tue" },
  { value: 3, label: "Wednesday", short: "Wed" },
  { value: 4, label: "Thursday", short: "Thu" },
  { value: 5, label: "Friday", short: "Fri" },
  { value: 6, label: "Saturday", short: "Sat" },
  { value: 0, label: "Sunday", short: "Sun" },
];

// ── Cron parser & serializer ─────────────────────────────────────
//
// The backend stores a 5-field cron expression. This panel does NOT
// ask the user to type one. We expose three friendly controls:
//   1. <input type="time"> for the hour/minute
//   2. A "Every day" / weekday chips for the day-of-week
//   3. A timezone <select>
//
// On load we parse the persisted cron into the form fields. On save
// we serialise the form fields back into a cron string. This keeps
// the user-facing UI ignorant of cron syntax while the wire format
// stays the standard 5-field expression the scheduler already
// understands.

function parseCron(expr: string): { hour: number; minute: number; days: number[] } {
  // node-cron 5-field: "minute hour dom month dow"
  // dom and month are forced to "*" because this UI only supports
  // "by time-of-day, optionally narrowed to specific weekdays".
  const match = expr.trim().match(/^(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)$/);
  if (!match) return { hour: 7, minute: 40, days: [] };
  const [, minute, hour, , , dow] = match;
  const h = Number.parseInt(hour, 10);
  const m = Number.parseInt(minute, 10);
  if (Number.isNaN(h) || Number.isNaN(m)) return { hour: 7, minute: 40, days: [] };
  let days: number[] = [];
  if (dow === "*") {
    days = [];
  } else if (dow.includes(",")) {
    days = dow.split(",").map((d) => Number.parseInt(d.trim(), 10)).filter((n) => !Number.isNaN(n));
  } else {
    const n = Number.parseInt(dow, 10);
    if (!Number.isNaN(n)) days = [n];
  }
  return { hour: h, minute: m, days };
}

function serialiseCron(hour: number, minute: number, days: number[]): string {
  const mm = String(minute).padStart(2, "0");
  const hh = String(hour).padStart(2, "0");
  const dow = days.length === 0 ? "*" : [...days].sort((a, b) => a - b).join(",");
  return `${mm} ${hh} * * ${dow}`;
}

function formatTime(hour: number, minute: number): string {
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function describeSchedule(hour: number, minute: number, days: number[], timezone: string): string {
  const time = formatTime(hour, minute);
  if (days.length === 0) {
    return `Every day at ${time} (${timezone})`;
  }
  if (days.length === 7) {
    return `Every day at ${time} (${timezone})`;
  }
  if (days.length === 5 && [1, 2, 3, 4, 5].every((d) => days.includes(d))) {
    return `Weekdays at ${time} (${timezone})`;
  }
  if (days.length === 2 && days.includes(1) && days.includes(5)) {
    return `Mon & Fri at ${time} (${timezone})`;
  }
  const names = days
    .slice()
    .sort((a, b) => a - b)
    .map((d) => DAYS.find((day) => day.value === d)?.short ?? String(d))
    .join(", ");
  return `${names} at ${time} (${timezone})`;
}

function nextRunPreview(hour: number, minute: number, days: number[], timezone: string): string {
  // Compute the next time this schedule fires, in the chosen
  // timezone, relative to "now" in the same zone. This is a hint
  // only — the actual scheduling is done by node-cron.
  try {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    const parts = formatter.formatToParts(now);
    const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
    const dayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    const todayDow = dayMap[get("weekday")] ?? 0;
    const nowHour = Number.parseInt(get("hour") === "24" ? "0" : get("hour"), 10);
    const nowMinute = Number.parseInt(get("minute"), 10);
    const currentMinutes = nowHour * 60 + nowMinute;
    const targetMinutes = hour * 60 + minute;

    let dayOffset = 0;
    if (days.length === 0) {
      // every day
      if (targetMinutes <= currentMinutes) dayOffset = 1;
    } else {
      // find the next day in the selected set
      for (let i = 0; i < 8; i += 1) {
        const candidate = (todayDow + i) % 7;
        if (days.includes(candidate)) {
          if (i === 0 && targetMinutes <= currentMinutes) continue;
          dayOffset = i;
          break;
        }
      }
      if (dayOffset === 0 && !days.includes(todayDow)) dayOffset = 7;
    }

    // Build the "next" timestamp by adding dayOffset days at the
    // target time in the target zone. We do it in UTC arithmetic
    // using the zone's current offset, which is good enough for a
    // "soon" preview.
    const target = new Date(now.getTime());
    target.setUTCDate(target.getUTCDate() + dayOffset);
    target.setUTCHours(hour, minute, 0, 0);

    const rel =
      dayOffset === 0 ? "today" : dayOffset === 1 ? "tomorrow" : `in ${dayOffset} days`;
    return `Next run: ${target.toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })} (${rel}, ${timezone})`;
  } catch {
    return `Runs at ${formatTime(hour, minute)} ${timezone}`;
  }
}

export default function SettingsPanel() {
  const {
    settings,
    isSettingsLoading,
    isSettingsSaving,
    settingsError,
    saveSettings,
  } = useDashboard();

  const [hour, setHour] = useState(7);
  const [minute, setMinute] = useState(40);
  const [days, setDays] = useState<number[]>([]); // empty = every day
  const [timezone, setTimezone] = useState("UTC");
  const [justSaved, setJustSaved] = useState(false);

  // Initialise the form from the persisted settings.
  useEffect(() => {
    if (settings) {
      const parsed = parseCron(settings.briefingCron);
      setHour(parsed.hour);
      setMinute(parsed.minute);
      setDays(parsed.days);
      setTimezone(settings.briefingTimezone);
    }
  }, [settings]);

  const derivedCron = useMemo(
    () => serialiseCron(hour, minute, days),
    [hour, minute, days],
  );

  const onSave = async () => {
    const ok = await saveSettings({
      briefingCron: derivedCron,
      briefingTimezone: timezone,
    });
    if (ok) {
      setJustSaved(true);
      window.setTimeout(() => setJustSaved(false), 2500);
    }
  };

  const dirty = settings
    ? derivedCron !== settings.briefingCron || timezone !== settings.briefingTimezone
    : false;

  const toggleDay = (value: number) => {
    setDays((prev) =>
      prev.includes(value) ? prev.filter((d) => d !== value) : [...prev, value],
    );
  };

  const onTimeChange = (raw: string) => {
    // <input type="time"> gives "HH:MM" in 24-hour.
    const [h, m] = raw.split(":").map((n) => Number.parseInt(n, 10));
    if (!Number.isNaN(h)) setHour(h);
    if (!Number.isNaN(m)) setMinute(m);
  };

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

      {/* Time of day */}
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
          Time of day
        </label>
        <input
          type="time"
          value={formatTime(hour, minute)}
          onChange={(e) => onTimeChange(e.target.value)}
          style={{
            fontSize: 14,
            fontWeight: 600,
            padding: "10px 12px",
            border: "1px solid var(--border-color)",
            borderRadius: 8,
            background: "#f8fafc",
            color: "var(--text-primary)",
            fontFamily: "monospace",
            width: "fit-content",
            minWidth: 140,
          }}
        />
        <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
          {nextRunPreview(hour, minute, days, timezone)}
        </div>
      </div>

      {/* Days of week */}
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
          Days
        </label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {/* "Every day" pill — clears the days filter */}
          <button
            type="button"
            onClick={() => setDays([])}
            style={{
              fontSize: 11,
              fontWeight: 600,
              padding: "6px 10px",
              borderRadius: 9999,
              border:
                days.length === 0
                  ? "1px solid var(--color-blue)"
                  : "1px solid var(--border-color)",
              background: days.length === 0 ? "rgba(59, 130, 246, 0.08)" : "white",
              color: days.length === 0 ? "var(--color-blue)" : "var(--text-secondary)",
              cursor: "pointer",
            }}
          >
            Every day
          </button>
          <button
            type="button"
            onClick={() => setDays([1, 2, 3, 4, 5])}
            style={{
              fontSize: 11,
              fontWeight: 600,
              padding: "6px 10px",
              borderRadius: 9999,
              border:
                days.length === 5 && [1, 2, 3, 4, 5].every((d) => days.includes(d))
                  ? "1px solid var(--color-blue)"
                  : "1px solid var(--border-color)",
              background:
                days.length === 5 && [1, 2, 3, 4, 5].every((d) => days.includes(d))
                  ? "rgba(59, 130, 246, 0.08)"
                  : "white",
              color:
                days.length === 5 && [1, 2, 3, 4, 5].every((d) => days.includes(d))
                  ? "var(--color-blue)"
                  : "var(--text-secondary)",
              cursor: "pointer",
            }}
          >
            Weekdays
          </button>
          {DAYS.map((day) => {
            const selected = days.includes(day.value);
            return (
              <button
                key={day.value}
                type="button"
                onClick={() => toggleDay(day.value)}
                title={day.label}
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  padding: "6px 10px",
                  borderRadius: 9999,
                  border: selected
                    ? "1px solid var(--color-blue)"
                    : "1px solid var(--border-color)",
                  background: selected ? "rgba(59, 130, 246, 0.08)" : "white",
                  color: selected ? "var(--color-blue)" : "var(--text-secondary)",
                  cursor: "pointer",
                  minWidth: 44,
                }}
              >
                {day.short}
              </button>
            );
          })}
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
            width: "fit-content",
            minWidth: 220,
          }}
        >
          {COMMON_TIMEZONES.map((tz) => (
            <option key={tz} value={tz}>
              {tz}
            </option>
          ))}
        </select>
        <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
          {describeSchedule(hour, minute, days, timezone)}
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
