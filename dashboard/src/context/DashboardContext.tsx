"use client";

import React, { createContext, useContext, useState, useEffect, useRef } from "react";

// Types matching backend models
export interface StoredDocument {
  id: string;
  name: string;
  kind: "pdf" | "docx" | "txt" | "md";
  uploadedAt: string;
  chunkCount: number;
  characterCount: number;
  source: "upload" | "seed";
}

export interface BriefingItem {
  title: string;
  summary: string;
  source: string;
  domain: "market" | "regulatory" | "competitive" | "risk";
  url?: string;
  isLive?: boolean;
}

export interface KPIItem {
  label: string;
  value: string;
  delta: string;
  trend: "up" | "down" | "flat";
}

export interface BriefingData {
  date: string;
  generatedAt: string;
  focus: string;
  critical: BriefingItem[];
  monitoring: BriefingItem[];
  opportunities: BriefingItem[];
  kpis: KPIItem[];
}

export interface PreparedBriefingRecord {
  date: string;
  preparedAt: string;
  preparedBy: "overnight-cron" | "manual-refresh" | "boot-recovery";
  focus: string;
  isLive: boolean;
  executedMs: number;
  sources: {
    market: { attempted: boolean; isLive: boolean; error?: string };
    competitor: { attempted: boolean; isLive: boolean; error?: string };
    regulatory: { attempted: boolean; isLive: boolean; error?: string };
  };
  briefing: BriefingData;
}

export interface AppSettings {
  briefingCron: string;
  briefingTimezone: string;
  updatedAt?: string;
}

export interface LiveSource {
  title: string;
  url: string;
  date?: string;
}

export interface AgentStatus {
  id: string;
  name: string;
  role: string;
  status: string;
  dotColor: string;
  description: string;
  iconColor: string;
  metric?: string;
  sparkline?: number[];
}

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  agentName?: string;
  isLive?: boolean;
  liveSources?: LiveSource[];
  citations?: Array<{ docName: string; excerpt?: string; chunkIndex?: number }>;
}

export const AGENT_DISPLAY_NAMES: Record<string, string> = {
  "market-intelligence": "Market Intelligence",
  "regulatory-intelligence": "Regulatory Intelligence",
  "competitive-intelligence": "Competitive Intelligence",
  "executive-communications": "Executive Communications",
  "cso-intel-assistant": "Core Intelligence",
};

export const SELECTED_AGENT_CAPABILITIES: Record<string, string[]> = {
  "cso-intel-assistant": [
    "Orchestrate specialist sub-agents dynamically based on query context",
    "Generate comprehensive daily intelligence briefings with KPIs",
    "Assess core risk indicators across regulatory, market, and competitor domains",
    "Ingest and vectorize uploaded strategy docs, minutes, and reports",
    "Retrieve grounded citations from the RAG strategic database"
  ],
  "market-intelligence": [
    "Analyze global capital flow trends and FDI statistics",
    "Assess investor sentiment, risk tolerances, and asset allocations",
    "Monitor emerging sectors (digital assets, fintech, sustainable finance)",
    "Evaluate peer-jurisdiction fund domiciliation volumes"
  ],
  "regulatory-intelligence": [
    "Track global securities and capital market policy revisions (SEC, FCA, DFSA)",
    "Monitor digital asset regulations and compliance frameworks",
    "Identify corporate taxation compliance shifts (BEPS, CRS, substance laws)",
    "Assess ESG and sustainable finance reporting mandates"
  ],
  "competitive-intelligence": [
    "SWOT analysis and positioning of DIFC, ADGM, GIFT City, Singapore, Luxembourg",
    "Monitor fee structures, tax incentives, and cost competitiveness shifts",
    "Track talent attraction strategies and infrastructure developments",
    "Analyze competitor partnerships, MOUs, and expansion plans"
  ],
  "executive-communications": [
    "Draft formal Board Papers and C-suite strategy briefs",
    "Create talking points and presentation structures for executive sessions",
    "Draft talking points on our competitiveness strategy",
    "Automate calendar invites and action plan timelines"
  ]
};

