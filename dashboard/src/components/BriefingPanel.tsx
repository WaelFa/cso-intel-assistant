"use client";

import React from "react";
import { Loader2, RefreshCw, Radio, AlertTriangle } from "lucide-react";
import { useBriefing } from "../hooks/useBriefing";

function formatTimestamp(iso: string | undefined): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function ageInHours(iso: string | undefined): number | null {
  if (!iso) return null;
  const diff = Date.now() - new Date(iso).getTime();
  return Math.round(diff / (1000 * 60 * 60));
}

export default function BriefingPanel() {
  const {
    briefing,
    isBriefingLoading,
    briefingFilter,
    fetchBriefing,
    handleBriefingFilterChange,
    preparedRecord,
    refreshPreparedBriefing,
  } = useBriefing();
  const [isRefreshing, setIsRefreshing] = React.useState(false);

  const onRefresh = async () => {
    setIsRefreshing(true);
    try {
      await fetch("http://localhost:3141/api/briefing/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ focus: briefingFilter }),
      });
      await refreshPreparedBriefing();
      await fetchBriefing(briefingFilter);
    } finally {
      setIsRefreshing(false);
    }
  };

  const preparedAt = preparedRecord?.preparedAt;
  const isLive = preparedRecord?.isLive;
  const hoursOld = ageInHours(preparedAt);
  const isStale = hoursOld !== null && hoursOld > 24;
  const preparedBy = preparedRecord?.preparedBy;

  return (
    <div className="briefing-tab-view">
      <header className="briefing-header">
        <div>
          <h1>Daily Executive Briefing</h1>
          <p>Aggregated regulatory changes, market flows, and competitor SWOT indices</p>
        </div>
        <button
          onClick={onRefresh}
          disabled={isBriefingLoading || isRefreshing}
          className="refresh-button"
        >
          {isBriefingLoading || isRefreshing ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <RefreshCw size={14} />
          )}
          Refresh Briefing
        </button>
      </header>

      {/* Provenance strip — shows the user when this snapshot was
          prepared, by whom, and whether it was a live or fallback
          generation. Renders even when there is no briefing yet, so
          a CSO opening the app at 7:45am sees "Prepared 7:40am (overnight-cron)". */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "10px 14px",
          marginBottom: 16,
          backgroundColor: preparedRecord
            ? isLive
              ? "rgba(16, 185, 129, 0.06)"
              : "rgba(245, 158, 11, 0.06)"
            : "rgba(239, 68, 68, 0.04)",
          border: `1px solid ${
            preparedRecord
              ? isLive
                ? "rgba(16, 185, 129, 0.25)"
                : "rgba(245, 158, 11, 0.25)"
              : "rgba(239, 68, 68, 0.2)"
          }`,
          borderRadius: 12,
          fontSize: 12,
          color: "var(--text-secondary)",
          flexWrap: "wrap",
        }}
      >
        {preparedRecord ? (
          <>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                fontWeight: 700,
                color: isLive ? "#059669" : "#b45309",
              }}
            >
              {isLive ? <Radio size={12} /> : <AlertTriangle size={12} />}
              {isLive ? "Live snapshot" : "Curated fallback"}
            </span>
            <span>·</span>
            <span>
              <strong>Prepared:</strong> {formatTimestamp(preparedAt)}
            </span>
            {hoursOld !== null ? (
              <>
                <span>·</span>
                <span style={{ color: isStale ? "#b91c1c" : "var(--text-muted)" }}>
                  {hoursOld === 0 ? "fresh" : `${hoursOld}h old`}
                </span>
              </>
            ) : null}
            {preparedBy ? (
              <>
                <span>·</span>
                <span style={{ color: "var(--text-muted)" }}>via {preparedBy.replace("-", " ")}</span>
              </>
            ) : null}
            {isStale ? (
              <span style={{ marginLeft: "auto", color: "#b91c1c", fontWeight: 600 }}>
                Stale — consider refreshing
              </span>
            ) : null}
          </>
        ) : (
          <span style={{ fontStyle: "italic", color: "var(--text-muted)" }}>
            No prepared briefing for today. The next scheduled run will populate this view, or click
            Refresh Briefing to generate one now.
          </span>
        )}
      </div>

      {isBriefingLoading && !briefing ? (
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <Loader2 className="animate-spin text-blue-600 mb-3" size={36} />
          <p style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-secondary)" }}>
            Synthesizing Briefing Snapshot...
          </p>
        </div>
      ) : briefing ? (
        <div className="briefing-scroll">
          {/* ── KPI Numeric Strip ── */}
          <div className="kpi-grid">
            {Array.isArray(briefing.kpis) && briefing.kpis.map((kpi, idx) => (
              <div key={idx} className="kpi-card">
                <span className="label">{kpi.label}</span>
                <span className="value">{kpi.value}</span>
                <span className={`delta ${kpi.trend}`}>
                  {kpi.trend === "up" ? "▲" : kpi.trend === "down" ? "▼" : "■"}
                  {kpi.delta}
                </span>
              </div>
            ))}
          </div>

          {/* Domain Selector Filters */}
          <div className="briefing-filters">
            {(["all", "market", "regulatory", "competitive", "risk"] as const).map((filter) => (
              <button
                key={filter}
                onClick={() => handleBriefingFilterChange(filter)}
                className={`filter-button ${briefingFilter === filter ? "active" : ""}`}
              >
                {filter}
              </button>
            ))}
          </div>

          {/* Briefing Sections Grid */}
          <div className="alerts-grid">
            {/* CRITICAL ALERTS COLUMN */}
            <div className="alerts-column">
              <h3 className="critical">
                <span className="column-indicator-dot critical" />
                Critical Alerts
              </h3>
              <div className="alerts-list-stack">
                {Array.isArray(briefing.critical) && briefing.critical.length > 0 ? (
                  briefing.critical.map((item, idx) => (
                    <div key={idx} className="briefing-alert-card critical">
                      <h4>{item.title}</h4>
                      <p>{item.summary}</p>
                      <span className="source">Source: {item.source}</span>
                    </div>
                  ))
                ) : (
                  <p style={{ fontSize: "12px", color: "var(--text-muted)", fontStyle: "italic", padding: "16px", textAlign: "center" }}>
                    No critical alerts flagged.
                  </p>
                )}
              </div>
            </div>

            {/* MONITORING ALERTS COLUMN */}
            <div className="alerts-column">
              <h3 className="monitoring">
                <span className="column-indicator-dot monitoring" />
                Monitoring Signals
              </h3>
              <div className="alerts-list-stack">
                {Array.isArray(briefing.monitoring) && briefing.monitoring.length > 0 ? (
                  briefing.monitoring.map((item, idx) => (
                    <div key={idx} className="briefing-alert-card monitoring">
                      <h4>{item.title}</h4>
                      <p>{item.summary}</p>
                      <span className="source">Source: {item.source}</span>
                    </div>
                  ))
                ) : (
                  <p style={{ fontSize: "12px", color: "var(--text-muted)", fontStyle: "italic", padding: "16px", textAlign: "center" }}>
                    No monitoring signals flagged.
                  </p>
                )}
              </div>
            </div>

            {/* OPPORTUNITIES ALERTS COLUMN */}
            <div className="alerts-column">
              <h3 className="opportunity">
                <span className="column-indicator-dot opportunity" />
                Opportunities
              </h3>
              <div className="alerts-list-stack">
                {Array.isArray(briefing.opportunities) && briefing.opportunities.length > 0 ? (
                  briefing.opportunities.map((item, idx) => (
                    <div key={idx} className="briefing-alert-card opportunity">
                      <h4>{item.title}</h4>
                      <p>{item.summary}</p>
                      <span className="source">Source: {item.source}</span>
                    </div>
                  ))
                ) : (
                  <p style={{ fontSize: "12px", color: "var(--text-muted)", fontStyle: "italic", padding: "16px", textAlign: "center" }}>
                    No strategic opportunities flagged.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center" }}>
          <p style={{ fontSize: "12px", color: "var(--text-muted)", fontStyle: "italic" }}>
            No briefing snapshot compiled.
          </p>
        </div>
      )}
    </div>
  );
}
