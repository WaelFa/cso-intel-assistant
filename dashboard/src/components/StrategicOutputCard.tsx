"use client";

import React, { useEffect } from "react";
import { FileDown, Presentation, RefreshCw, Loader2 } from "lucide-react";
import type { GeneratedPresentation } from "../context/DashboardContext";

interface StrategicOutputCardProps {
  presentations: GeneratedPresentation[];
  isPresentationLoading: boolean;
  freshPresentationIds: Set<string>;
  onMarkPresentationSeen: (id: string) => void;
  onRefresh: () => void;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatTimeAgo(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function StrategicOutputCard({
  presentations,
  isPresentationLoading,
  freshPresentationIds,
  onMarkPresentationSeen,
  onRefresh,
}: StrategicOutputCardProps) {
  const handleDownload = (pres: GeneratedPresentation) => {
    window.open(pres.downloadUrl, "_blank");
  };

  // Track which fresh deck just appeared so we can pulse the whole card
  // for a moment, then settle. The card glows whenever a deck in the
  // visible list is still in `freshPresentationIds`. The first deck in
  // the rendered list is the one most likely to be the new one (the
  // backend sorts by generatedAt desc), so we use that as the trigger.
  const topId = presentations[0]?.id;
  const isGlowing = topId ? freshPresentationIds.has(topId) : false;

  // Auto-dismiss the glow after ~2.4s so the card doesn't keep pulsing
  // forever on every page render. We still keep the slide-in animation
  // on the individual item (handled via CSS animation) — only the
  // panel-level glow is timed.
  useEffect(() => {
    if (!isGlowing || !topId) return;
    const t = window.setTimeout(() => {
      onMarkPresentationSeen(topId);
    }, 2400);
    return () => window.clearTimeout(t);
  }, [isGlowing, topId, onMarkPresentationSeen]);

  return (
    <div
      className={`strategic-output-panel${isGlowing ? " strategic-output-panel--fresh" : ""}`}
    >
      <div className="strategic-output-header">
        <div className="strategic-output-header-left">
          <Presentation size={13} className="text-amber-400" />
          <span>Generated Decks</span>
        </div>
        <button
          className="strategic-output-refresh-btn"
          onClick={(e) => {
            e.stopPropagation();
            onRefresh();
          }}
          disabled={isPresentationLoading}
          title="Refresh presentations"
        >
          {isPresentationLoading ? (
            <Loader2 size={12} className="animate-spin" />
          ) : (
            <RefreshCw size={12} />
          )}
        </button>
      </div>

      {presentations.length === 0 ? (
        <p className="strategic-output-empty">
          No presentations yet. Ask the agent to generate a deck via chat.
        </p>
      ) : (
        <div className="strategic-output-list">
          {presentations.slice(0, 3).map((pres) => {
            const isFresh = freshPresentationIds.has(pres.id);
            return (
              <button
                key={pres.id}
                className={`strategic-output-item${isFresh ? " strategic-output-item--fresh" : ""}`}
                onClick={(e) => {
                  e.stopPropagation();
                  // Dismiss the animation on click so re-clicking an
                  // already-known deck doesn't re-trigger the slide-in.
                  if (isFresh) onMarkPresentationSeen(pres.id);
                  handleDownload(pres);
                }}
                title={`Download ${pres.fileName}`}
              >
                <div className="strategic-output-item-info">
                  <span className="strategic-output-item-name">
                    {pres.fileName
                      .replace(/\.pptx$/, "")
                      .replace(/-pres-\d+-[a-z0-9]+$/, "")
                      .replace(/-/g, " ")}
                  </span>
                  <span className="strategic-output-item-meta">
                    {formatFileSize(pres.sizeBytes)} • {formatTimeAgo(pres.generatedAt)}
                  </span>
                </div>
                <FileDown size={13} className="strategic-output-download-icon" />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
