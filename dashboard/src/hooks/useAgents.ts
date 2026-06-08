import { useDashboard } from "../context/DashboardContext";

export function useAgents() {
  const {
    agentsStatus,
    selectedAgentId,
    setSelectedAgentId,
    presentations,
    isPresentationLoading,
    fetchPresentations,
    animateSubAgents,
    resetAgentStatuses,
    updateAgentMetrics,
    systemPrompts,
  } = useDashboard();

  return {
    agentsStatus,
    selectedAgentId,
    setSelectedAgentId,
    presentations,
    isPresentationLoading,
    fetchPresentations,
    animateSubAgents,
    resetAgentStatuses,
    updateAgentMetrics,
    systemPrompts,
  };
}
