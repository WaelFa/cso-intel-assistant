"use client";

import React, { useEffect, useRef, useState } from "react";
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
  ThumbsUp,
  ThumbsDown,
  Brain,
  Check,
  Bell,
  BellRing,
} from "lucide-react";
import { useChat } from "../hooks/useChat";
import { useUser } from "../hooks/useUser";
import { AGENT_DISPLAY_NAMES, useDashboard } from "../context/DashboardContext";

// Header time helpers — kept local to the chat panel because they're
// only used in the welcome strip. Both run client-side only.
function timeGreeting() {
  const h = new Date().getHours();
  if (h < 5) return "Working late";
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

function formatDate(d: Date) {
  return d.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

function formatTime(d: Date) {
  return d.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function buildWelcomeMessage(name: string, agentName: string = "Jarvis") {
  return `Hey ${name} — I'm ${agentName}. What can I dig into?`;
}

export default function ChatPanel() {
  const router = useRouter();
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Orb state: idle → thinking (when generating) → done (one-shot
  // green flash when generation finishes). The "done" auto-clears
  // so the orb settles back to idle.
  const [orbState, setOrbState] = useState<"idle" | "thinking" | "done">(
    "idle",
  );
  const prevGeneratingRef = useRef(false);

  const { userName } = useUser();

  const {
    messages,
    setMessages,
    inputVal,
    setInputVal,
    isChatting,
    isGenerating,
    focusedAgentId,
    setFocusedAgentId,
    activeToolStatus,
    reasoningEffort,
    setReasoningEffort,
    handlePromptSubmit,
    handleStopGeneration,
    handleClearChat,
    executePillAction,
  } = useChat();

  const {
    agentsStatus,
    backgroundTasks,
    hasUnseenBackgroundTask,
    insertBackgroundTask,
    cancelBackgroundTask,
    dismissBackgroundTask,
    markBackgroundTaskSeen,
    settings,
  } = useDashboard();

  // ── Footer dropdown state ──────────────────────────────────────
  // The two pill-style controls under the input (agent picker +
  // reasoning effort) behave as lightweight popovers. Keeping the
  // open/close state local to ChatPanel avoids polluting the
  // global context with transient UI state.
  const [agentMenuOpen, setAgentMenuOpen] = useState(false);
  const [reasoningMenuOpen, setReasoningMenuOpen] = useState(false);
  const agentMenuRef = useRef<HTMLDivElement | null>(null);
  const reasoningMenuRef = useRef<HTMLDivElement | null>(null);

  // ── Background-tasks bell dropdown state ───────────────────────
  // The bell lives in the chat header. Click opens a dropdown
  // listing any backgrounded tasks (running + completed with
  // unseen results). The dropdown is independent of the input
  // popovers but uses the same outside-click / Escape dismissal
  // pattern.
  const [bgMenuOpen, setBgMenuOpen] = useState(false);
  const bgMenuRef = useRef<HTMLDivElement | null>(null);

  // Derive the running-task list (and whether any are running)
  // straight from context. We tick every second via the context's
  // internal interval so the elapsed-time text stays fresh.
  const runningBgTasks = backgroundTasks?.filter((t) => t.status === "running") || [];
  const unseenBgTasks = backgroundTasks?.filter((t) => t.hasUnseen) || [];
  const allBgTasks = backgroundTasks || [];
  // True if at least one slow sub-agent is still working in the
  // background. Drives the input-bar status line and the
  // send/stop gate.
  const hasRunningBackgroundTask = runningBgTasks.length > 0;

  // Tick once a second while any task is running so the bell
  // dropdown's elapsed-time labels stay fresh. The interval
  // callback (not the effect body) updates state.
  const [now, setNow] = useState<number>(() => Date.now());
  useEffect(() => {
    if (!hasRunningBackgroundTask) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [hasRunningBackgroundTask]);

  useEffect(() => {
    if (!agentMenuOpen && !reasoningMenuOpen && !bgMenuOpen) return;
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        agentMenuOpen &&
        agentMenuRef.current &&
        !agentMenuRef.current.contains(target)
      ) {
        setAgentMenuOpen(false);
      }
      if (
        reasoningMenuOpen &&
        reasoningMenuRef.current &&
        !reasoningMenuRef.current.contains(target)
      ) {
        setReasoningMenuOpen(false);
      }
      if (
        bgMenuOpen &&
        bgMenuRef.current &&
        !bgMenuRef.current.contains(target)
      ) {
        setBgMenuOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setAgentMenuOpen(false);
        setReasoningMenuOpen(false);
        setBgMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [agentMenuOpen, reasoningMenuOpen, bgMenuOpen]);

  // When a sub-agent is picked from the dropdown, the focus banner
  // is already wired to render off `focusedAgentId`. We just set it.
  // "cso-intel-assistant" represents the main orchestrator (Jarvis);
  // selecting it clears the focus so the banner goes away.
  const handleAgentSelect = (agentId: string) => {
    if (agentId === "cso-intel-assistant") {
      setFocusedAgentId(null);
    } else {
      setFocusedAgentId(agentId);
    }
    setAgentMenuOpen(false);
  };

  // Currently-selected agent — `null` means "main session" (custom agent name).
  const selectedAgentName = focusedAgentId
    ? AGENT_DISPLAY_NAMES[focusedAgentId] || focusedAgentId
    : settings?.agentName || "Jarvis";

  // Reasoning effort → human label + icon.
  const reasoningOptions = [
    { value: "low" as const, label: "Fast", icon: Zap, hint: "Quick replies" },
    {
      value: "medium" as const,
      label: "Medium",
      icon: BarChart2,
      hint: "Balanced",
    },
    {
      value: "high" as const,
      label: "Deep",
      icon: Brain,
      hint: "Thorough reasoning",
    },
  ];
  const currentReasoning = reasoningOptions.find(
    (o) => o.value === reasoningEffort,
  )!;
  const ReasoningIcon = currentReasoning.icon;

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isGenerating]);

  // While the model is generating, we suppress the empty assistant
  // bubble and show the loading panel instead. Once content arrives
  // (after the debounce + strip pass in the context), the bubble
  // renders normally.
  const showLoadingPanel =
    isGenerating &&
    messages.length > 0 &&
    messages[messages.length - 1]?.role === "assistant" &&
    !messages[messages.length - 1]?.content;

  // Drive the orb state machine. Only applies while the ready view
  // is visible (no chat yet) — once the user has sent their first
  // message, the orb is unmounted and this is a no-op.
  useEffect(() => {
    if (isGenerating) {
      prevGeneratingRef.current = true;
      setOrbState("thinking");
      return;
    }
    if (prevGeneratingRef.current) {
      prevGeneratingRef.current = false;
      setOrbState("done");
      const t = window.setTimeout(() => setOrbState("idle"), 1200);
      return () => window.clearTimeout(t);
    }
    return undefined;
  }, [isGenerating]);

  const parseTextWithLinks = (text: string) => {
    const mdLinkRegex = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;
    let lastIndex = 0;
    const elements: React.ReactNode[] = [];
    let match;

    const parseBoldAndUrls = (str: string) => {
      const parts = str.split(/(\*\*.*?\*\*)/g);
      return parts.map((part, i) => {
        if (part.startsWith("**") && part.endsWith("**")) {
          return (
            <strong key={i} style={{ fontWeight: 700 }}>
              {part.slice(2, -2)}
            </strong>
          );
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
                  wordBreak: "break-all",
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
            fontWeight: 600,
          }}
        >
          {anchor}
        </a>,
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
    const cleanText = content
      .replace(/<jarvis-internal-7f3a9c2b>[\s\S]*?<\/jarvis-internal-7f3a9c2b>/gi, "")
      .replace(/<thought>[\s\S]*?<\/thought>/gi, "")
      .replace(
        /\[Source:\s*([^,\]]+),\s*chunk\s*(\d+),\s*relevance\s*([\d\.]+)\]/gi,
        "",
      )
      .trim();

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
          <li className="ml-5 list-disc my-1">
            {parseTextWithLinks(line.substring(2))}
          </li>
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
          <h1>
            {timeGreeting()}
            {userName ? `, ${userName}` : ""}
          </h1>
          <p>{settings?.agentName || "Jarvis"} online • Strategy Hub live</p>
        </div>
        <div className="header-right">
          {/* Background-tasks bell. Visible whenever there's at
              least one backgrounded task (running, completed with
              unseen result, or any in the list). The badge count
              reflects unseen items only. */}
          {allBgTasks.length > 0 && (
            <div
              className="input-footer-picker"
              ref={bgMenuRef}
              style={{ marginRight: 12 }}
            >
              <button
                className="model-select-button"
                onClick={() => {
                  setBgMenuOpen((v) => !v);
                  setAgentMenuOpen(false);
                  setReasoningMenuOpen(false);
                }}
                aria-haspopup="listbox"
                aria-expanded={bgMenuOpen}
                title={
                  hasRunningBackgroundTask
                    ? `${runningBgTasks.length} background task(s) running`
                    : unseenBgTasks.length > 0
                      ? `${unseenBgTasks.length} background result(s) ready`
                      : "Background tasks"
                }
                style={{
                  position: "relative",
                  paddingRight: 26,
                }}
              >
                {hasUnseenBackgroundTask ? (
                  <BellRing size={14} style={{ color: "#f59e0b" }} />
                ) : (
                  <Bell size={14} style={{ color: "#9ca3af" }} />
                )}
                <span className="model-select-label">
                  {hasRunningBackgroundTask
                    ? `Background (${runningBgTasks.length} running)`
                    : unseenBgTasks.length > 0
                      ? `Background (${unseenBgTasks.length} ready)`
                      : `Background (${allBgTasks.length})`}
                </span>
                {hasUnseenBackgroundTask && (
                  <span
                    style={{
                      position: "absolute",
                      top: 4,
                      right: 8,
                      minWidth: 16,
                      height: 16,
                      padding: "0 4px",
                      borderRadius: 8,
                      background: "#f59e0b",
                      color: "#fff",
                      fontSize: 10,
                      fontWeight: 700,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {unseenBgTasks.length}
                  </span>
                )}
              </button>
              {bgMenuOpen && (
                <div
                  className="picker-dropdown picker-dropdown-up"
                  role="listbox"
                  style={{ minWidth: 320 }}
                >
                  <div className="picker-dropdown-header">
                    Background tasks
                  </div>
                  {allBgTasks.length === 0 && (
                    <div
                      style={{
                        padding: "12px 14px",
                        fontSize: 12,
                        color: "#6b7280",
                      }}
                    >
                      No backgrounded tasks.
                    </div>
                  )}
                  {allBgTasks.map((t) => {
                    const elapsed = Math.max(
                      0,
                      Math.floor(
                        ((t.finishedAt ?? now) - t.startedAt) / 1000,
                      ),
                    );
                    const mm = String(Math.floor(elapsed / 60)).padStart(
                      2,
                      "0",
                    );
                    const ss = String(elapsed % 60).padStart(2, "0");
                    return (
                      <div
                        key={t.id}
                        className="picker-option"
                        style={{
                          alignItems: "flex-start",
                          padding: "10px 12px",
                          cursor: "default",
                        }}
                      >
                        <span
                          className="picker-option-dot"
                          style={{
                            backgroundColor: t.subAgentColor,
                            marginTop: 6,
                          }}
                        />
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: 4,
                            flex: 1,
                            minWidth: 0,
                          }}
                        >
                          <span className="picker-option-label">
                            {t.subAgentDisplay}
                            {t.userPrompts.length > 1 && (
                              <span
                                style={{
                                  color: "#6b7280",
                                  fontWeight: 500,
                                  marginLeft: 6,
                                }}
                              >
                                +{t.userPrompts.length - 1} more
                              </span>
                            )}
                          </span>
                          <span
                            className="picker-option-hint"
                            style={{
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              maxWidth: 220,
                            }}
                          >
                            {t.userPrompts[0]}
                          </span>
                          <span
                            style={{
                              fontSize: 11,
                              color: t.hasUnseen ? "#f59e0b" : "#6b7280",
                              fontWeight: t.hasUnseen ? 600 : 500,
                            }}
                          >
                            {t.status === "running" && `Running • ${mm}:${ss}`}
                            {t.status === "completed" &&
                              (t.hasUnseen
                                ? `Ready • ${mm}:${ss}`
                                : `Completed • ${mm}:${ss}`)}
                            {t.status === "failed" && `Failed • ${mm}:${ss}`}
                            {t.status === "cancelled" &&
                              `Cancelled • ${mm}:${ss}`}
                          </span>
                          <div
                            style={{
                              display: "flex",
                              gap: 6,
                              marginTop: 4,
                            }}
                          >
                            {t.status === "completed" && (
                              <button
                                type="button"
                                className="reset-focus-btn"
                                onClick={() => insertBackgroundTask(t.id)}
                                title="Insert the result into the chat"
                              >
                                Insert
                              </button>
                            )}
                            {t.status === "running" && (
                              <button
                                type="button"
                                className="reset-focus-btn"
                                onClick={() => cancelBackgroundTask(t.id)}
                                title="Stop tracking this task"
                              >
                                Cancel
                              </button>
                            )}
                            {t.status !== "running" && (
                              <button
                                type="button"
                                className="reset-focus-btn"
                                onClick={() => dismissBackgroundTask(t.id)}
                                title="Dismiss this task"
                              >
                                Dismiss
                              </button>
                            )}
                            {!t.hasUnseen && t.status === "completed" && (
                              <button
                                type="button"
                                className="reset-focus-btn"
                                onClick={() =>
                                  markBackgroundTaskSeen(t.id)
                                }
                                title="Re-mark as unseen"
                              >
                                Mark unseen
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
          <p className="date">{formatDate(new Date())}</p>
          <p className="time">{formatTime(new Date())}</p>
        </div>
      </header>

      {/* Content Pane */}
      <div className="content-pane">
        <div className="chat-thread-wrapper">
          {!isChatting ? (
            /* ── AI READY CENTRAL SHIELD ── */
            <div className="ready-view">
              <div className="orb-wrapper" data-state={orbState}>
                <div className="orb-logo">
                  <svg
                    width="72"
                    height="72"
                    viewBox="0 0 32 32"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    className="orb-logo-svg"
                    aria-hidden="true"
                  >
                    <defs>
                      <radialGradient id="orb-hue" cx="50%" cy="40%" r="65%">
                        <stop offset="0%" stopColor="#dbeafe" />
                        <stop offset="55%" stopColor="#93c5fd" />
                        <stop offset="100%" stopColor="#1d4ed8" />
                      </radialGradient>
                    </defs>
                    <circle cx="10" cy="12" r="5" fill="url(#orb-hue)" />
                    <circle
                      cx="21"
                      cy="10"
                      r="4.2"
                      fill="url(#orb-hue)"
                      opacity="0.92"
                    />
                    <circle
                      cx="17"
                      cy="21"
                      r="6"
                      fill="url(#orb-hue)"
                      opacity="0.96"
                    />
                  </svg>
                </div>
              </div>

              <h3>{settings?.agentName || "Jarvis"} is ready</h3>
              <p className="ready-welcome">
                {userName
                  ? buildWelcomeMessage(userName, settings?.agentName || "Jarvis")
                      .split("\n\n")
                      .map((para, i) => (
                        <span key={i}>
                          {i > 0 ? (
                            <>
                              <br />
                              <br />
                              {para}
                            </>
                          ) : (
                            para
                          )}
                        </span>
                      ))
                  : `I'm ${settings?.agentName || "Jarvis"} — your strategic intelligence assistant. Tap a pellet below or just ask.`}
              </p>

              {/* Quick Pill Buttons */}
              <div className="pills-grid">
                {[
                  {
                    text: "Give me a fast update",
                    label: "Quick brief",
                    icon: Zap,
                    description:
                      "30-second snapshot of today's critical alerts",
                  },
                  {
                    text: "Run an in-depth strategic analysis",
                    label: "Deep dive",
                    icon: BarChart2,
                    description:
                      "Multi-agent synthesis across market, regulatory, and competitive signals",
                  },
                  {
                    text: "What's the latest market intelligence?",
                    label: "Market intel",
                    icon: Wand2,
                    description: "Capital flows, FDI, investor sentiment",
                  },
                  {
                    text: "Any new regulatory updates I should know about?",
                    label: "Regulatory watch",
                    icon: Globe,
                    description: "Policy and compliance horizon scan",
                  },
                  {
                    text: "How do we compare against our peer centres?",
                    label: "Competitor scan",
                    icon: PenTool,
                    description:
                      "Benchmarking against DIFC, ADGM, GIFT City, Singapore",
                  },
                  {
                    text: "Generate today's daily briefing",
                    label: "Daily briefing",
                    icon: GraduationCap,
                    description: "Pre-prepared morning intelligence snapshot",
                  },
                ].map((pill, idx) => {
                  const PillIcon = pill.icon;
                  return (
                    <button
                      key={idx}
                      onClick={() => executePillAction(pill.text)}
                      className="pill-button"
                      title={pill.description}
                      style={{ animationDelay: `${idx * 60}ms` }}
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
                      : `${settings?.agentName || "Jarvis"} — Main Session`}
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
                      <strong>
                        {AGENT_DISPLAY_NAMES[focusedAgentId] || focusedAgentId}
                      </strong>{" "}
                      specialist agent.
                    </span>
                  </div>
                  <button
                    className="reset-focus-btn"
                    onClick={() => setFocusedAgentId(null)}
                  >
                    Reset to Core
                  </button>
                </div>
              )}

              {/* Chat Message Scroll */}
              <div className="chat-scroll">
                {messages.map((msg, idx) => {
                  const isInflightEmptyAssistant =
                    showLoadingPanel &&
                    idx === messages.length - 1 &&
                    msg.role === "assistant" &&
                    !msg.content;
                  if (isInflightEmptyAssistant) return null;
                  return (
                    <div key={msg.id} className={`message-wrapper ${msg.role}`}>
                      <div className={`avatar-circle msg ${msg.role}`}>
                        {msg.role === "user" ? (userName ? userName.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2) : "CS") : "AI"}
                      </div>

                      <div className="message-content-wrapper">
                        {msg.role === "assistant" && (
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "8px",
                              marginBottom: "4px",
                            }}
                          >
                            <span
                              className="message-agent-name"
                              style={{ paddingLeft: "4px" }}
                            >
                              {msg.agentName || settings?.agentName || "Jarvis"}
                            </span>
                            {msg.agentName &&
                              (msg.agentName.toLowerCase().includes("market") ||
                                msg.agentName
                                  .toLowerCase()
                                  .includes("regulatory") ||
                                msg.agentName
                                  .toLowerCase()
                                  .includes("competitor") ||
                                msg.agentName
                                  .toLowerCase()
                                  .includes("intelligence") ||
                                msg.agentName
                                  .toLowerCase()
                                  .includes("communications")) && (
                                <span
                                  className={`intel-source-badge ${msg.isLive === true ? "live" : "curated"}`}
                                >
                                  {msg.isLive === true
                                    ? "🔴 Live Search"
                                    : "📋 Curated"}
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
                              <Globe size={10} /> Live web sources (
                              {msg.liveSources.length})
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
                                  {src.title.length > 60
                                    ? `${src.title.substring(0, 60)}…`
                                    : src.title}
                                </span>
                                {src.date && (
                                  <span className="live-source-date">
                                    · {src.date}
                                  </span>
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

                        <MessageFeedback messageId={msg.id} />
                      </div>
                    </div>
                  );
                })}

                {/* Typing/Processing State */}
                {showLoadingPanel && (
                  <div className="typing-indicator">
                    <div className="avatar-circle msg assistant">
                      <Loader2 size={14} className="animate-spin" />
                    </div>
                    <div className="message-content-wrapper">
                      <span className="message-agent-name">{settings?.agentName || "Jarvis"}</span>
                      <div className="typing-box">
                        <span>{activeToolStatus || `${settings?.agentName || "Jarvis"} is thinking…`}</span>
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
                        : `Ask ${settings?.agentName || "Jarvis"} anything...`
                    }
                    rows={1}
                    className="textarea-input"
                  />
                </div>
                {isGenerating && !hasRunningBackgroundTask ? (
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
                      cursor: inputVal.trim() ? "pointer" : "default",
                    }}
                    disabled={!inputVal.trim()}
                  >
                    <Send size={16} />
                  </button>
                )}
              </div>
            </div>

            {hasRunningBackgroundTask && (
              <div
                role="status"
                aria-live="polite"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  fontSize: 12,
                  color: "#475569",
                  padding: "6px 4px 0",
                  cursor: "pointer",
                }}
                onClick={() => setBgMenuOpen(true)}
                title="Click to see backgrounded tasks"
              >
                <Loader2
                  size={12}
                  className="animate-spin"
                  style={{ color: "#3b82f6" }}
                />
                <span>
                  {settings?.agentName || "Jarvis"} is consulting{" "}
                  <strong>
                    {runningBgTasks.map((t) => t.subAgentDisplay).join(" & ")}
                  </strong>{" "}
                  in the background — you can keep chatting.
                </span>
              </div>
            )}

            <div className="input-footer">
              <div className="input-footer-picker" ref={agentMenuRef}>
                <button
                  className="model-select-button"
                  onClick={() => {
                    setAgentMenuOpen((v) => !v);
                    setReasoningMenuOpen(false);
                  }}
                  aria-haspopup="listbox"
                  aria-expanded={agentMenuOpen}
                  title="Choose which agent handles your next message"
                >
                  <Layers size={14} style={{ color: "#9ca3af" }} />
                  <span className="model-select-label">{selectedAgentName}</span>
                  <ChevronDown
                    size={12}
                    style={{
                      color: "#9ca3af",
                      transform: agentMenuOpen
                        ? "rotate(180deg)"
                        : "rotate(0deg)",
                      transition: "transform 0.15s ease",
                    }}
                  />
                </button>
                {agentMenuOpen && (
                  <div
                    className="picker-dropdown picker-dropdown-up"
                    role="listbox"
                  >
                    <div className="picker-dropdown-header">Active agent</div>
                    {agentsStatus.map((agent) => {
                      const isSelected =
                        (agent.id === "cso-intel-assistant" && !focusedAgentId) ||
                        agent.id === focusedAgentId;
                      return (
                        <button
                          key={agent.id}
                          className={`picker-option ${isSelected ? "selected" : ""}`}
                          onClick={() => handleAgentSelect(agent.id)}
                          role="option"
                          aria-selected={isSelected}
                        >
                          <span
                            className="picker-option-dot"
                            style={{ backgroundColor: agent.iconColor }}
                          />
                          <span className="picker-option-text">
                            <span className="picker-option-label">
                              {agent.name}
                            </span>
                            <span className="picker-option-hint">
                              {agent.id === "cso-intel-assistant"
                                ? "Orchestrator — coordinates every specialist"
                                : agent.description}
                            </span>
                          </span>
                          {isSelected && (
                            <Check
                              size={14}
                              className="picker-option-check"
                            />
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
              <div className="options-right">
                <div className="input-footer-picker" ref={reasoningMenuRef}>
                  <button
                    className="speed-badge speed-badge-button"
                    onClick={() => {
                      setReasoningMenuOpen((v) => !v);
                      setAgentMenuOpen(false);
                    }}
                    aria-haspopup="listbox"
                    aria-expanded={reasoningMenuOpen}
                    title="Reasoning depth for the next message"
                  >
                    <ReasoningIcon size={12} />
                    <span className="speed-badge-label">
                      {currentReasoning.label}
                    </span>
                    <ChevronDown
                      size={12}
                      style={{
                        transform: reasoningMenuOpen
                          ? "rotate(180deg)"
                          : "rotate(0deg)",
                        transition: "transform 0.15s ease",
                      }}
                    />
                  </button>
                  {reasoningMenuOpen && (
                    <div
                      className="picker-dropdown picker-dropdown-up"
                      role="listbox"
                    >
                      <div className="picker-dropdown-header">Reasoning</div>
                      {reasoningOptions.map((opt) => {
                        const Icon = opt.icon;
                        const isSelected = opt.value === reasoningEffort;
                        return (
                          <button
                            key={opt.value}
                            className={`picker-option ${isSelected ? "selected" : ""}`}
                            onClick={() => {
                              setReasoningEffort(opt.value);
                              setReasoningMenuOpen(false);
                            }}
                            role="option"
                            aria-selected={isSelected}
                          >
                            <Icon
                              size={14}
                              className="picker-option-icon"
                            />
                            <span className="picker-option-text">
                              <span className="picker-option-label">
                                {opt.label}
                              </span>
                              <span className="picker-option-hint">
                                {opt.hint}
                              </span>
                            </span>
                            {isSelected && (
                              <Check
                                size={14}
                                className="picker-option-check"
                              />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
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

// "Did that help?" — a tiny thumbs row that records the user's
// reaction to a given assistant message. Stored in localStorage so
// the signal survives a reload and could be lifted to the backend
// in a follow-up. Hides itself on the welcome message (id starts
// with "welcome") since there's no real reply to rate.
function MessageFeedback({ messageId }: { messageId: string }) {
  const [vote, setVote] = useState<"up" | "down" | null>(null);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem("jarvis.feedback");
      if (!raw) return;
      const map = JSON.parse(raw) as Record<string, "up" | "down">;
      setVote(map[messageId] ?? null);
    } catch {
      // best-effort
    }
  }, [messageId]);

  if (messageId.startsWith("welcome")) return null;

  const record = (next: "up" | "down") => {
    const newVote = vote === next ? null : next;
    setVote(newVote);
    try {
      const raw = window.localStorage.getItem("jarvis.feedback");
      const map = (raw ? JSON.parse(raw) : {}) as Record<string, "up" | "down">;
      if (newVote) map[messageId] = newVote;
      else delete map[messageId];
      window.localStorage.setItem("jarvis.feedback", JSON.stringify(map));
    } catch {
      // best-effort
    }
  };

  return (
    <div className="message-feedback">
      <button
        type="button"
        className={`message-feedback-btn ${vote === "up" ? "active-up" : ""}`}
        onClick={() => record("up")}
        aria-label="Helpful"
        title="Helpful"
      >
        <ThumbsUp size={11} strokeWidth={2} />
      </button>
      <button
        type="button"
        className={`message-feedback-btn ${vote === "down" ? "active-down" : ""}`}
        onClick={() => record("down")}
        aria-label="Not helpful"
        title="Not helpful"
      >
        <ThumbsDown size={11} strokeWidth={2} />
      </button>
    </div>
  );
}
