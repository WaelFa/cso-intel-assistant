"use client";

import React from "react";
import { Calendar, Clock, Users, CheckSquare, Check, X } from "lucide-react";

interface SchedulerCardProps {
  schedulerConfirmed: boolean;
  schedulerDeclined: boolean;
  onConfirm: () => void;
  onDecline: () => void;
}

export default function SchedulerCard({
  schedulerConfirmed,
  schedulerDeclined,
  onConfirm,
  onDecline,
}: SchedulerCardProps) {
  return (
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
              onClick={onConfirm}
              className="confirm-button shadow-sm"
            >
              Confirm
            </button>
            <button
              onClick={onDecline}
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
  );
}
