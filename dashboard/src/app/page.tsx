"use client";

import React, { useState, useEffect, useRef } from "react";
import { 
  BarChart2, 
  BookOpen, 
  Calendar, 
  Check, 
  CheckSquare, 
  ChevronDown,
  Clock, 
  FileText, 
  Globe, 
  GraduationCap,
  HelpCircle, 
  Layers, 
  Layout, 
  Loader2, 
  MessageSquare, 
  Mic, 
  PenTool,
  RefreshCw, 
  Send, 
  Settings, 
  Sparkles, 
  TrendingUp, 
  UploadCloud, 
  User, 
  Users, 
  Wand2,
  X, 
  Zap
} from "lucide-react";

// Types matching backend models
interface StoredDocument {
  id: string;
  name: string;
  kind: "pdf" | "docx" | "txt" | "md";
  uploadedAt: string;
  chunkCount: number;
  characterCount: number;
  source: "upload" | "seed";
}

interface BriefingItem {
  title: string;
  summary: string;
  source: string;
  domain: "market" | "regulatory" | "competitive" | "risk";
}

interface KPIItem {
  label: string;
  value: string;
  delta: string;
  trend: "up" | "down" | "flat";
}

interface BriefingData {
  date: string;
  generatedAt: string;
  focus: string;
  critical: BriefingItem[];
  monitoring: BriefingItem[];
  opportunities: BriefingItem[];
  kpis: KPIItem[];
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  agentName?: string;
  citations?: Array<{ docName: string; excerpt?: string; chunkIndex?: number }>;
}

