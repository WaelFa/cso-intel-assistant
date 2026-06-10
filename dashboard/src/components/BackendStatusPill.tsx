"use client";

import React from "react";
import { Loader2, AlertCircle, Activity, CheckCircle2 } from "lucide-react";
import { useDashboard } from "../context/DashboardContext";

/**
 * Top-of-page status indicator. Renders nothing once the backend
 * is confirmed online and no requests are in flight; otherwise it
 * shows a soft banner that explains what the user is waiting for.
 *
 * States:
 *   - "checking" → subtle "Connecting…" line, no banner.
 *   - "waking"   → full banner with spinner: "Waking up the backend…"
 *                  (the free-tier container sleeps after 15 min idle
 *                  and takes 30-50s to come back).
 *   - "error"    → red banner with retry button.
 *   - "online" + inFlight > 0 → small "busy" pill near the top
 *                  right so the user can see something is happening
 *                  without us blocking the UI.
 */
export default function BackendStatusPill() {
  const { backendStatus, inFlightRequests, checkBackendHealth } = useDashboard();

  if (backendStatus === "online" && inFlightRequests === 0) {
    return null;
  }

  if (backendStatus === "waking") {
    return (
      <div className="backend-status-banner backend-status-waking" role="status" aria-live="polite">
        <Loader2 size={14} className="animate-spin" />
        <div className="backend-status-text">
          <strong>Waking up the backend…</strong>
          <span>This usually takes 30–50 seconds on the free tier.</span>
        </div>
      </div>
    );
  }

  if (backendStatus === "error") {
    return (
      <div className="backend-status-banner backend-status-error" role="alert">
        <AlertCircle size={14} />
        <div className="backend-status-text">
          <strong>Backend unreachable.</strong>
          <span>Check the API URL and that the service is running.</span>
        </div>
        <button
          type="button"
          onClick={() => {
            void checkBackendHealth();
          }}
          className="backend-status-retry"
        >
          Retry
        </button>
      </div>
    );
  }

  // "checking" — no banner, just a small pill in the top-right.
  return (
    <div
      className="backend-status-pill"
      role="status"
      aria-live="polite"
      title="Connecting to backend"
    >
      {inFlightRequests > 0 ? (
        <>
          <Loader2 size={12} className="animate-spin" />
          <span>Working…</span>
        </>
      ) : backendStatus === "checking" ? (
        <>
          <Activity size={12} className="animate-pulse" />
          <span>Connecting…</span>
        </>
      ) : (
        <>
          <CheckCircle2 size={12} />
          <span>Online</span>
        </>
      )}
    </div>
  );
}
