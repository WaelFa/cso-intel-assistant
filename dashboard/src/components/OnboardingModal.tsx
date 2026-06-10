"use client";

import React, { useEffect, useRef, useState } from "react";
import { Sparkles, ArrowRight, Loader2, AlertCircle } from "lucide-react";
import { useUser } from "../hooks/useUser";
import { useDashboard } from "../context/DashboardContext";

const CAPABILITIES = [
  { icon: "📊", label: "Daily intelligence briefings" },
  { icon: "🛡", label: "Regulatory horizon scanning" },
  { icon: "⚔️", label: "Peer-centre benchmarking" },
  { icon: "📄", label: "Board papers & decks, on demand" },
];

export default function OnboardingModal() {
  const { hasOnboarded, setUserName } = useUser();
  const { backendStatus, checkBackendHealth } = useDashboard();
  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [agentName, setAgentName] = useState("Jarvis");
  const [visible, setVisible] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const agentInputRef = useRef<HTMLInputElement | null>(null);

  // Reveal with a small delay so the page paints first and the modal
  // doesn't feel like a flash. The 250ms also lets the orb settle.
  useEffect(() => {
    if (!hasOnboarded) {
      const t = window.setTimeout(() => setVisible(true), 250);
      return () => window.clearTimeout(t);
    }
    return undefined;
  }, [hasOnboarded]);

  useEffect(() => {
    if (visible) {
      if (step === 1) {
        inputRef.current?.focus();
      } else if (step === 2) {
        agentInputRef.current?.focus();
      }
    }
  }, [visible, step]);

  if (hasOnboarded) return null;

  const handleNextStep = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!name.trim()) return;
    setStep(2);
  };

  const handlePrevStep = () => {
    setStep(1);
    setError(null);
  };

  const submit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmedUser = name.trim();
    const trimmedAgent = agentName.trim() || "Jarvis";
    if (!trimmedUser) return;
    setIsSaving(true);
    setError(null);
    try {
      const ok = await setUserName(trimmedUser, trimmedAgent);
      if (!ok) {
        setError(
          "Couldn't save your name to the backend. We'll keep it locally — try again from Settings.",
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error");
    } finally {
      setIsSaving(false);
    }
  };

  const backendReady = backendStatus === "online" || backendStatus === "waking";
  const backendLabel =
    backendStatus === "waking"
      ? "Waking up the backend…"
      : backendStatus === "checking"
        ? "Connecting to backend…"
        : backendStatus === "error"
          ? "Backend unreachable — saved locally only"
          : null;

  return (
    <div
      className={`onboarding-overlay ${visible ? "open" : ""}`}
      aria-hidden={!visible}
    >
      <div className="onboarding-card shadow-premium-box">
        <div className="onboarding-card-glow" />

        <div className="onboarding-icon">
          <Sparkles size={22} strokeWidth={2} />
        </div>

        {step === 1 ? (
          <>
            <h2 className="onboarding-title">Welcome to Jarvis</h2>
            <p className="onboarding-subtitle">
              Your personal strategic intelligence assistant. What should I call you?
            </p>

            <form onSubmit={handleNextStep} className="onboarding-form">
              <input
                ref={inputRef}
                type="text"
                className="onboarding-input"
                placeholder="Your first name"
                value={name}
                maxLength={40}
                onChange={(e) => setName(e.target.value)}
                autoComplete="given-name"
                disabled={isSaving}
              />
              <button
                type="submit"
                className="onboarding-submit"
                disabled={!name.trim() || isSaving}
                aria-label="Continue"
              >
                {isSaving ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <ArrowRight size={16} strokeWidth={2.5} />
                )}
              </button>
            </form>
          </>
        ) : (
          <>
            <h2 className="onboarding-title">Name Your Assistant</h2>
            <p className="onboarding-subtitle">
              Choose a name for your strategic intelligence assistant (defaults to Jarvis).
            </p>

            {backendLabel ? (
              <div className="onboarding-backend-hint" role="status" aria-live="polite">
                <Loader2 size={12} className="animate-spin" />
                <span>{backendLabel}</span>
                {backendStatus === "error" ? (
                  <button
                    type="button"
                    className="onboarding-backend-retry"
                    onClick={() => {
                      void checkBackendHealth();
                    }}
                  >
                    Retry
                  </button>
                ) : null}
              </div>
            ) : null}

            <form onSubmit={submit} className="onboarding-form">
              <input
                ref={agentInputRef}
                type="text"
                className="onboarding-input"
                placeholder="Assistant name (e.g. Jarvis)"
                value={agentName}
                maxLength={40}
                onChange={(e) => setAgentName(e.target.value)}
                disabled={isSaving}
              />
              <button
                type="submit"
                className="onboarding-submit"
                disabled={!agentName.trim() || isSaving || !backendReady}
                aria-label="Finish"
              >
                {isSaving ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <ArrowRight size={16} strokeWidth={2.5} />
                )}
              </button>
            </form>

            {error ? (
              <div className="onboarding-error" role="alert">
                <AlertCircle size={12} />
                <span>{error}</span>
              </div>
            ) : null}

            <button
              type="button"
              onClick={handlePrevStep}
              disabled={isSaving}
              style={{
                background: "none",
                border: "none",
                color: "var(--text-muted)",
                fontSize: "12px",
                cursor: isSaving ? "not-allowed" : "pointer",
                marginTop: "-8px",
                marginBottom: "16px",
                textDecoration: "underline",
                opacity: isSaving ? 0.5 : 1,
              }}
            >
              Go Back
            </button>
          </>
        )}

        <div className="onboarding-divider">
          <span>What Jarvis can do</span>
        </div>

        <ul className="onboarding-capabilities">
          {CAPABILITIES.map((c) => (
            <li key={c.label} className="onboarding-capability">
              <span className="onboarding-capability-icon" aria-hidden="true">
                {c.icon}
              </span>
              <span>{c.label}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