export const SELECTED_AGENT_PROMPTS: Record<string, string[]> = {
  "cso-intel-assistant": [
    "Give me an overview of today's critical strategic alerts",
    "Ingest files to analyze strategic context"
  ],
  "market-intelligence": [
    "Compare DIFC vs ADGM competitive advantages in asset management",
    "Analyze latest capital flows and investment trends in GCC region",
    "Summarize global investor sentiment for digital assets and fintech"
  ],
  "regulatory-intelligence": [
    "What are the latest DFSA regulatory updates affecting operations?",
    "Summarize corporate tax changes and substance rules in peer centers",
    "Identify high-severity compliance updates in ESG reporting"
  ],
  "competitive-intelligence": [
    "Perform a SWOT analysis comparing our hub vs Singapore and ADGM",
    "What is the current strategic positioning of GIFT City in India?",
    "Analyse Luxembourg's fund domiciliation strategy and threat level"
  ],
  "executive-communications": [
    "Draft a board paper summarizing recent competitive intelligence findings",
    "Draft an executive briefing memo on GCC market flows",
    "Draft talking points on our competitiveness strategy for next board meet"
  ]
};

interface DashboardContextProps {
  // Chat States & Actions
  messages: Message[];
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  inputVal: string;
  setInputVal: (val: string) => void;
  isChatting: boolean;
  setIsChatting: (val: boolean) => void;
  isGenerating: boolean;
  activeAgent: string;
  focusedAgentId: string | null;
  setFocusedAgentId: (id: string | null) => void;
  activeToolStatus: string;
  conversationId: string;
  handlePromptSubmit: (textToSend?: string) => Promise<void>;
  handleStopGeneration: () => void;
  handleClearChat: () => void;
  executePillAction: (text: string) => void;

  // Documents States & Actions
  documents: StoredDocument[];
  isUploading: boolean;
  uploadSuccess: boolean;
  dragActive: boolean;
  setDragActive: (val: boolean) => void;
  fetchDocuments: () => Promise<void>;
  handleDrag: (e: React.DragEvent) => void;
  handleDrop: (e: React.DragEvent) => Promise<void>;
  handleFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  uploadFile: (file: File) => Promise<void>;
  handleDeleteDocument: (id: string, name: string) => Promise<void>;

  // Briefing States & Actions
  briefing: BriefingData | null;
  isBriefingLoading: boolean;
  briefingFilter: "all" | "market" | "regulatory" | "competitive" | "risk";
  fetchBriefing: (focus?: string) => Promise<void>;
  handleBriefingFilterChange: (filter: "all" | "market" | "regulatory" | "competitive" | "risk") => void;
  // Prepared-snapshot path (the fast "today" read) + bell indicator
  preparedRecord: PreparedBriefingRecord | null;
  hasUnseenBriefing: boolean;
  markBriefingSeen: () => void;
  refreshPreparedBriefing: () => Promise<void>;

  // Configuration States & Actions
  systemPrompts: Record<string, string>;
  fetchAgentConfigs: () => Promise<void>;
  // User-tunable settings (cron schedule for the overnight briefing)
  settings: AppSettings | null;
  isSettingsLoading: boolean;
  isSettingsSaving: boolean;
  settingsError: string | null;
  fetchSettings: () => Promise<void>;
  saveSettings: (partial: Partial<AppSettings>) => Promise<boolean>;

  // Scheduler / Sub-Agents States & Actions
  agentsStatus: AgentStatus[];
  selectedAgentId: string | null;
  setSelectedAgentId: (id: string | null) => void;
  schedulerConfirmed: boolean;
  schedulerDeclined: boolean;
  handleConfirmMeeting: () => void;
  handleDeclineMeeting: () => void;
  animateSubAgents: (text: string) => void;
  resetAgentStatuses: () => void;
  updateAgentMetrics: (agentId: string, outputData: any) => void;
}

const DashboardContext = createContext<DashboardContextProps | undefined>(undefined);

// Filter the prepared briefing in-memory by the selected focus.
// Mirrors the logic in src/tools/daily-briefing.ts so the dashboard
// shows the same filtered view without a network call.
function applyFocusFilter(
  briefing: BriefingData,
  focus: string,
): BriefingData {
  if (focus === "all" || !focus) return briefing;
  const matchesDomain = (item: { domain: string }) => item.domain === focus;
  return {
    ...briefing,
    critical: briefing.critical.filter(matchesDomain),
    monitoring: briefing.monitoring.filter(matchesDomain),
    opportunities: briefing.opportunities.filter(matchesDomain),
    kpis: focus === "market" || focus === "all" ? briefing.kpis : [],
  };
}

