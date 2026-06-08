"use client";

import React from "react";
import { X, Check, Send, Zap } from "lucide-react";
import { useAgents } from "../hooks/useAgents";
import { useChat } from "../hooks/useChat";
import { SELECTED_AGENT_CAPABILITIES, SELECTED_AGENT_PROMPTS } from "../context/DashboardContext";

export default function AgentDrawer() {
  const {
    agentsStatus,
    selectedAgentId,
    setSelectedAgentId,
    systemPrompts,
  } = useAgents();

  const {
    isChatting,
    setIsChatting,
    executePillAction,
    focusedAgentId,
    setFocusedAgentId,
  } = useChat();

  const selectedAgent = agentsStatus.find((a) => a.id === selectedAgentId);

  if (!selectedAgent) return null;

  return (
    <>
      <div
        className={`drawer-overlay ${selectedAgentId ? "open" : ""}`}
        onClick={() => setSelectedAgentId(null)}
      />

      <div className={`agent-drawer ${selectedAgentId ? "open" : ""}`}>
        <div className="drawer-header">
          <div className="drawer-header-left">
            <div
              className="drawer-icon"
              style={{ backgroundColor: selectedAgent.iconColor }}
            >
              {selectedAgent.name.substring(0, 1)}
            </div>
            <div className="drawer-title-info">
              <h2>{selectedAgent.name}</h2>
              <span>{selectedAgent.role}</span>
            </div>
          </div>
          <button
            className="drawer-close-btn"
            onClick={() => setSelectedAgentId(null)}
          >
            <X size={16} />
          </button>
        </div>

        <div className="drawer-scroll-content">
          {/* Domain Capabilities */}
          <div>
            <h3 className="drawer-section-title">Capabilities</h3>
            <div className="drawer-capabilities-list">
              {SELECTED_AGENT_CAPABILITIES[selectedAgent.id]?.map((cap, i) => (
                <div key={i} className="drawer-capability-item">
                  <Check size={14} className="stroke-[2.5px]" />
                  <span>{cap}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Strategic Actions */}
          <div>
            <h3 className="drawer-section-title">Quick Strategic Actions</h3>
            <div className="drawer-prompts-grid">
              {SELECTED_AGENT_PROMPTS[selectedAgent.id]?.map((prompt, i) => (
                <button
                  key={i}
                  className="drawer-prompt-btn"
                  onClick={() => {
                    setSelectedAgentId(null);
                    executePillAction(prompt);
                  }}
                >
                  <span>{prompt}</span>
                  <Send size={12} className="text-slate-400" />
                </button>
              ))}
            </div>
          </div>

          {/* Grounding System Prompt Instructions */}
          <div>
            <h3 className="drawer-section-title">Grounded Agent Instructions</h3>
            <div className="drawer-instruction-box">
              {systemPrompts[selectedAgent.id] ||
                systemPrompts[selectedAgent.name.toLowerCase().replace(" ", "-")] ||
                selectedAgent.description ||
                "Grounding instructions loaded from Hono registry..."}
            </div>
          </div>
        </div>

        <div className="drawer-drawer-footer" style={{ padding: "20px", borderTop: "1px solid var(--border-color)", display: "flex", gap: "12px", backgroundColor: "#ffffff" }}>
          {focusedAgentId === selectedAgent.id ? (
            <button
              className="drawer-action-btn active-focus"
              onClick={() => {
                setFocusedAgentId(null);
                setSelectedAgentId(null);
              }}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
                padding: "12px",
                borderRadius: "12px",
                fontSize: "13px",
                fontWeight: 600,
                cursor: "pointer",
                border: "1px solid var(--color-red)",
                backgroundColor: "var(--color-red-light)",
                color: "var(--color-red)"
              }}
            >
              <X size={14} />
              Remove Chat Focus
            </button>
          ) : (
            <button
              className="drawer-action-btn primary"
              onClick={() => {
                setFocusedAgentId(selectedAgent.id);
                setSelectedAgentId(null);
                if (!isChatting) setIsChatting(true);
              }}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
                padding: "12px",
                borderRadius: "12px",
                fontSize: "13px",
                fontWeight: 600,
                cursor: "pointer",
                border: "none",
                backgroundColor: "var(--color-blue)",
                color: "#ffffff"
              }}
            >
              <Zap size={14} />
              Focus Conversation on Agent
            </button>
          )}
        </div>
      </div>
    </>
  );
}