export default function CsoDashboard() {
  // Navigation State
  const [activeTab, setActiveTab] = useState<"dashboard" | "documents" | "briefing" | "config">("dashboard");

  // Chat States
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content: "Good morning. I am your Strategic Intelligence Assistant. I am grounded in your institutional knowledge base and can orchestrate specialised market, regulatory, and competitive sub-agents to synthesize briefings, board memos, and risk assessments. \n\nHow can I support your strategy today?",
      timestamp: new Date(),
    }
  ]);
  const [inputVal, setInputVal] = useState("");
  const [isChatting, setIsChatting] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeAgent, setActiveAgent] = useState<string>("cso-intel-assistant");
  const [conversationId] = useState(() => `cso-session-${Math.random().toString(36).substring(2, 11)}`);
  
  // Document Library States
  const [documents, setDocuments] = useState<StoredDocument[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  // Daily Briefing States
  const [briefing, setBriefing] = useState<BriefingData | null>(null);
  const [isBriefingLoading, setIsBriefingLoading] = useState(false);
  const [briefingFilter, setBriefingFilter] = useState<"all" | "market" | "regulatory" | "competitive" | "risk">("all");

  // Settings Configuration States
  const [systemPrompts, setSystemPrompts] = useState<Record<string, string>>({});

  // Scheduler Agent Card Simulated State
  const [schedulerConfirmed, setSchedulerConfirmed] = useState(false);
  const [schedulerDeclined, setSchedulerDeclined] = useState(false);

  // Agent Status List State for Middle Panel
  const [agentsStatus, setAgentsStatus] = useState([
    {
      id: "cso-intel-assistant",
      name: "Supervisor Agent",
      role: "Core Intelligence",
      status: "Idle",
      dotColor: "bg-blue-500",
      description: "Primary orchestrator and router",
      iconColor: "#3b82f6"
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
      iconColor: "#8b5cf6"
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
      iconColor: "#60a5fa"
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
      iconColor: "#10b981"
    },
    {
      id: "executive-communications",
      name: "Scheduler Agent",
      role: "Calendar & Executive Copy",
      status: "Pending Confirmation",
      dotColor: "bg-amber-500",
      description: "Drafts papers and coordinates ops",
      iconColor: "#f59e0b"
    }
  ]);

  const chatEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isGenerating]);

  // Load seeded documents on mount
  useEffect(() => {
    fetchDocuments();
    fetchBriefing();
    fetchAgentConfigs();
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
          // If returned as an object mapping
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
      const res = await fetch("http://localhost:3141/tools/generate_daily_briefing/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: { focus } }),
      });
      if (res.ok) {
        const data = await res.json();
        setBriefing(data);
      }
    } catch (err) {
      console.error("Failed to load briefing:", err);
    } finally {
      setIsBriefingLoading(false);
    }
  };

  // Triggered when user selects briefing domain tab
  const handleBriefingFilterChange = (filter: typeof briefingFilter) => {
    setBriefingFilter(filter);
    fetchBriefing(filter);
  };

  // Helper to trigger simulated active states in middle panel agents
  const animateSubAgents = (text: string) => {
    const lower = text.toLowerCase();
    const activeStates = [...agentsStatus];

    // Supervisor is always active when typing
    activeStates[0].status = "Processing...";
    activeStates[0].dotColor = "bg-blue-500 status-dot-pulse";

    if (lower.includes("market") || lower.includes("fdi") || lower.includes("capital") || lower.includes("fund")) {
      activeStates[1].status = "Analyzing...";
      activeStates[1].dotColor = "bg-purple-500 status-dot-pulse";
    }
    if (lower.includes("regulatory") || lower.includes("policy") || lower.includes("dfsa") || lower.includes("rule")) {
      activeStates[2].status = "Tracking...";
      activeStates[2].dotColor = "bg-blue-400 status-dot-pulse";
    }
    if (lower.includes("competitor") || lower.includes("benchmark") || lower.includes("difc") || lower.includes("adgm") || lower.includes("gift")) {
      activeStates[3].status = "Benchmarking...";
      activeStates[3].dotColor = "bg-emerald-500 status-dot-pulse";
    }
    if (lower.includes("draft") || lower.includes("memo") || lower.includes("board paper")) {
      activeStates[4].status = "Drafting...";
      activeStates[4].dotColor = "bg-amber-500 status-dot-pulse";
    }

    setAgentsStatus(activeStates);

    // Revert to idle after 6 seconds
    setTimeout(() => {
      resetAgentStatuses();
    }, 6000);
  };

  const resetAgentStatuses = () => {
    setAgentsStatus(prev => prev.map((agent, idx) => ({
      ...agent,
      status: idx === 4 ? (schedulerConfirmed ? "Starting" : schedulerDeclined ? "Declined" : "Pending Confirmation") : "Idle",
      dotColor: idx === 4 
        ? (schedulerConfirmed ? "bg-emerald-500" : schedulerDeclined ? "bg-red-500" : "bg-amber-500") 
        : (idx === 0 ? "bg-blue-500" : idx === 1 ? "bg-purple-500" : idx === 2 ? "bg-blue-400" : "bg-emerald-500")
    })));
  };

  // Submit Prompt Handler (SSE Streaming)
  const handlePromptSubmit = async (textToSend?: string) => {
    const promptText = (textToSend || inputVal).trim();
    if (!promptText) return;

    if (!isChatting) setIsChatting(true);
    setIsGenerating(true);
    setInputVal("");

    // Add user message
    const userMsg: Message = {
      id: `msg-${Date.now()}-user`,
      role: "user",
      content: promptText,
      timestamp: new Date()
    };
    setMessages(prev => [...prev, userMsg]);
    
    // Set simulated agent status
    animateSubAgents(promptText);

    // Placeholder message for assistant stream
    const assistantMsgId = `msg-${Date.now()}-assistant`;
    const newAssistantMsg: Message = {
      id: assistantMsgId,
      role: "assistant",
      content: "",
      timestamp: new Date(),
      agentName: "Core Intelligence"
    };
    setMessages(prev => [...prev, newAssistantMsg]);

    try {
      const response = await fetch("http://localhost:3141/agents/cso-intel-assistant/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          input: promptText,
          options: {
            memory: {
              conversationId,
              userId: "cso-user"
            }
          }
        })
      });

      if (!response.ok) {
        throw new Error(`Server returned status ${response.status}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder("utf-8");
      let streamBuffer = "";
      let accumulatedContent = "";

      if (reader) {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;

          streamBuffer += decoder.decode(value, { stream: true });
          const lines = streamBuffer.split("\n");
          streamBuffer = lines.pop() || ""; // keep unfinished line in buffer

          for (const line of lines) {
            const cleanLine = line.trim();
            if (!cleanLine.startsWith("data: ")) continue;

            try {
              const jsonStr = cleanLine.substring(6);
              const eventData = JSON.parse(jsonStr);

              if (eventData.text) {
                accumulatedContent += eventData.text;
                
                // Parse citations dynamically from text chunk updates
                const parsedCitations = extractCitations(accumulatedContent);

                setMessages(prev => prev.map(m => {
                  if (m.id === assistantMsgId) {
                    return {
                      ...m,
                      content: accumulatedContent,
                      citations: parsedCitations
                    };
                  }
                  return m;
                }));
              }
            } catch (err) {
              // Ignore partial parsing errors of incomplete lines
            }
          }
        }
      }
    } catch (err) {
      console.error("Error in streaming response:", err);
      setMessages(prev => prev.map(m => {
        if (m.id === assistantMsgId) {
          return {
            ...m,
            content: "Sorry, I encountered a connection issue while communicating with the Core Intelligence server. Please ensure the Hono backend on port 3141 is running."
          };
        }
        return m;
      }));
    } finally {
      setIsGenerating(false);
      resetAgentStatuses();
    }
  };

  // Helper to extract citation details from VoltAgent bracket citation patterns
  // e.g. [Source: board-minutes-q1-2026.md, chunk 6, relevance 0.789]
  const extractCitations = (text: string) => {
    const regex = /\[Source:\s*([^,\]]+),\s*chunk\s*(\d+),\s*relevance\s*([\d\.]+)\]/gi;
    const citations: Array<{ docName: string; chunkIndex: number; score: number }> = [];
    let match;
    
    while ((match = regex.exec(text)) !== null) {
      const docName = match[1].trim();
      const chunkIndex = parseInt(match[2], 10);
      const score = parseFloat(match[3]);
      
      // Prevent duplicates
      if (!citations.some(c => c.docName === docName && c.chunkIndex === chunkIndex)) {
        citations.push({ docName, chunkIndex, score });
      }
    }
    return citations;
  };

  // Drag-and-drop document upload handlers
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
      uploadFile(e.dataTransfer.files[0]);
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
          fetchDocuments(); // Refresh document list
          setTimeout(() => setUploadSuccess(false), 5000);
        } else {
          alert("Failed to parse and upload document. Make sure it is a valid PDF, DOCX, TXT, or MD.");
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

  const handleConfirmMeeting = () => {
    setSchedulerConfirmed(true);
    setSchedulerDeclined(false);
    
    // Update agent status list immediately
    setAgentsStatus(prev => prev.map((agent, i) => {
      if (i === 4) {
        return {
          ...agent,
          status: "Starting",
          dotColor: "bg-emerald-500"
        };
      }
      return agent;
    }));

    // Trigger standard message confirmation notification
    setMessages(prev => [
      ...prev,
      {
        id: `scheduler-confirm-${Date.now()}`,
        role: "assistant",
        content: "✅ **Meeting Schedule Confirmed**: I have updated calendar invites for the proposed meeting client session on **Tue, Apr 16 (10:00 AM - 10:45 AM)**. Notifications have been dispatched to John Doe and the 2 other invitees.",
        timestamp: new Date(),
        agentName: "Scheduler Agent"
      }
    ]);
  };

  const handleDeclineMeeting = () => {
    setSchedulerConfirmed(false);
    setSchedulerDeclined(true);
    
    setAgentsStatus(prev => prev.map((agent, i) => {
      if (i === 4) {
        return {
          ...agent,
          status: "Declined",
          dotColor: "bg-red-500"
        };
      }
      return agent;
    }));

    setMessages(prev => [
      ...prev,
      {
        id: `scheduler-decline-${Date.now()}`,
        role: "assistant",
        content: "❌ **Meeting Proposed Declined**: The calendar reservation has been released, and the scheduler has been instructed to source alternative timeslots matching your preferences.",
        timestamp: new Date(),
        agentName: "Scheduler Agent"
      }
    ]);
  };

  const executePillAction = (actionText: string) => {
    setInputVal(actionText);
    handlePromptSubmit(actionText);
  };

  // Helper to clean VoltAgent source brackets out of printed text
  const formatMessageContent = (content: string) => {
    // Replace markdown table delimiters to render cleanly or keep markup
    // Also strip [Source: ...] citations so they don't clutter prose since we show them as custom pills
    const cleanText = content.replace(/\[Source:\s*([^,\]]+),\s*chunk\s*(\d+),\s*relevance\s*([\d\.]+)\]/gi, "");
    
    // Simple parser to format code blocks and bold titles
    return cleanText.split("\n").map((line, i) => {
      // Bold title formatting
      let formattedLine: React.ReactNode = line;
      if (line.startsWith("### ")) {
        formattedLine = <h4 className="text-md font-bold mt-3 mb-1 text-gray-800">{line.replace("### ", "")}</h4>;
      } else if (line.startsWith("## ")) {
        formattedLine = <h3 className="text-lg font-bold mt-4 mb-2 text-gray-900">{line.replace("## ", "")}</h3>;
      } else if (line.startsWith("- ") || line.startsWith("* ")) {
        formattedLine = <li className="ml-5 list-disc my-1">{line.substring(2)}</li>;
      }
      
      return <div key={i} className="leading-relaxed">{formattedLine}</div>;
    });
  };

  return (
    <div className="dashboard-root">
      {/* ── LEFT SIDEBAR NAVIGATION ── */}
      <aside className="cso-sidebar">
        <div className="logo-container">
          {/* Logo Cluster */}
          <div style={{ cursor: 'pointer' }}>
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="10" cy="12" r="6" fill="#3b82f6" />
              <circle cx="22" cy="10" r="5" fill="#60a5fa" />
              <circle cx="18" cy="22" r="7" fill="#2563eb" />
            </svg>
          </div>

          {/* Navigation Items */}
          <nav className="nav-container">
            {[
              { id: "dashboard", icon: Layout, label: "Console" },
              { id: "documents", icon: BookOpen, label: "Document\nLibrary" },
              { id: "briefing", icon: Calendar, label: "Daily\nBriefings" },
              { id: "config", icon: Settings, label: "System\nPrompts" }
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`nav-button ${isActive ? "active" : ""}`}
                >
                  <Icon size={18} strokeWidth={isActive ? 2.5 : 1.8} />
                  <span className="nav-label">{tab.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Bottom Profile and Settings */}
        <div className="profile-avatar">
          <button style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#9ca3af' }}>
            <Sparkles size={18} />
          </button>
          
          {/* User Profile Avatar */}
          <div className="avatar-circle" style={{ backgroundColor: '#1e293b', color: '#ffffff', border: '2px solid #334155', fontSize: '11px' }}>
            N
          </div>
        </div>
      </aside>

      {/* ── LEFT-CENTER AGENT COLUMN (DASHBOARD/CONSOLE TAB ONLY) ── */}
      {activeTab === "dashboard" && (
        <section className="agents-column">
          <div className="column-header">
            <h2>Strategy Agents</h2>
            <p>Status of live analytical workers</p>
          </div>

          <div className="agents-list">
            {agentsStatus.map((agent, index) => (
              <div 
                key={agent.id} 
                className={`agent-card ${agent.status !== "Idle" ? "active-state" : ""}`}
              >
                {/* Header block with logo, name, status indicator */}
                <div className="agent-card-header">
                  <div className="agent-card-logo-info">
                    <div className="agent-card-logo" style={{ backgroundColor: agent.iconColor }}>
                      {agent.name.substring(0, 1)}
                    </div>
                    <div className="agent-card-info">
                      <h3>{agent.name}</h3>
                      <span>{agent.role}</span>
                    </div>
                  </div>
                  <div className="agent-card-status">
                    <span className="status-dot" style={{ backgroundColor: agent.iconColor }} />
                    <span className="status-text">{agent.status}</span>
                  </div>
                </div>

                {/* Sub-panels based on agent type */}
                {index === 4 && ( // Scheduler Agent Panel
                  <div className="scheduler-panel">
                    {!schedulerConfirmed && !schedulerDeclined ? (
                      <div className="animate-fade-in">
                        <h4>Confirm Meeting Schedule?</h4>
                        <p>
                          Your Scheduler Agent has proposed a meeting with John Doe. Please review details.
                        </p>

                        <div className="meeting-client-box">
                          <div className="meeting-client-header">
                            <span>Meeting Client</span>
                            <span className="starting-badge">Starting</span>
                          </div>

                          <div className="meeting-details">
                            <div className="meeting-detail-item">
                              <Calendar size={12} className="text-slate-400" />
                              Tue, Apr 16
                              <Clock size={12} className="text-slate-400 ml-2" />
                              10:00 AM - 10:45 AM
                            </div>
                            <div className="meeting-detail-item">
                              <Users size={12} className="text-slate-400" />
                              +2 People
                            </div>
                          </div>

                          <div className="meeting-pills-row">
                            <span className="meeting-pill">
                              <CheckSquare size={10} /> 3 Todo List
                            </span>
                            <span className="meeting-pill">
                              <Clock size={10} /> 60 Min
                            </span>
                          </div>
                        </div>

                        <div className="meeting-actions">
                          <button 
                            onClick={handleConfirmMeeting}
                            className="confirm-button shadow-sm"
                          >
                            Confirm
                          </button>
                          <button 
                            onClick={handleDeclineMeeting}
                            className="decline-button"
                          >
                            Decline
                          </button>
                        </div>
                      </div>
                    ) : schedulerConfirmed ? (
                      <div className="status-card-success animate-fade-in">
                        <Check size={14} className="stroke-[3px]" />
                        <span>Meeting schedule confirmed</span>
                      </div>
                    ) : (
                      <div className="status-card-declined animate-fade-in">
                        <X size={14} className="stroke-[3px]" />
                        <span>Proposed meeting declined</span>
                      </div>
                    )}
                  </div>
                )}

                {agent.sparkline && ( // Sparkline cards for Market, Reg, Competitor
                  <div>
                    <p className="agent-description">{agent.description}</p>
                    
                    <div className="sparkline-row">
                      <div className="sparkline-metric">
                        {agent.metric}
                      </div>
                      
                      {/* Interactive Sparkline SVGs */}
                      <svg width="80" height="24" className="overflow-visible">
                        <polyline
                          fill="none"
                          stroke={agent.iconColor}
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          points={agent.sparkline.map((val, i) => `${(i * 80) / (agent.sparkline.length - 1)},${24 - val * 0.4}`).join(" ")}
                        />
                      </svg>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── MAIN INTERACTIVE AREA ── */}
      <main className="main-container">
        
        {/* ── DASHBOARD TAB ── */}
        {activeTab === "dashboard" && (
          <div className="flex-1 flex flex-col h-full overflow-hidden">
            {/* Header Strip */}
            <header className="dashboard-header">
              <div className="header-left">
                <h1>Good Afternoon, Adom</h1>
                <p>3 agents active • {schedulerConfirmed || schedulerDeclined ? "0" : "1"} pending action</p>
              </div>
              <div className="header-right">
                <p className="date">Tuesday, May 14</p>
                <p className="time">14:02 PM GMT</p>
              </div>
            </header>

            {/* Content Pane */}
            <div className="content-pane">
              {!isChatting ? (
                /* ── AI READY CENTRAL SHIELD (GLOWING WAVE) ── */
                <div className="ready-view">
                  
                  {/* Glowing Wave Animation */}
                  <div className="orb-wrapper">
                    {/* Glowing blue backplane */}
                    <div className="orb-glow animate-pulse-glow" />
                    
                    {/* Glowing Circular wave spiral SVG */}
                    <div className="orb-svg-container animate-spin-slow">
                      <svg width="288" height="288" viewBox="0 0 288 288" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <circle cx="144" cy="144" r="140" stroke="#bfdbfe" strokeWidth="0.5" strokeDasharray="3 6" />
                        <circle cx="144" cy="144" r="110" stroke="#93c5fd" strokeWidth="0.5" strokeDasharray="2 4" />
                        <path d="M 144,34 A 110,110 0 0,1 254,144 A 110,110 0 0,1 144,254 A 110,110 0 0,1 34,144" stroke="#60a5fa" strokeWidth="1" strokeLinecap="round" strokeDasharray="4 8" />
                        
                        {/* Spiral wavy vectors */}
                        <path d="M144 144C100 120 70 80 50 144C30 208 80 220 144 144Z" stroke="#3b82f6" strokeWidth="0.8" opacity="0.3" />
                        <path d="M144 144C188 168 218 208 238 144C258 80 208 68 144 144Z" stroke="#2563eb" strokeWidth="0.8" opacity="0.3" />
                        <path d="M144 144C120 188 80 218 144 238C208 258 220 208 144 144Z" stroke="#3b82f6" strokeWidth="0.8" opacity="0.3" />
                        <path d="M144 144C168 100 208 70 144 50C80 30 68 80 144 144Z" stroke="#1d4ed8" strokeWidth="0.8" opacity="0.3" />
                      </svg>
                    </div>

                    {/* Central Core Emblem */}
                    <div className="orb-logo-inner shadow-premium-box">
                      <div className="orb-gradient-core">
                        <div className="orb-glass-shield">
                          <svg width="40" height="40" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" className="filter drop-shadow-md">
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
                      { text: "What's the latest market intelligence?", label: "Magic AI", icon: Wand2 },
                      { text: "Any new regulatory updates?", label: "Holistic", icon: Globe },
                      { text: "How do we compare against competitors?", label: "Canvas", icon: PenTool },
                      { text: "Generate daily briefing", label: "Quizzes", icon: GraduationCap }
                    ].map((pill, idx) => {
                      const PillIcon = pill.icon;
                      return (
                        <button
                          key={idx}
                          onClick={() => executePillAction(pill.text)}
                          className="pill-button"
                        >
                          <PillIcon size={14} style={{ color: '#9ca3af' }} />
                          {pill.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                /* ── ACTIVE CHET THREAD ── */
                <div className="chat-thread-container shadow-premium-box">
                  {/* Chat Message Scroll */}
                  <div className="chat-scroll">
                    {messages.map((msg) => (
                      <div 
                        key={msg.id}
                        className={`message-wrapper ${msg.role}`}
                      >
                        {/* Avatar */}
                        <div className={`avatar-circle msg ${msg.role}`}>
                          {msg.role === "user" ? "AD" : "AI"}
                        </div>

                        {/* Speech Bubble */}
                        <div className="message-content-wrapper">
                          {msg.role === "assistant" && (
                            <span className="message-agent-name">
                              {msg.agentName || "Core Intelligence"}
                            </span>
                          )}
                          <div className={`message-bubble ${msg.role}`}>
                            {formatMessageContent(msg.content)}
                          </div>

                          {/* Source Citations */}
                          {msg.citations && msg.citations.length > 0 && (
                            <div className="message-citations">
                              {msg.citations.map((cite, i) => (
                                <button
                                  key={i}
                                  onClick={() => {
                                    setActiveTab("documents");
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
                          <span className="message-agent-name">
                            CSO Core Assistant
                          </span>
                          <div className="typing-box">
                            <span>Orchestrating sub-agents...</span>
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

              {/* ── CHAT INPUT COMPONENT (MOCKUP BOTTOM BOX) ── */}
              <div className="chat-input-bar">
                <div className="input-main-row">
                  <div className="input-wrapper">
                    <textarea
                      value={inputVal}
                      onChange={(e) => setInputVal(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handlePromptSubmit();
                        }
                      }}
                      placeholder="Ask AI or give instructions..."
                      rows={1}
                      className="textarea-input"
                    />
                  </div>
                </div>
                <div className="input-footer">
                  <button className="model-select-button">
                    <Layers size={14} style={{ color: '#9ca3af' }} />
                    Core Intelligence
                    <ChevronDown size={12} style={{ color: '#9ca3af' }} />
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
        )}

        {/* ── DOCUMENT LIBRARY TAB ── */}
        {activeTab === "documents" && (
          <div className="documents-tab-view">
            <header>
              <h1>Document Library</h1>
              <p>Grounding corpus for RAG semantic search and policy analysis</p>
            </header>

            {/* Drag & Drop Upload Zone */}
            <div 
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              className={`upload-dashed-zone ${dragActive ? "active" : ""}`}
            >
              {isUploading ? (
                <div className="upload-progress">
                  <Loader2 className="animate-spin text-blue-600 mb-3" size={36} />
                  <p className="bold-text">Extracting and Vectorizing...</p>
                  <p className="muted-text">Generating embeddings through OpenRouter</p>
                </div>
              ) : uploadSuccess ? (
                <div className="upload-success">
                  <div className="upload-success-icon">
                    <Check size={24} className="stroke-[3px]" />
                  </div>
                  <p className="success-title">Document Ingested Successfully!</p>
                  <p className="success-desc">Indexed for real-time strategic citation.</p>
                </div>
              ) : (
                <div className="upload-prompt-info">
                  <UploadCloud size={40} className="text-slate-400 mb-3" />
                  <p className="bold-text">Drag & drop your strategic PDFs here</p>
                  <p className="muted-text">Accepts PDF, DOCX, TXT, Markdown (Max 15MB)</p>
                  
                  <label className="select-file-label">
                    Select File
                    <input 
                      type="file" 
                      onChange={handleFileChange}
                      accept=".pdf,.docx,.txt,.md"
                      className="hidden" 
                    />
                  </label>
                </div>
              )}
            </div>

            {/* Document Library Table */}
            <div className="documents-table-wrapper">
              <div className="table-header-row">
                <span className="count">{documents.length} Files Loaded</span>
                <span className="subtitle">Source Attribution Database</span>
              </div>
              
              <div className="table-scroll">
                <table className="documents-table">
                  <thead>
                    <tr>
                      <th>Document Name</th>
                      <th>Source</th>
                      <th>Format</th>
                      <th>Chunks</th>
                      <th>Size</th>
                      <th>Ingested At</th>
                    </tr>
                  </thead>
                  <tbody>
                    {documents.map((doc) => (
                      <tr key={doc.id}>
                        <td className="doc-name">
                          <FileText size={14} className="text-slate-400 shrink-0" />
                          {doc.name}
                        </td>
                        <td>
                          <span className={`source-badge ${doc.source}`}>
                            {doc.source}
                          </span>
                        </td>
                        <td>
                          <span className="format-badge">{doc.kind}</span>
                        </td>
                        <td style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{doc.chunkCount}</td>
                        <td style={{ color: 'var(--text-muted)' }}>{(doc.characterCount / 1000).toFixed(1)}k chars</td>
                        <td style={{ color: 'var(--text-muted)' }}>
                          {new Date(doc.uploadedAt).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ── DAILY BRIEFING TAB ── */}
        {activeTab === "briefing" && (
          <div className="briefing-tab-view">
            <header className="briefing-header">
              <div>
                <h1>Daily Executive Briefing</h1>
                <p>Aggregated regulatory changes, market flows, and competitor SWOT indices</p>
              </div>
              <button 
                onClick={() => fetchBriefing()}
                disabled={isBriefingLoading}
                className="refresh-button"
              >
                {isBriefingLoading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                Refresh Briefing
              </button>
            </header>

            {isBriefingLoading && !briefing ? (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
                <Loader2 className="animate-spin text-blue-600 mb-3" size={36} />
                <p style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-secondary)' }}>Synthesizing Briefing Snapshot...</p>
              </div>
            ) : briefing ? (
              <div className="briefing-scroll">
                
                {/* ── KPI Numeric Strip ── */}
                <div className="kpi-grid">
                  {briefing.kpis.map((kpi, idx) => (
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
                      {briefing.critical.length > 0 ? (
                        briefing.critical.map((item, idx) => (
                          <div key={idx} className="briefing-alert-card critical">
                            <h4>{item.title}</h4>
                            <p>{item.summary}</p>
                            <span className="source">Source: {item.source}</span>
                          </div>
                        ))
                      ) : (
                        <p style={{ fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic', padding: '16px', textAlign: 'center' }}>No critical alerts flagged.</p>
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
                      {briefing.monitoring.length > 0 ? (
                        briefing.monitoring.map((item, idx) => (
                          <div key={idx} className="briefing-alert-card monitoring">
                            <h4>{item.title}</h4>
                            <p>{item.summary}</p>
                            <span className="source">Source: {item.source}</span>
                          </div>
                        ))
                      ) : (
                        <p style={{ fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic', padding: '16px', textAlign: 'center' }}>No monitoring signals flagged.</p>
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
                      {briefing.opportunities.length > 0 ? (
                        briefing.opportunities.map((item, idx) => (
                          <div key={idx} className="briefing-alert-card opportunity">
                            <h4>{item.title}</h4>
                            <p>{item.summary}</p>
                            <span className="source">Source: {item.source}</span>
                          </div>
                        ))
                      ) : (
                        <p style={{ fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic', padding: '16px', textAlign: 'center' }}>No strategic opportunities flagged.</p>
                      )}
                    </div>
                  </div>
                </div>

              </div>
            ) : (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic' }}>No briefing snapshot compiled.</p>
              </div>
            )}
          </div>
        )}

        {/* ── AGENT CONFIG SYSTEM TAB ── */}
        {activeTab === "config" && (
          <div className="config-tab-view">
            <header>
              <h1>System Configuration</h1>
              <p>Review system prompts and RACER framework configurations for sub-agents</p>
            </header>

            <div className="config-scroll">
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
                <div style={{ backgroundColor: '#ffffff', border: '1px solid var(--border-color)', borderRadius: '24px', padding: '32px', textAlign: 'center', fontStyle: 'italic', fontSize: '12px', color: 'var(--text-muted)' }}>
                  Loading agent system prompts from Hono registry...
                </div>
              )}
            </div>
          </div>
        )}

      </main>
    </div>
  );
}

// ── Fallback interface implementations in case search symbol is missing ──
function Search({ size, className }: { size: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="11" cy="11" r="8"></circle>
      <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
    </svg>
  );
}