export function DashboardProvider({ children }: { children: React.ReactNode }) {
  // Chat States
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        "Good morning. I am your Strategic Intelligence Assistant. I am grounded in your institutional knowledge base and can orchestrate specialised market, regulatory, and competitive sub-agents to synthesize briefings, board memos, and risk assessments. \n\nHow can I support your strategy today?",
      timestamp: new Date(),
    },
  ]);
  const [inputVal, setInputVal] = useState("");
  const [isChatting, setIsChatting] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeAgent] = useState<string>("cso-intel-assistant");
  const [focusedAgentId, setFocusedAgentId] = useState<string | null>(null);
  const [activeToolStatus, setActiveToolStatus] = useState<string>("");
  const [conversationId] = useState(
    () => `cso-session-${Math.random().toString(36).substring(2, 11)}`,
  );
  const abortControllerRef = useRef<AbortController | null>(null);

  // Document Library States
  const [documents, setDocuments] = useState<StoredDocument[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  // Daily Briefing States
  const [briefing, setBriefing] = useState<BriefingData | null>(null);
  const [isBriefingLoading, setIsBriefingLoading] = useState(false);
  const [briefingFilter, setBriefingFilter] = useState<
    "all" | "market" | "regulatory" | "competitive" | "risk"
  >("all");

  // Prepared briefing snapshot (from /api/briefing/today) — the fast
  // read that backs the "Daily Briefings" tab. Separate from
  // `briefing` so that switching the focus filter does not wipe
  // the cached snapshot.
  const [preparedRecord, setPreparedRecord] = useState<PreparedBriefingRecord | null>(null);
  const [hasUnseenBriefing, setHasUnseenBriefing] = useState(false);

  // Settings Configuration States
  const [systemPrompts, setSystemPrompts] = useState<Record<string, string>>({});
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [isSettingsLoading, setIsSettingsLoading] = useState(false);
  const [isSettingsSaving, setIsSettingsSaving] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);

  // Scheduler Agent Card Simulated State
  const [schedulerConfirmed, setSchedulerConfirmed] = useState(false);
  const [schedulerDeclined, setSchedulerDeclined] = useState(false);

  // Selected Agent for Detail Side Drawer
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);

  // Agent Status List State for Middle Panel
  const [agentsStatus, setAgentsStatus] = useState<AgentStatus[]>([
    {
      id: "cso-intel-assistant",
      name: "Supervisor Agent",
      role: "Core Intelligence",
      status: "Idle",
      dotColor: "bg-blue-500",
      description: "Primary orchestrator and router",
      iconColor: "#3b82f6",
    },
    {
      id: "market-intelligence",
      name: "Market Intelligence",
      role: "Sector Analysis",
      status: "Idle",
      dotColor: "bg-purple-500",
      description: "Tracks capital flows and FDI trends",
      metric: "92% Confidence",
      sparkline: [20, 35, 25, 45, 30, 50, 42],
      iconColor: "#8b5cf6",
    },
    {
      id: "regulatory-intelligence",
      name: "Regulatory Intelligence",
      role: "Policy & Legislative",
      status: "Idle",
      dotColor: "bg-blue-400",
      description: "Monitors policy compliance and shifts",
      metric: "8 updates active",
      sparkline: [40, 30, 45, 35, 50, 40, 48],
      iconColor: "#60a5fa",
    },
    {
      id: "competitive-intelligence",
      name: "Competitive Intelligence",
      role: "Competitor Benchmarking",
      status: "Idle",
      dotColor: "bg-emerald-500",
      description: "Benchmarks rival financial centers",
      metric: "+1.8pp share shift",
      sparkline: [15, 20, 18, 30, 22, 35, 40],
      iconColor: "#10b981",
    },
    {
      id: "executive-communications",
      name: "Scheduler Agent",
      role: "Calendar & Executive Copy",
      status: "Pending Confirmation",
      dotColor: "bg-amber-500",
      description: "Drafts papers and coordinates ops",
      iconColor: "#f59e0b",
    },
  ]);

  // Load initial data on mount
  useEffect(() => {
    fetchDocuments();
    fetchBriefing();
    fetchAgentConfigs();
    fetchPreparedBriefing();
    fetchSettings();
  }, []);

  const fetchDocuments = async () => {
    try {
      const res = await fetch("http://localhost:3141/api/documents");
      if (res.ok) {
        const data = await res.json();
        setDocuments(data);
      }
    } catch (err) {
      console.error("Failed to load documents:", err);
    }
  };

  const fetchAgentConfigs = async () => {
    try {
      const res = await fetch("http://localhost:3141/agents");
      if (res.ok) {
        const data = await res.json();
        const prompts: Record<string, string> = {};
        if (Array.isArray(data)) {
          data.forEach((agent: any) => {
            prompts[agent.name] = agent.instructions || "";
          });
        } else if (data && typeof data === "object") {
          Object.keys(data).forEach((key) => {
            prompts[key] = data[key].instructions || "";
          });
        }
        setSystemPrompts(prompts);
      }
    } catch (err) {
      console.error("Failed to load agent configs:", err);
    }
  };

  const fetchBriefing = async (focus: string = "all") => {
    setIsBriefingLoading(true);
    try {
      // Fast path: if we have a prepared snapshot in memory, just
      // re-apply the focus filter locally. No network call needed.
      // This is the new default — the dashboard's briefing tab
      // renders the cron-prepared snapshot, not a fresh tool call.
      if (preparedRecord && focus === briefingFilter) {
        setBriefing(applyFocusFilter(preparedRecord.briefing, focus));
        return;
      }
      // If we don't have a prepared snapshot yet (e.g. the cron
      // hasn't run and the user just opened the tab), fall back to
      // the live tool endpoint so the panel isn't blank.
      const res = await fetch(
        "http://localhost:3141/tools/generate_daily_briefing/execute",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ input: { focus } }),
        },
      );
      if (res.ok) {
        const data = await res.json();
        setBriefing(data.success && data.data ? data.data.result : null);
      }
    } catch (err) {
      console.error("Failed to load briefing:", err);
    } finally {
      setIsBriefingLoading(false);
    }
  };

  const handleBriefingFilterChange = (filter: typeof briefingFilter) => {
    setBriefingFilter(filter);
    // Re-derive the visible briefing from the prepared snapshot
    // (instant, no network). Falls through to the live tool path
    // only if no snapshot exists.
    if (preparedRecord) {
      setBriefing(applyFocusFilter(preparedRecord.briefing, filter));
    } else {
      fetchBriefing(filter);
    }
  };

  // ── Prepared-snapshot (fast read) + bell state ────────────────
  //
  // Reads the prepared snapshot the cron job writes to disk. This is
  // what the dashboard actually renders in the "Daily Briefings" tab.
  // The localStorage-backed `lastSeenBriefingAt` drives the bell:
  // when the cron publishes a new snapshot whose `preparedAt` is
  // newer than what the user last saw, the bell badge appears on the
  // sidebar's "Daily Briefings" entry. Clicking that entry (or the
  // bell) clears the localStorage key so the badge disappears.

  const BRIEFING_LAST_SEEN_KEY = "cso.briefings.lastSeenPreparedAt";

  const fetchPreparedBriefing = async () => {
    try {
      const res = await fetch("http://localhost:3141/api/briefing/today");
      if (res.ok) {
        const data = await res.json();
        const record = data.success && data.record ? (data.record as PreparedBriefingRecord) : null;
        setPreparedRecord(record);
        if (record) {
          // The briefing tab renders the prepared snapshot. Apply
          // the user's current focus filter on top of it so the
          // visible state matches the filter buttons.
          setBriefing(applyFocusFilter(record.briefing, briefingFilter));
          // Decide whether to show the bell. We compare against the
          // stored "last seen preparedAt" and show the bell if the
          // prepared snapshot is newer (or there's no record at all).
          try {
            const lastSeen = window.localStorage.getItem(BRIEFING_LAST_SEEN_KEY);
            if (!lastSeen || lastSeen < record.preparedAt) {
              setHasUnseenBriefing(true);
            } else {
              setHasUnseenBriefing(false);
            }
          } catch {
            // localStorage unavailable — show the bell to be safe.
            setHasUnseenBriefing(true);
          }
        }
      } else if (res.status === 404) {
        setPreparedRecord(null);
        setHasUnseenBriefing(false);
      }
    } catch (err) {
      console.error("Failed to load prepared briefing:", err);
    }
  };

  const markBriefingSeen = () => {
    if (preparedRecord) {
      try {
        window.localStorage.setItem(BRIEFING_LAST_SEEN_KEY, preparedRecord.preparedAt);
      } catch {
        // localStorage unavailable — keep UI state in memory.
      }
    }
    setHasUnseenBriefing(false);
  };

  // Re-fetch and recompute bell state. Called by the briefing panel
  // after a manual refresh so a brand-new snapshot lights up the
  // bell again.
  const refreshPreparedBriefing = async () => {
    setHasUnseenBriefing(true);
    await fetchPreparedBriefing();
  };

  // ── Settings fetch / save ──────────────────────────────────────

  const fetchSettings = async () => {
    setIsSettingsLoading(true);
    setSettingsError(null);
    try {
      const res = await fetch("http://localhost:3141/api/settings");
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.settings) {
          setSettings(data.settings as AppSettings);
        }
      } else {
        setSettingsError(`Failed to load settings (HTTP ${res.status})`);
      }
    } catch (err) {
      setSettingsError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsSettingsLoading(false);
    }
  };

  const saveSettings = async (partial: Partial<AppSettings>): Promise<boolean> => {
    setIsSettingsSaving(true);
    setSettingsError(null);
    try {
      const res = await fetch("http://localhost:3141/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(partial),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        setSettings(data.settings as AppSettings);
        return true;
      }
      setSettingsError(data.error ?? `HTTP ${res.status}`);
      return false;
    } catch (err) {
      setSettingsError(err instanceof Error ? err.message : String(err));
      return false;
    } finally {
      setIsSettingsSaving(false);
    }
  };

  const animateSubAgents = (text: string) => {
    const lower = text.toLowerCase();
    const activeStates = [...agentsStatus];

    activeStates[0].status = "Processing...";
    activeStates[0].dotColor = "bg-blue-500 status-dot-pulse";

    if (
      lower.includes("market") ||
      lower.includes("fdi") ||
      lower.includes("capital") ||
      lower.includes("fund")
    ) {
      activeStates[1].status = "Analyzing...";
      activeStates[1].dotColor = "bg-purple-500 status-dot-pulse";
    }
    if (
      lower.includes("regulatory") ||
      lower.includes("policy") ||
      lower.includes("dfsa") ||
      lower.includes("rule")
    ) {
      activeStates[2].status = "Tracking...";
      activeStates[2].dotColor = "bg-blue-400 status-dot-pulse";
    }
    if (
      lower.includes("competitor") ||
      lower.includes("benchmark") ||
      lower.includes("difc") ||
      lower.includes("adgm") ||
      lower.includes("gift")
    ) {
      activeStates[3].status = "Benchmarking...";
      activeStates[3].dotColor = "bg-emerald-500 status-dot-pulse";
    }
    if (
      lower.includes("draft") ||
      lower.includes("memo") ||
      lower.includes("board paper")
    ) {
      activeStates[4].status = "Drafting...";
      activeStates[4].dotColor = "bg-amber-500 status-dot-pulse";
    }

    setAgentsStatus(activeStates);

    setTimeout(() => {
      resetAgentStatuses();
    }, 6000);
  };

  const resetAgentStatuses = () => {
    setAgentsStatus((prev) =>
      prev.map((agent, idx) => ({
        ...agent,
        status:
          idx === 4
            ? schedulerConfirmed
              ? "Starting"
              : schedulerDeclined
                ? "Declined"
                : "Pending Confirmation"
            : "Idle",
        dotColor:
          idx === 4
            ? schedulerConfirmed
              ? "bg-emerald-500"
              : schedulerDeclined
                ? "bg-red-500"
                : "bg-amber-500"
            : idx === 0
              ? "bg-blue-500"
              : idx === 1
                ? "bg-purple-500"
                : idx === 2
                  ? "bg-blue-400"
                  : "bg-emerald-500",
      }))
    );
  };

  const updateAgentMetrics = (agentId: string, outputData: any) => {
    setAgentsStatus((prev) =>
      prev.map((agent) => {
        if (agent.id === agentId) {
          let metric = agent.metric;
          let description = agent.description;
          let sparkline = agent.sparkline ? [...agent.sparkline] : undefined;

          if (agentId === "market-intelligence") {
            metric = "95% Confidence (Updated)";
            description = "FDI capital trends & flows analyzed";
            if (sparkline) {
              sparkline = sparkline.map(
                (v) => Math.min(60, Math.max(10, v + Math.floor(Math.random() * 16) - 8))
              );
            }
          } else if (agentId === "regulatory-intelligence") {
            let count = 8;
            if (outputData && typeof outputData === "object") {
              const res = outputData.result || outputData;
              if (Array.isArray(res)) count = res.length;
              else if (res && typeof res === "object" && Array.isArray(res.updates)) count = res.updates.length;
            }
            metric = `${count} regulatory updates active`;
            description = "Monitored compliance checks refreshed";
            if (sparkline) {
              sparkline = sparkline.map(
                (v) => Math.min(60, Math.max(10, v + Math.floor(Math.random() * 18) - 9))
              );
            }
          } else if (agentId === "competitive-intelligence") {
            metric = "+2.3pp regional share";
            description = "Benchmarked rival center positioning";
            if (sparkline) {
              sparkline = sparkline.map(
                (v) => Math.min(60, Math.max(10, v + Math.floor(Math.random() * 14) - 7))
              );
            }
          } else if (agentId === "cso-intel-assistant") {
            let alerts = 3;
            if (outputData && typeof outputData === "object") {
              const result = outputData.result || outputData;
              const criticalCount = Array.isArray(result.critical) ? result.critical.length : 0;
              const monitoringCount = Array.isArray(result.monitoring) ? result.monitoring.length : 0;
              alerts = criticalCount + monitoringCount;
            }
            description = `Compiled daily briefing: ${alerts} active alerts`;
          }

          return {
            ...agent,
            metric,
            description,
            sparkline,
          };
        }
        return agent;
      })
    );
  };

  const handleStopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsGenerating(false);
    setActiveToolStatus("");
    resetAgentStatuses();
  };

  const handleClearChat = () => {
    setMessages([
      {
        id: `welcome-${Date.now()}`,
        role: "assistant",
        content:
          "Good morning. I am your Strategic Intelligence Assistant. I am grounded in your institutional knowledge base and can orchestrate specialised market, regulatory, and competitive sub-agents to synthesize briefings, board memos, and risk assessments. \n\nHow can I support your strategy today?",
        timestamp: new Date(),
      },
    ]);
    setIsChatting(false);
  };

  const extractCitations = (text: string) => {
    const regex = /\[Source:\s*([^,\]]+),\s*chunk\s*(\d+),\s*relevance\s*([\d\.]+)\]/gi;
    const citations: Array<{
      docName: string;
      chunkIndex: number;
      score: number;
    }> = [];
    let match;

    while ((match = regex.exec(text)) !== null) {
      const docName = match[1].trim();
      const chunkIndex = parseInt(match[2], 10);
      const score = parseFloat(match[3]);

      if (!citations.some((c) => c.docName === docName && c.chunkIndex === chunkIndex)) {
        citations.push({ docName, chunkIndex, score });
      }
    }
    return citations;
  };

  const handlePromptSubmit = async (textToSend?: string) => {
    const promptText = (textToSend || inputVal).trim();
    if (!promptText) return;

    if (!isChatting) setIsChatting(true);
    setIsGenerating(true);
    setInputVal("");

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    let finalPrompt = promptText;
    if (focusedAgentId && focusedAgentId !== "cso-intel-assistant") {
      const agentDisp = AGENT_DISPLAY_NAMES[focusedAgentId] || focusedAgentId;
      finalPrompt = `[Agent Direct Focus: ${agentDisp}] Please delegate this prompt directly to the ${agentDisp} specialist agent and provide its analysis: ${promptText}`;
    }

    setActiveToolStatus("Orchestrating sub-agents...");

    const userMsg: Message = {
      id: `msg-${Date.now()}-user`,
      role: "user",
      content: promptText,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);

    animateSubAgents(promptText);

    const assistantMsgId = `msg-${Date.now()}-assistant`;
    const newAssistantMsg: Message = {
      id: assistantMsgId,
      role: "assistant",
      content: "",
      timestamp: new Date(),
      agentName: "Core Intelligence",
    };
    setMessages((prev) => [...prev, newAssistantMsg]);

    try {
      const response = await fetch(
        "http://localhost:3141/agents/cso-intel-assistant/stream",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            input: finalPrompt,
            options: {
              memory: {
                conversationId,
                userId: "cso-user",
              },
            },
          }),
          signal: controller.signal,
        }
      );

      if (!response.ok) {
        throw new Error(`Server returned status ${response.status}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder("utf-8");
      
      const stream: {
        buffer: string;
        content: string;
        agentName?: string;
        isLive?: boolean;
        liveSources?: LiveSource[];
        toolCallToSubAgent: Record<string, string>;
      } = {
        buffer: "",
        content: "",
        toolCallToSubAgent: {},
      };

      if (reader) {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;

          stream.buffer += decoder.decode(value, { stream: true });
          const lines = stream.buffer.split("\n");
          stream.buffer = lines.pop() || "";

          for (const line of lines) {
            const cleanLine = line.trim();
            if (!cleanLine.startsWith("data: ")) continue;

            try {
              const jsonStr = cleanLine.substring(6);
              const eventData = JSON.parse(jsonStr);

              if (eventData.text) {
                stream.content += eventData.text;
              }

              if (eventData.type === "tool-call") {
                const sub = eventData.subAgentName || eventData.executingAgentName;
                const toolName = eventData.toolName;
                
                let statusMsg = "Orchestrating sub-agents...";
                if (toolName === "generate_daily_briefing") {
                  statusMsg = "Compiling Daily Intelligence Briefing...";
                } else if (toolName === "retrieve_documents") {
                  statusMsg = "Searching strategic document RAG base...";
                } else if (toolName === "upload_document") {
                  statusMsg = "Ingesting and indexing document corpus...";
                } else if (toolName === "get_risk_indicators") {
                  statusMsg = "Analyzing strategic risks and threat parameters...";
                } else if (toolName === "get_performance_metrics") {
                  statusMsg = "Retrieving key performance metric details...";
                } else if (sub) {
                  const disp = AGENT_DISPLAY_NAMES[sub] || sub;
                  statusMsg = `Consulting ${disp} Specialist Agent...`;
                }
                setActiveToolStatus(statusMsg);

                if (sub && sub !== "cso-intel-assistant" && eventData.toolCallId) {
                  stream.toolCallToSubAgent[eventData.toolCallId] = sub;
                  if (!stream.agentName) {
                    stream.agentName = AGENT_DISPLAY_NAMES[sub] ?? sub;
                  }
                }
              }

              if (eventData.type === "tool-result") {
                setActiveToolStatus("Synthesizing tool response...");
                const out = eventData.output;
                let producedLiveSources = false;

                if (out && typeof out === "object") {
                  if (out.isLive === true) stream.isLive = true;
                  if (Array.isArray(out.liveSources) && out.liveSources.length > 0) {
                    stream.liveSources = out.liveSources as LiveSource[];
                    producedLiveSources = true;
                    if (stream.isLive === undefined) stream.isLive = true;
                  }
                  if (out.output && typeof out.output === "object") {
                    const inner = out.output;
                    if (inner.isLive === true) stream.isLive = true;
                    if (Array.isArray(inner.liveSources) && inner.liveSources.length > 0) {
                      stream.liveSources = inner.liveSources as LiveSource[];
                      producedLiveSources = true;
                      if (stream.isLive === undefined) stream.isLive = true;
                    }
                  }
                }

                if (producedLiveSources && eventData.toolCallId) {
                  const sub = stream.toolCallToSubAgent[eventData.toolCallId];
                  if (sub) {
                    stream.agentName = AGENT_DISPLAY_NAMES[sub] ?? sub;
                  }
                }

                const sub = eventData.toolCallId ? stream.toolCallToSubAgent[eventData.toolCallId] : null;
                if (sub) {
                  updateAgentMetrics(sub, out);
                } else {
                  const toolName = eventData.toolName;
                  if (toolName === "generate_daily_briefing") {
                    updateAgentMetrics("cso-intel-assistant", out);
                  }
                }
              }

              if (
                eventData.text ||
                stream.agentName ||
                stream.isLive !== undefined ||
                stream.liveSources
              ) {
                const parsedCitations = extractCitations(stream.content);
                const nextContent = stream.content;
                const nextAgentName = stream.agentName;
                const nextIsLive = stream.isLive;
                const nextLiveSources = stream.liveSources;

                setMessages((prev) =>
                  prev.map((m) => {
                    if (m.id === assistantMsgId) {
                      return {
                        ...m,
                        content: nextContent,
                        citations: parsedCitations,
                        agentName: nextAgentName ?? m.agentName,
                        isLive: nextIsLive ?? m.isLive,
                        liveSources: nextLiveSources ?? m.liveSources,
                      };
                    }
                    return m;
                  })
                );
              }
            } catch {
              // Ignore partial JSON parsing errors
            }
          }
        }
      }
    } catch (err: any) {
      if (err.name === "AbortError") {
        setMessages((prev) =>
          prev.map((m) => {
            if (m.id === assistantMsgId) {
              return {
                ...m,
                content: m.content
                  ? m.content + "\n\n⏹ *Generation halted by user.*"
                  : "⏹ *Generation halted by user.*",
              };
            }
            return m;
          })
        );
        return;
      }
      console.error("Error in streaming response:", err);
      setMessages((prev) =>
        prev.map((m) => {
          if (m.id === assistantMsgId) {
            return {
              ...m,
              content:
                "Sorry, I encountered a connection issue while communicating with the Core Intelligence server. Please ensure the Hono backend on port 3141 is running.",
            };
          }
          return m;
        })
      );
    } finally {
      setIsGenerating(false);
      abortControllerRef.current = null;
      setActiveToolStatus("");
      resetAgentStatuses();
    }
  };

  const handleConfirmMeeting = () => {
    setSchedulerConfirmed(true);
    setSchedulerDeclined(false);

    setAgentsStatus((prev) =>
      prev.map((agent, i) => {
        if (i === 4) {
          return {
            ...agent,
            status: "Starting",
            dotColor: "bg-emerald-500",
          };
        }
        return agent;
      })
    );

    setMessages((prev) => [
      ...prev,
      {
        id: `scheduler-confirm-${Date.now()}`,
        role: "assistant",
        content:
          "✅ **Meeting Schedule Confirmed**: I have updated calendar invites for the proposed meeting client session on **Tue, Apr 16 (10:00 AM - 10:45 AM)**. Notifications have been dispatched to John Doe and the 2 other invitees.",
        timestamp: new Date(),
        agentName: "Scheduler Agent",
      },
    ]);
  };

  const handleDeclineMeeting = () => {
    setSchedulerConfirmed(false);
    setSchedulerDeclined(true);

    setAgentsStatus((prev) =>
      prev.map((agent, i) => {
        if (i === 4) {
          return {
            ...agent,
            status: "Declined",
            dotColor: "bg-red-500",
          };
        }
        return agent;
      })
    );

    setMessages((prev) => [
      ...prev,
      {
        id: `scheduler-decline-${Date.now()}`,
        role: "assistant",
        content:
          "❌ **Meeting Proposed Declined**: The calendar reservation has been released, and the scheduler has been instructed to source alternative timeslots matching your preferences.",
        timestamp: new Date(),
        agentName: "Scheduler Agent",
      },
    ]);
  };

  const executePillAction = (actionText: string) => {
    setInputVal(actionText);
    handlePromptSubmit(actionText);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      await uploadFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      uploadFile(e.target.files[0]);
    }
  };

  const uploadFile = async (file: File) => {
    setIsUploading(true);
    setUploadSuccess(false);

    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64Content = event.target?.result as string;

      try {
        const res = await fetch("http://localhost:3141/api/documents/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: file.name,
            content: base64Content,
            mimeType: file.type,
          }),
        });

        if (res.ok) {
          setUploadSuccess(true);
          await fetchDocuments();
          setTimeout(() => setUploadSuccess(false), 5000);
        } else {
          alert(
            "Failed to parse and upload document. Make sure it is a valid PDF, DOCX, TXT, or MD."
          );
        }
      } catch (err) {
        console.error("Upload error:", err);
        alert("Network error connecting to backend.");
      } finally {
        setIsUploading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleDeleteDocument = async (id: string, name: string) => {
    if (
      !confirm(
        `Are you sure you want to delete "${name}"? This will permanently remove all its chunks from the strategic knowledge base.`
      )
    ) {
      return;
    }
    try {
      const res = await fetch(`http://localhost:3141/api/documents/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        await fetchDocuments();
      } else {
        alert("Failed to delete document.");
      }
    } catch (err) {
      console.error("Delete error:", err);
      alert("Network error connecting to backend.");
    }
  };

  return (
    <DashboardContext.Provider
      value={{
        messages,
        setMessages,
        inputVal,
        setInputVal,
        isChatting,
        setIsChatting,
        isGenerating,
        activeAgent,
        focusedAgentId,
        setFocusedAgentId,
        activeToolStatus,
        conversationId,
        handlePromptSubmit,
        handleStopGeneration,
        handleClearChat,
        executePillAction,

        documents,
        isUploading,
        uploadSuccess,
        dragActive,
        setDragActive,
        fetchDocuments,
        handleDrag,
        handleDrop,
        handleFileChange,
        uploadFile,
        handleDeleteDocument,

        briefing,
        isBriefingLoading,
        briefingFilter,
        fetchBriefing,
        handleBriefingFilterChange,
        preparedRecord,
        hasUnseenBriefing,
        markBriefingSeen,
        refreshPreparedBriefing,

        systemPrompts,
        fetchAgentConfigs,
        settings,
        isSettingsLoading,
        isSettingsSaving,
        settingsError,
        fetchSettings,
        saveSettings,

        agentsStatus,
        selectedAgentId,
        setSelectedAgentId,
        schedulerConfirmed,
        schedulerDeclined,
        handleConfirmMeeting,
        handleDeclineMeeting,
        animateSubAgents,
        resetAgentStatuses,
        updateAgentMetrics,
      }}
    >
      {children}
    </DashboardContext.Provider>
  );
}

export function useDashboard() {
  const context = useContext(DashboardContext);
  if (context === undefined) {
    throw new Error("useDashboard must be used within a DashboardProvider");
  }
  return context;
}
