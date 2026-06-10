"use client";

import React from "react";
import { FileDown, Presentation, RefreshCw, Loader2 } from "lucide-react";
import type { GeneratedPresentation } from "../context/DashboardContext";

interface StrategicOutputCardProps {
  presentations: GeneratedPresentation[];
  isPresentationLoading: boolean;
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
  onRefresh,
}: StrategicOutputCardProps) {
  const handleDownload = (pres: GeneratedPresentation) => {
    window.open(pres.downloadUrl, "_blank");
  };

  return (
    <div className="strategic-output-panel">
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
          {presentations.slice(0, 3).map((pres) => (
            <button
              key={pres.id}
              className="strategic-output-item"
              onClick={(e) => {
                e.stopPropagation();
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
          ))}
        </div>
      )}
    </div>
  );
}
