"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  Zap,
  BarChart2,
  Globe,
  PenTool,
  GraduationCap,
  Sparkles,
  Trash2,
  X,
  Square,
  BookOpen,
  Calendar,
  Settings,
  Layout,
} from "lucide-react";
import { useChat } from "../hooks/useChat";

type Command = {
  id: string;
  label: string;
  description?: string;
  group: "Ask Jarvis" | "Navigate" | "Session";
  icon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
  // We capture the action at definition time so the palette stays
  // a pure presentational component.
  run: () => void;
};

export default function CommandPalette() {
  const router = useRouter();
  const {
    setIsChatting,
    handlePromptSubmit,
    handleStopGeneration,
    handleClearChat,
    isGenerating,
  } = useChat();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLUListElement | null>(null);

  const askJarvis = useCallback(
    (prompt: string) => {
      setIsChatting(true);
      handlePromptSubmit(prompt);
    },
    [handlePromptSubmit, setIsChatting],
  );

  const commands: Command[] = useMemo(
    () => [
      {
        id: "quick-brief",
        label: "Quick brief",
        description: "30-second snapshot of today's critical alerts",
        group: "Ask Jarvis",
        icon: Zap,
        run: () => askJarvis("Give me a fast update"),
      },
      {
        id: "deep-dive",
        label: "Deep dive",
        description: "Multi-agent synthesis across all intelligence streams",
        group: "Ask Jarvis",
        icon: BarChart2,
        run: () => askJarvis("Run an in-depth strategic analysis"),
      },
      {
        id: "market-intel",
        label: "Market intel",
        description: "Capital flows, FDI, investor sentiment",
        group: "Ask Jarvis",
        icon: Sparkles,
        run: () => askJarvis("What's the latest market intelligence?"),
      },
      {
        id: "regulatory",
        label: "Regulatory watch",
        description: "Policy and compliance horizon scan",
        group: "Ask Jarvis",
        icon: Globe,
        run: () => askJarvis("Any new regulatory updates I should know about?"),
      },
      {
        id: "competitors",
        label: "Competitor scan",
        description: "Benchmark against peer financial centres",
        group: "Ask Jarvis",
        icon: PenTool,
        run: () => askJarvis("How do we compare against our peer centres?"),
      },
      {
        id: "briefing",
        label: "Generate daily briefing",
        description: "Pre-prepared morning intelligence snapshot",
        group: "Ask Jarvis",
        icon: GraduationCap,
        run: () => askJarvis("Generate today's daily briefing"),
      },
      {
        id: "nav-console",
        label: "Console",
        description: "Main chat workspace",
        group: "Navigate",
        icon: Layout,
        run: () => router.push("/"),
      },
      {
        id: "nav-docs",
        label: "Document Library",
        description: "Uploaded strategy docs, minutes, and reports",
        group: "Navigate",
        icon: BookOpen,
        run: () => router.push("/documents"),
      },
      {
        id: "nav-briefing",
        label: "Daily Briefings",
        description: "Archive of prepared briefings",
        group: "Navigate",
        icon: Calendar,
        run: () => router.push("/daily-briefing"),
      },
      {
        id: "nav-settings",
        label: "Settings",
        description: "Scheduler and agent configuration",
        group: "Navigate",
        icon: Settings,
        run: () => router.push("/config"),
      },
      {
        id: "session-clear",
        label: "Clear current chat",
        description: "Start a fresh conversation with Jarvis",
        group: "Session",
        icon: Trash2,
        run: () => handleClearChat(),
      },
      {
        id: "session-stop",
        label: "Stop Jarvis",
        description: "Halt the current generation",
        group: "Session",
        icon: Square,
        run: () => handleStopGeneration(),
      },
    ],
    [askJarvis, handleClearChat, handleStopGeneration, router],
  );

  // Filter on substring match against label + description (case
  // insensitive). Empty query shows everything.
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter(
      (c) =>
        c.label.toLowerCase().includes(q) ||
        (c.description?.toLowerCase().includes(q) ?? false) ||
        c.group.toLowerCase().includes(q),
    );
  }, [commands, query]);

  // Reset the highlighted row whenever the filtered list changes.
  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  // Global ⌘K / Ctrl+K to open, Esc to close.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const isModK = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k";
      if (isModK) {
        e.preventDefault();
        setOpen((v) => !v);
        return;
      }
      if (e.key === "Escape" && open) {
        e.preventDefault();
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // Focus the input on open + reset state.
  useEffect(() => {
    if (open) {
      setQuery("");
      setActiveIndex(0);
      // Defer to next tick so the input is in the DOM.
      const t = window.setTimeout(() => inputRef.current?.focus(), 10);
      return () => window.clearTimeout(t);
    }
    return undefined;
  }, [open]);

  // Keep the highlighted row in view when the user arrow-keys through.
  useEffect(() => {
    if (!open) return;
    const el = listRef.current?.querySelector<HTMLElement>(
      `[data-cmd-index="${activeIndex}"]`,
    );
    el?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, open]);

  if (!open) return null;

  const runCommand = (cmd: Command) => {
    cmd.run();
    setOpen(false);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (filtered.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % filtered.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => (i - 1 + filtered.length) % filtered.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const cmd = filtered[activeIndex];
      if (cmd) runCommand(cmd);
    }
  };

  // Group results by section, preserving original order.
  const grouped = filtered.reduce<Record<string, Command[]>>((acc, c) => {
    (acc[c.group] ||= []).push(c);
    return acc;
  }, {});

  return (
    <div
      className="command-palette-overlay"
      onClick={() => setOpen(false)}
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
    >
      <div
        className="command-palette shadow-premium-box"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="command-palette-input-row">
          <Search size={16} className="command-palette-search-icon" />
          <input
            ref={inputRef}
            className="command-palette-input"
            placeholder="Ask Jarvis or jump to a page…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            spellCheck={false}
            autoComplete="off"
          />
          <button
            type="button"
            className="command-palette-close"
            onClick={() => setOpen(false)}
            aria-label="Close command palette"
          >
            <X size={14} />
          </button>
        </div>

        {filtered.length === 0 ? (
          <div className="command-palette-empty">
            No matches for &ldquo;{query}&rdquo;
          </div>
        ) : (
          <ul className="command-palette-list" ref={listRef} role="listbox">
            {Object.entries(grouped).map(([group, items]) => (
              <li key={group} className="command-palette-group">
                <div className="command-palette-group-label">{group}</div>
                <ul className="command-palette-group-items">
                  {items.map((cmd) => {
                    const globalIndex = filtered.indexOf(cmd);
                    const Icon = cmd.icon;
                    const isActive = globalIndex === activeIndex;
                    return (
                      <li
                        key={cmd.id}
                        data-cmd-index={globalIndex}
                        role="option"
                        aria-selected={isActive}
                        className={`command-palette-item ${
                          isActive ? "active" : ""
                        }`}
                        onMouseEnter={() => setActiveIndex(globalIndex)}
                        onClick={() => runCommand(cmd)}
                      >
                        <span className="command-palette-item-icon">
                          <Icon size={14} strokeWidth={2} />
                        </span>
                        <span className="command-palette-item-text">
                          <span className="command-palette-item-label">
                            {cmd.label}
                          </span>
                          {cmd.description && (
                            <span className="command-palette-item-desc">
                              {cmd.description}
                            </span>
                          )}
                        </span>
                        {cmd.id === "session-stop" && !isGenerating && (
                          <span className="command-palette-item-hint">
                            idle
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </li>
            ))}
          </ul>
        )}

        <div className="command-palette-footer">
          <span>
            <kbd>↑↓</kbd> navigate
          </span>
          <span>
            <kbd>↵</kbd> open
          </span>
          <span>
            <kbd>esc</kbd> close
          </span>
        </div>
      </div>
    </div>
  );
}
