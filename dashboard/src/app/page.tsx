"use client";

import React from "react";
import AgentStatusPanel from "../components/AgentStatusPanel";
import ChatPanel from "../components/ChatPanel";
import AgentDrawer from "../components/AgentDrawer";

export default function ConsolePage() {
  return (
    <>
      <AgentStatusPanel />
      <main className="main-container">
        <ChatPanel />
      </main>
      <AgentDrawer />
    </>
  );
}
