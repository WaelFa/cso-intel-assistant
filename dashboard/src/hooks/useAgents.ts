import { useDashboard } from "../context/DashboardContext";

export function useAgents() {
  const {
    agentsStatus,
    selectedAgentId,
    setSelectedAgentId,
    schedulerConfirmed,
    schedulerDeclined,
    handleConfirmMeeting,
    handleDeclineMeeting,
    animateSubAgents,
    resetAgentStatuses,
    updateAgentMetrics,
    systemPrompts,
  } = useDashboard();

  return {
    agentsStatus,
    selectedAgentId,
    setSelectedAgentId,
    schedulerConfirmed,
    schedulerDeclined,
    handleConfirmMeeting,
    handleDeclineMeeting,
    animateSubAgents,
    resetAgentStatuses,
    updateAgentMetrics,
    systemPrompts,
  };
}
