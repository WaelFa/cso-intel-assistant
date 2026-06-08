"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Layout, BookOpen, Calendar, Settings, Sparkles, Bell } from "lucide-react";
import { useDashboard } from "../context/DashboardContext";

export default function Sidebar() {
  const pathname = usePathname();
  const { hasUnseenBriefing, markBriefingSeen } = useDashboard();

  const navigationItems = [
    { href: "/", icon: Layout, label: "Console" },
    { href: "/documents", icon: BookOpen, label: "Document\nLibrary" },
    { href: "/daily-briefing", icon: Calendar, label: "Daily\nBriefings" },
    { href: "/config", icon: Settings, label: "Settings" },
  ];

  return (
    <aside className="cso-sidebar">
      <div className="logo-container">
        <Link href="/">
          <div style={{ cursor: "pointer" }}>
            <svg
              width="32"
              height="32"
              viewBox="0 0 32 32"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <circle cx="10" cy="12" r="6" fill="#3b82f6" />
              <circle cx="22" cy="10" r="5" fill="#60a5fa" />
              <circle cx="18" cy="22" r="7" fill="#2563eb" />
            </svg>
          </div>
        </Link>

        <nav className="nav-container">
          {navigationItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            // Only the Daily Briefings entry has a notification badge
            const showBell = item.href === "/daily-briefing" && hasUnseenBriefing;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`nav-button ${isActive ? "active" : ""}`}
                onClick={() => {
                  if (item.href === "/daily-briefing") {
                    markBriefingSeen();
                  }
                }}
                aria-label={showBell ? `${item.label} (unread briefing available)` : item.label}
                title={showBell ? "New briefing available" : undefined}
              >
                <span className="nav-icon-wrap">
                  <Icon size={18} strokeWidth={isActive ? 2.5 : 1.8} />
                  {showBell ? (
                    <span className="nav-badge" aria-hidden="true">
                      <Bell size={9} strokeWidth={2.5} />
                    </span>
                  ) : null}
                </span>
                <span className="nav-label">{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="profile-avatar">
        <div
          className="avatar-circle"
          style={{
            backgroundColor: "#1e293b",
            color: "#ffffff",
            border: "2px solid #334155",
            fontSize: "11px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          N
        </div>
      </div>
    </aside>
  );
}
