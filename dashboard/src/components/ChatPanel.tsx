"use client";

import React, { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Zap,
  BarChart2,
  Wand2,
  Globe,
  PenTool,
  GraduationCap,
  Trash2,
  Loader2,
  X,
  Send,
  Layers,
  ChevronDown,
  Mic,
  FileText,
} from "lucide-react";
import { useChat } from "../hooks/useChat";
import { AGENT_DISPLAY_NAMES } from "../context/DashboardContext";

export default function ChatPanel() {
  const router = useRouter();
  const chatEndRef = useRef<HTMLDivElement>(null);

  const {
    messages,
    inputVal,
    setInputVal,
    isChatting,
    isGenerating,
    focusedAgentId,
    setFocusedAgentId,
    activeToolStatus,
    handlePromptSubmit,
    handleStopGeneration,
    handleClearChat,
    executePillAction,
  } = useChat();

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isGenerating]);

  const parseTextWithLinks = (text: string) => {
    const mdLinkRegex = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;
    let lastIndex = 0;
    const elements: React.ReactNode[] = [];
    let match;

    const parseBoldAndUrls = (str: string) => {
      const parts = str.split(/(\*\*.*?\*\*)/g);
      return parts.map((part, i) => {
        if (part.startsWith("**") && part.endsWith("**")) {
          return <strong key={i} style={{ fontWeight: 700 }}>{part.slice(2, -2)}</strong>;
        }
        const urlRegex = /(https?:\/\/[^\s,;()]+)/g;
        const subParts = part.split(urlRegex);
        return subParts.map((subPart, j) => {
          if (subPart.match(/^https?:\/\//)) {
            return (
              <a
                key={`${i}-${j}`}
                href={subPart}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  color: "#2563eb",
                  textDecoration: "underline",
                  fontWeight: 600,
                  wordBreak: "break-all"
                }}
              >
                {subPart}
              </a>
            );
          }
          return subPart;
        });
      });
    };

    while ((match = mdLinkRegex.exec(text)) !== null) {
      const precedingText = text.substring(lastIndex, match.index);
      if (precedingText) {
        elements.push(...parseBoldAndUrls(precedingText));
      }

      const anchor = match[1];
      const url = match[2];

      elements.push(
        <a
          key={match.index}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            color: "#2563eb",
            textDecoration: "underline",
            fontWeight: 600
          }}
        >
          {anchor}
        </a>
      );

      lastIndex = mdLinkRegex.lastIndex;
    }

    const remainingText = text.substring(lastIndex);
    if (remainingText) {
      elements.push(...parseBoldAndUrls(remainingText));
    }

    return elements.length > 0 ? elements : text;
  };

  const formatMessageContent = (content: string) => {
    const cleanText = content.replace(
      /\[Source:\s*([^,\]]+),\s*chunk\s*(\d+),\s*relevance\s*([\d\.]+)\]/gi,
      ""
    );

    return cleanText.split("\n").map((line, i) => {
      let formattedLine: React.ReactNode = line;
      if (line.startsWith("### ")) {
        formattedLine = (
          <h4 className="text-md font-bold mt-3 mb-1 text-gray-800">
            {parseTextWithLinks(line.replace("### ", ""))}
          </h4>
        );
      } else if (line.startsWith("## ")) {
        formattedLine = (
          <h3 className="text-lg font-bold mt-4 mb-2 text-gray-900">
            {parseTextWithLinks(line.replace("## ", ""))}
          </h3>
        );
      } else if (line.startsWith("- ") || line.startsWith("* ")) {
        formattedLine = (
          <li className="ml-5 list-disc my-1">{parseTextWithLinks(line.substring(2))}</li>
        );
      } else {
        formattedLine = parseTextWithLinks(line);
      }

      return (
        <div key={i} className="leading-relaxed">
          {formattedLine}
        </div>
      );
    });
  };

  return (
    <div className="dashboard-tab-view">
      {/* Header Strip */}
      <header className="dashboard-header">
        <div className="header-left">
          <h1>Good Afternoon, Adom</h1>
          <p>3 agents active • Strategy Hub Live</p>
        </div>
        <div className="header-right">
          <p className="date">Tuesday, May 14</p>
          <p className="time">14:02 PM GMT</p>
        </div>
      </header>

      {/* Content Pane */}
      <div className="content-pane">
        <div className="chat-thread-wrapper">
          {!isChatting ? (
            /* ── AI READY CENTRAL SHIELD ── */
            <div className="ready-view">
              <div className="orb-wrapper">
                <div className="orb-glow animate-pulse-glow" />
                <div className="orb-svg-container animate-spin-slow">
                  <svg
                    width="288"
                    height="288"
                    viewBox="0 0 288 288"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <circle
                      cx="144"
                      cy="144"
                      r="140"
                      stroke="#bfdbfe"
                      strokeWidth="0.5"
                      strokeDasharray="3 6"
                    />
                    <circle
                      cx="144"
                      cy="144"
                      r="110"
                      stroke="#93c5fd"
                      strokeWidth="0.5"
                      strokeDasharray="2 4"
                    />
                    <path
                      d="M 144,34 A 110,110 0 0,1 254,144 A 110,110 0 0,1 144,254 A 110,110 0 0,1 34,144"
                      stroke="#60a5fa"
                      strokeWidth="1"
                      strokeLinecap="round"
                      strokeDasharray="4 8"
                    />
                    <path
                      d="M144 144C100 120 70 80 50 144C30 208 80 220 144 144Z"
                      stroke="#3b82f6"
                      strokeWidth="0.8"
                      opacity="0.3"
                    />
                    <path
                      d="M144 144C188 168 218 208 238 144C258 80 208 68 144 144Z"
                      stroke="#2563eb"
                      strokeWidth="0.8"
                      opacity="0.3"
                    />
                    <path
                      d="M144 144C120 188 80 218 144 238C208 258 220 208 144 144Z"
                      stroke="#3b82f6"
                      strokeWidth="0.8"
                      opacity="0.3"
                    />
                    <path
                      d="M144 144C168 100 208 70 144 50C80 30 68 80 144 144Z"
                      stroke="#1d4ed8"
                      strokeWidth="0.8"
                      opacity="0.3"
                    />
                  </svg>
                </div>

                <div className="orb-logo-inner shadow-premium-box">
                  <div className="orb-gradient-core">
                    <div className="orb-glass-shield">
                      <svg
                        width="40"
                        height="40"
                        viewBox="0 0 32 32"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                        className="filter drop-shadow-md"
                      >
                        <circle cx="10" cy="12" r="5" fill="#ffffff" />
                        <circle cx="21" cy="10" r="4.2" fill="#ffffff" opacity="0.9" />
                        <circle cx="17" cy="21" r="6" fill="#ffffff" opacity="0.95" />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>

              <h3>AI is ready</h3>
              <p>Waiting for your instructions or voice command</p>

              {/* Quick Pill Buttons */}
              <div className="pills-grid">
                {[
                  { text: "Fast Update", label: "Fast", icon: Zap },
                  { text: "In Depth Analysis", label: "In Depth", icon: BarChart2 },
                  { text: "What's the latest market intelligence?", label: "Market intelligence", icon: Wand2 },
                  { text: "Any new regulatory updates?", label: "Regulatory updates", icon: Globe },
                  { text: "How do we compare against competitors?", label: "Competitors comparison", icon: PenTool },
                  { text: "Generate daily briefing", label: "Daily briefing", icon: GraduationCap },
                ].map((pill, idx) => {
                  const PillIcon = pill.icon;
                  return (
                    <button
                      key={idx}
                      onClick={() => executePillAction(pill.text)}
                      className="pill-button"
                    >
                      <PillIcon size={14} style={{ color: "#9ca3af" }} />
                      {pill.label}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            /* ── ACTIVE CHAT THREAD ── */
            <div className="chat-thread-container shadow-premium-box">
              <div className="chat-area-header">
                <div className="chat-header-info">
                  <span className="chat-header-status-dot" />
                  <span className="chat-header-text">
                    {focusedAgentId
                      ? `Focused Session: ${AGENT_DISPLAY_NAMES[focusedAgentId] || focusedAgentId}`
                      : "Core Intelligence Session"}
                  </span>
                </div>
                <button className="clear-chat-btn" onClick={handleClearChat}>
                  <Trash2 size={13} />
                  Clear Chat
                </button>
              </div>

              {focusedAgentId && focusedAgentId !== "cso-intel-assistant" && (
                <div className="focus-mode-banner">
                  <div className="focus-banner-left">
                    <span className="focus-pulse-dot" />
                    <span className="focus-banner-text">
                      Queries will be handled directly by the{" "}
                      <strong>{AGENT_DISPLAY_NAMES[focusedAgentId] || focusedAgentId}</strong>{" "}
                      specialist agent.
                    </span>
                  </div>
                  <button className="reset-focus-btn" onClick={() => setFocusedAgentId(null)}>
                    Reset to Core
                  </button>
                </div>
              )}

              {/* Chat Message Scroll */}
              <div className="chat-scroll">
                {messages.map((msg) => (
                  <div key={msg.id} className={`message-wrapper ${msg.role}`}>
                    <div className={`avatar-circle msg ${msg.role}`}>
                      {msg.role === "user" ? "AD" : "AI"}
                    </div>

                    <div className="message-content-wrapper">
                      {msg.role === "assistant" && (
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                          <span className="message-agent-name" style={{ paddingLeft: "4px" }}>
                            {msg.agentName || "Core Intelligence"}
                          </span>
                          {msg.agentName && (
                            msg.agentName.toLowerCase().includes("market") ||
                            msg.agentName.toLowerCase().includes("regulatory") ||
                            msg.agentName.toLowerCase().includes("competitor") ||
                            msg.agentName.toLowerCase().includes("intelligence") ||
                            msg.agentName.toLowerCase().includes("communications")
                          ) && (
                            <span className={`intel-source-badge ${msg.isLive === true ? "live" : "curated"}`}>
                              {msg.isLive === true ? "🔴 Live Search" : "📋 Curated"}
                            </span>
                          )}
                        </div>
                      )}
                      <div className={`message-bubble ${msg.role}`}>
                        {formatMessageContent(msg.content)}
                      </div>

                      {/* Live Web Sources */}
                      {msg.liveSources && msg.liveSources.length > 0 && (
                        <div className="message-citations">
                          <span className="live-sources-label">
                            <Globe size={10} /> Live web sources ({msg.liveSources.length})
                          </span>
                          {msg.liveSources.map((src, i) => (
                            <a
                              key={i}
                              href={src.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="citation-pill live-source-pill"
                              title={src.title}
                            >
                              <Globe size={10} />
                              <span className="live-source-title">
                                {src.title.length > 60 ? `${src.title.substring(0, 60)}…` : src.title}
                              </span>
                              {src.date && (
                                <span className="live-source-date">· {src.date}</span>
                              )}
                            </a>
                          ))}
                        </div>
                      )}

                      {/* Source Citations */}
                      {msg.citations && msg.citations.length > 0 && (
                        <div className="message-citations">
                          {msg.citations.map((cite, i) => (
                            <button
                              key={i}
                              onClick={() => {
                                router.push("/documents");
                              }}
                              className="citation-pill"
                            >
                              <FileText size={10} />
                              {cite.docName} (Chunk {cite.chunkIndex})
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {/* Typing/Processing State */}
                {isGenerating && (
                  <div className="typing-indicator">
                    <div className="avatar-circle msg assistant">
                      <Loader2 size={14} className="animate-spin" />
                    </div>
                    <div className="message-content-wrapper">
                      <span className="message-agent-name">CSO Core Assistant</span>
                      <div className="typing-box">
                        <span>{activeToolStatus || "Orchestrating sub-agents..."}</span>
                        <div className="typing-dots">
                          <span style={{ animationDelay: "0ms" }} />
                          <span style={{ animationDelay: "150ms" }} />
                          <span style={{ animationDelay: "300ms" }} />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div ref={chatEndRef} />
              </div>
            </div>
          )}
        </div>

        {/* ── CHAT INPUT COMPONENT ── */}
        <div className="chat-input-container">
          <div className="chat-input-bar">
            <div className="input-main-row">
              <div className="textarea-row-wrapper">
                <div className="input-wrapper textarea-container-custom">
                  <textarea
                    value={inputVal}
                    onChange={(e) => setInputVal(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handlePromptSubmit();
                      }
                    }}
                    placeholder={
                      focusedAgentId
                        ? `Ask ${AGENT_DISPLAY_NAMES[focusedAgentId] || focusedAgentId}...`
                        : "Ask AI or give instructions..."
                    }
                    rows={1}
                    className="textarea-input"
                  />
                </div>
                {isGenerating ? (
                  <button
                    className="stop-input-btn"
                    onClick={handleStopGeneration}
                    title="Stop execution"
                  >
                    <X size={16} strokeWidth={2.5} />
                  </button>
                ) : (
                  <button
                    className="send-input-btn"
                    onClick={() => handlePromptSubmit()}
                    title="Send message"
                    style={{
                      opacity: inputVal.trim() ? 1 : 0.5,
                      cursor: inputVal.trim() ? "pointer" : "default"
                    }}
                    disabled={!inputVal.trim()}
                  >
                    <Send size={16} />
                  </button>
                )}
              </div>
            </div>

            <div className="input-footer">
              <button className="model-select-button">
                <Layers size={14} style={{ color: "#9ca3af" }} />
                Core Intelligence
                <ChevronDown size={12} style={{ color: "#9ca3af" }} />
              </button>
              <div className="options-right">
                <div className="speed-badge">
                  <ChevronDown size={12} />
                  Fast
                </div>
                <button className="mic-button">
                  <Mic size={16} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
