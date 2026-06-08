"use client";

import React from "react";
import { useAgents } from "../hooks/useAgents";
import SettingsPanel from "./SettingsPanel";

export default function ConfigPanel() {
  const { systemPrompts } = useAgents();

  return (
    <div className="config-tab-view">
      <header>
        <h1>System Configuration</h1>
        <p>Review system prompts, RACER framework configurations, and overnight briefing schedule</p>
      </header>

      <div className="config-scroll">
        <SettingsPanel />

        {Object.keys(systemPrompts).length > 0 ? (
          Object.entries(systemPrompts).map(([agentName, promptContent]) => (
            <div key={agentName} className="config-card">
              <div className="config-card-header">
                <span className="name">{agentName.replace("-", " ")}</span>
                <span className="badge">RACE grounded prompt</span>
              </div>
              <pre>{promptContent}</pre>
            </div>
          ))
        ) : (
          <div
            style={{
              backgroundColor: "#ffffff",
              border: "1px solid var(--border-color)",
              borderRadius: "24px",
              padding: "32px",
              textAlign: "center",
              fontStyle: "italic",
              fontSize: "12px",
              color: "var(--text-muted)",
            }}
          >
            Loading agent system prompts from Hono registry...
          </div>
        )}
      </div>
    </div>
  );
}
