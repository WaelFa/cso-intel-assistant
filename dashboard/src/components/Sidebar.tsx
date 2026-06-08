"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Layout,
  BookOpen,
  Calendar,
  Settings,
  Sparkles,
} from "lucide-react";

export default function Sidebar() {
  const pathname = usePathname();

  const navigationItems = [
    { href: "/", icon: Layout, label: "Console" },
    { href: "/documents", icon: BookOpen, label: "Document\nLibrary" },
    { href: "/daily-briefing", icon: Calendar, label: "Daily\nBriefings" },
    { href: "/config", icon: Settings, label: "System\nPrompts" },
  ];

  return (
    <aside className="cso-sidebar">
      <div className="logo-container">
        {/* Logo Cluster */}
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

        {/* Navigation Items */}
        <nav className="nav-container">
          {navigationItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link key={item.href} href={item.href} className={`nav-button ${isActive ? "active" : ""}`}>
                <Icon size={18} strokeWidth={isActive ? 2.5 : 1.8} />
                <span className="nav-label">{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Bottom Profile and Settings */}
      <div className="profile-avatar">
        <button
          style={{
            border: "none",
            background: "none",
            cursor: "pointer",
            color: "#9ca3af",
          }}
        >
          <Sparkles size={18} />
        </button>

        {/* User Profile Avatar */}
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
