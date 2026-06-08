"use client";

import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from "react";

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

export interface GeneratedPresentation {
  id: string;
  fileName: string;
  sizeBytes: number;
  generatedAt: string;
  downloadUrl: string;
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
  "executive-communications": "Strategic Output",
  "cso-intel-assistant": "Jarvis",
};

export const SELECTED_AGENT_CAPABILITIES: Record<string, string[]> = {
  "cso-intel-assistant": [
    "Orchestrate specialist sub-agents dynamically based on what you ask",
    "Generate comprehensive daily intelligence briefings with KPIs",
    "Track risk indicators across regulatory, market, and competitive domains",
    "Ingest and search your strategy docs, minutes, and reports",
    "Recall prior conversations and the institutional knowledge base"
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
    "Generate McKinsey-style PowerPoint presentations (.pptx)",
    "Draft formal Board Papers and C-suite strategy briefs",
    "Create talking points and presentation structures for executive sessions",
    "Support SCR, SWOT, and Executive Summary deck frameworks",
    "Draft memos, stakeholder updates, and briefing packs"
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
    "Generate a presentation on our digital assets strategy",
    "Create a SWOT deck comparing our positioning vs Singapore and ADGM",
    "Draft a board paper summarizing recent competitive intelligence findings",
    "Draft an executive briefing memo on GCC market flows"
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

  // Strategic Output / Sub-Agents States & Actions
  agentsStatus: AgentStatus[];
  selectedAgentId: string | null;
  setSelectedAgentId: (id: string | null) => void;
  presentations: GeneratedPresentation[];
  isPresentationLoading: boolean;
  fetchPresentations: () => Promise<void>;
  animateSubAgents: (text: string) => void;
  resetAgentStatuses: () => void;
  updateAgentMetrics: (agentId: string, outputData: any) => void;

  // User identity (localStorage-backed, populated by OnboardingModal)
  userName: string | null;
  hasOnboarded: boolean;
  setUserName: (name: string) => void;
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

// ── stripThinkingLines ────────────────────────────────────────────
// Safety net for the model occasionally leaking a planning prefix
// (e.g. "The user wants me to delegate…", "I'll pass this through…",
// "Let me present this cleanly to the user…") into the visible
// stream despite the supervisor prompt telling it not to. We only
// inspect the first 6 lines because the leak always appears at the
// very start of the reply — we never want to clobber a mid-message
// sentence that happens to start with "I".
const THINKING_PREFIX_PATTERNS: RegExp[] = [
  /^\s*the user (wants|is asking|asked|has asked|needs|just (said|sent|typed|asked))/i,
  /^\s*i('ll| will| should| need to| am going to| have to| want to| want| aim to)/i,
  /^\s*i('m| am) (going to|about to|thinking|planning|ready|here|standing|sitting)/i,
  /^\s*let me (now |just |cleanly )?(present|present this|write|draft|summarize|pass|show|deliver|format|respond|reply|handle|take|start|begin|craft|prepare|address)/i,
  /^\s*per (the |my )?instructions/i,
  /^\s*as (the |configured |an? )?(strategic|cso|jarvis|assistant|trusted|chief|personal|ai)/i,
  /^\s*now (i|let me|we)/i,
  /^\s*the (market|regulatory|competitive|executive|strategic)[ -](intel|intelligence|output|communications) agent has returned/i,
  /^\s*here('s| is) (the|what|my|a |an |how|why|where|when)/i,
  /^\s*(the user just said|the user just sent|the user has sent|responding to the user|in response to (the user|this|that))/i,
  /^\s*(this is (a |an )?(casual|formal|brief|short|quick)|keep it (brief|short|warm|simple|concise|focused))/i,
];

function stripThinkingLines(text: string): string {
  const lines = text.split("\n");
  let keptFrom = 0;
  const window = Math.min(lines.length, 6);
  for (let i = 0; i < window; i++) {
    const line = lines[i].trim();
    if (!line) {
      // Blank line — keep walking; the real content often starts
      // after a blank.
      continue;
    }
    const isThinking = THINKING_PREFIX_PATTERNS.some((re) => re.test(line));
    if (isThinking) {
      keptFrom = i + 1;
      continue;
    }
    break;
  }
  return lines.slice(keptFrom).join("\n").trimStart();
}

export function DashboardProvider({ children }: { children: React.ReactNode }) {
  // Chat States
  // The chat thread starts empty. The personalized welcome intro
  // lives in the ready view (orb + "Jarvis is ready") and is never
  // injected as a message bubble — that used to pop up awkwardly
  // above the user's first message.
  const [messages, setMessages] = useState<Message[]>([]);
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

  // ── User identity (localStorage-backed) ─────────────────────────
  // The OnboardingModal reads `hasOnboarded` to decide whether to
  // show itself on first visit, and calls `setUserName` once the
  // user submits. We deliberately keep this in localStorage rather
  // than the backend settings store so first-run UX works before
  // any auth / settings round-trip is required.
  const USER_NAME_KEY = "jarvis.userName";
  const ONBOARDED_KEY = "jarvis.hasOnboarded";
  const [userName, setUserNameState] = useState<string | null>(null);
  const [hasOnboarded, setHasOnboarded] = useState<boolean>(false);

  useEffect(() => {
    try {
      const storedName = window.localStorage.getItem(USER_NAME_KEY);
      const storedOnboarded = window.localStorage.getItem(ONBOARDED_KEY);
      if (storedName) setUserNameState(storedName);
      // hasOnboarded is true only if the modal has actually been
      // completed. Reading it lazily so SSR / no-localStorage
      // environments don't crash.
      setHasOnboarded(storedOnboarded === "true");
    } catch {
      // localStorage unavailable (private mode, etc.) — keep the
      // onboarding modal available in-session only.
    }
  }, []);

  const setUserName = (name: string) => {
    const trimmed = name.trim();
    setUserNameState(trimmed || null);
    setHasOnboarded(true);
    try {
      if (trimmed) window.localStorage.setItem(USER_NAME_KEY, trimmed);
      window.localStorage.setItem(ONBOARDED_KEY, "true");
    } catch {
      // best-effort persistence
    }
  };

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

  // Strategic Output Agent State — Presentations
  const [presentations, setPresentations] = useState<GeneratedPresentation[]>([]);
  const [isPresentationLoading, setIsPresentationLoading] = useState(false);

  // Selected Agent for Detail Side Drawer
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);

  // Agent Status List State for Middle Panel
  const [agentsStatus, setAgentsStatus] = useState<AgentStatus[]>([
    {
      id: "cso-intel-assistant",
      name: "Jarvis",
      role: "Strategic Intelligence",
      status: "Idle",
      dotColor: "bg-blue-500",
      description: "Primary orchestrator and your main point of contact",
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
      name: "Strategic Output",
      role: "Presentations & Executive Copy",
      status: "Idle",
      dotColor: "bg-amber-500",
      description: "Generates decks, papers, and memos",
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
    fetchPresentations();
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

  const fetchPresentations = useCallback(async () => {
    setIsPresentationLoading(true);
    try {
      const res = await fetch("http://localhost:3141/api/presentations");
      if (res.ok) {
        const data = await res.json();
        setPresentations(data);
      }
    } catch (err) {
      console.error("Failed to load presentations:", err);
    } finally {
      setIsPresentationLoading(false);
    }
  }, []);

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
      lower.includes("board paper") ||
      lower.includes("presentation") ||
      lower.includes("deck") ||
      lower.includes("slides") ||
      lower.includes("pptx") ||
      lower.includes("powerpoint")
    ) {
      activeStates[4].status = "Generating...";
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
        status: "Idle",
        dotColor:
          idx === 0
            ? "bg-blue-500"
            : idx === 1
              ? "bg-purple-500"
              : idx === 2
                ? "bg-blue-400"
                : idx === 3
                  ? "bg-emerald-500"
                  : "bg-amber-500",
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
    setMessages([]);
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

    // Drop any pre-existing welcome message from the thread so the
    // user's first message is the first thing they see. The welcome
    // intro belongs to the ready view, not the chat history.
    setMessages((prev) => prev.filter((m) => !m.id.startsWith("welcome")));

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
      agentName: "Jarvis",
    };
    setMessages((prev) => [...prev, newAssistantMsg]);

    // Hoisted so the catch / finally can clear any pending debounce
    // timer even if it never gets assigned. The timer is created
    // later, inside the streaming loop.
    let promoteTimer: ReturnType<typeof setTimeout> | null = null;
    const clearPromoteTimer = () => {
      if (promoteTimer) {
        clearTimeout(promoteTimer);
        promoteTimer = null;
      }
    };

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

      // ── Promotion / debounce state ──────────────────────────────
      // We keep accumulating text into `stream.content` but only
      // push the *stripped* content into the visible message after
      // a 600ms quiet period (or on stream end). This hides the
      // model monologue that sometimes leaks at the start of a
      // reply ("The user wants me to delegate…", "I'll pass this
      // through…", etc.) — the user only sees the final answer.
      let streamStripped = "";
      // Coalesce identical status updates so the loading text
      // doesn't flicker between the same value.
      let lastStatus = "";

      const PROMOTION_DELAY_MS = 600;

      const promoteStream = (options?: { final?: boolean }) => {
        const parsedCitations = extractCitations(streamStripped);
        const nextContent = streamStripped;
        const nextAgentName = stream.agentName;
        const nextIsLive = stream.isLive;
        const nextLiveSources = stream.liveSources;
        setMessages((prev) =>
          prev.map((m) => {
            if (m.id !== assistantMsgId) return m;
            return {
              ...m,
              content: nextContent,
              citations: parsedCitations,
              agentName: nextAgentName ?? m.agentName,
              isLive: nextIsLive ?? m.isLive,
              liveSources: nextLiveSources ?? m.liveSources,
            };
          }),
        );
        if (options?.final) {
          streamStripped = nextContent;
        }
      };

      const schedulePromotion = () => {
        clearPromoteTimer();
        promoteTimer = setTimeout(() => {
          promoteTimer = null;
          promoteStream();
        }, PROMOTION_DELAY_MS);
      };

      // Coalesce: only call setActiveToolStatus when the value
      // actually changes. Prevents flicker when the same status is
      // re-set across adjacent tool events.
      const setStatus = (msg: string) => {
        if (msg === lastStatus) return;
        lastStatus = msg;
        setActiveToolStatus(msg);
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
                // Recompute the stripped view and schedule a
                // promotion. While chunks are arriving, the
                // debounce keeps resetting — we only push once the
                // stream has been quiet for PROMOTION_DELAY_MS.
                const nextStripped = stripThinkingLines(stream.content);
                if (nextStripped !== streamStripped) {
                  streamStripped = nextStripped;
                  schedulePromotion();
                }
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
                } else if (toolName === "generate_strategic_presentation") {
                  statusMsg = "Generating McKinsey-style presentation deck...";
                } else if (sub) {
                  const disp = AGENT_DISPLAY_NAMES[sub] || sub;
                  statusMsg = `Consulting ${disp} Specialist Agent...`;
                }
                setStatus(statusMsg);

                if (sub && sub !== "cso-intel-assistant" && eventData.toolCallId) {
                  stream.toolCallToSubAgent[eventData.toolCallId] = sub;
                  if (!stream.agentName) {
                    stream.agentName = AGENT_DISPLAY_NAMES[sub] ?? sub;
                  }
                }
              }

              if (eventData.type === "tool-result") {
                setStatus("Synthesizing tool response...");
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
                  if (toolName === "generate_strategic_presentation") {
                    fetchPresentations();
                  }
                }
              }

              // Metadata-only changes (agentName / isLive / liveSources)
              // are pushed immediately so the message header reflects
              // the right sub-agent as soon as a tool handoff happens.
              // The text body keeps its debounced promotion path above.
              if (
                stream.agentName ||
                stream.isLive !== undefined ||
                stream.liveSources
              ) {
                promoteStream();
              }
            } catch {
              // Ignore partial JSON parsing errors
            }
          }
        }

        // Stream closed — force one final promotion so the user sees
        // the complete stripped content.
        clearPromoteTimer();
        promoteStream({ final: true });
      }
    } catch (err: any) {
      // Make sure no debounced promotion fires after we've already
      // handled the error / abort path.
      clearPromoteTimer();
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
                "Sorry — I couldn't reach the backend. Please make sure the Hono server is running on port 3141.",
            };
          }
          return m;
        })
      );
    } finally {
      clearPromoteTimer();
      setIsGenerating(false);
      abortControllerRef.current = null;
      setActiveToolStatus("");
      resetAgentStatuses();
    }
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
        presentations,
        isPresentationLoading,
        fetchPresentations,
        animateSubAgents,
        resetAgentStatuses,
        updateAgentMetrics,

        userName,
        hasOnboarded,
        setUserName,
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
