"use client";

import React from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { useBriefing } from "../hooks/useBriefing";

export default function BriefingPanel() {
  const {
    briefing,
    isBriefingLoading,
    briefingFilter,
    fetchBriefing,
    handleBriefingFilterChange,
  } = useBriefing();

  return (
    <div className="briefing-tab-view">
      <header className="briefing-header">
        <div>
          <h1>Daily Executive Briefing</h1>
          <p>Aggregated regulatory changes, market flows, and competitor SWOT indices</p>
        </div>
        <button
          onClick={() => fetchBriefing(briefingFilter)}
          disabled={isBriefingLoading}
          className="refresh-button"
        >
          {isBriefingLoading ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <RefreshCw size={14} />
          )}
          Refresh Briefing
        </button>
      </header>

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
