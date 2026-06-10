"use client";

import React from "react";
import { useAgents } from "../hooks/useAgents";
import StrategicOutputCard from "./StrategicOutputCard";

export default function AgentStatusPanel() {
  const {
    agentsStatus,
    selectedAgentId,
    setSelectedAgentId,
    presentations,
    isPresentationLoading,
    freshPresentationIds,
    markPresentationSeen,
    fetchPresentations,
  } = useAgents();

  return (
    <section className="agents-column">
      <div className="column-header">
        <h2>Strategy Agents</h2>
        <p>Status of live analytical workers</p>
      </div>

      <div className="agents-list">
        {agentsStatus.map((agent, index) => {
          const isSelected = selectedAgentId === agent.id;
          const isActiveState = agent.status !== "Idle";
          return (
            <div
              key={agent.id}
              onClick={() => setSelectedAgentId(agent.id)}
              className={`agent-card interactive-card ${
                isActiveState ? "active-state" : ""
              } ${isSelected ? "selected-active" : ""}`}
            >
              {/* Header block with logo, name, status indicator */}
              <div className="agent-card-header">
                <div className="agent-card-logo-info">
                  <div
                    className="agent-card-logo"
                    style={{ backgroundColor: agent.iconColor }}
                  >
                    {agent.name.substring(0, 1)}
                  </div>
                  <div className="agent-card-info">
                    <h3>{agent.name}</h3>
                    <span>{agent.role}</span>
                  </div>
                </div>
                <div className="agent-card-status">
                  <span
                    className="status-dot"
                    style={{ backgroundColor: agent.iconColor }}
                  />
                  <span className="status-text">{agent.status}</span>
                </div>
              </div>

              {/* Sub-panels based on agent type */}
              {index === 4 && ( // Strategic Output Agent Panel
                <div onClick={(e) => e.stopPropagation()}>
                  <StrategicOutputCard
                    presentations={presentations}
                    isPresentationLoading={isPresentationLoading}
                    freshPresentationIds={freshPresentationIds}
                    onMarkPresentationSeen={markPresentationSeen}
                    onRefresh={fetchPresentations}
                  />
                </div>
              )}

              {agent.sparkline && ( // Sparkline cards for Market, Reg, Competitor
                <div>
                  <p className="agent-description">{agent.description}</p>

                  <div className="sparkline-row">
                    <div className="sparkline-metric">{agent.metric}</div>

                    {/* Interactive Sparkline SVGs */}
                    <svg width="80" height="24" className="overflow-visible">
                      <polyline
                        fill="none"
                        stroke={agent.iconColor}
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        points={agent.sparkline
                          .map(
                            (val, i) =>
                              `${(i * 80) / (agent.sparkline!.length - 1)},${24 - val * 0.4}`
                          )
                          .join(" ")}
                      />
                    </svg>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
