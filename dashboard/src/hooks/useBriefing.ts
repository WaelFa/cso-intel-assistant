import { useDashboard } from "../context/DashboardContext";

export function useBriefing() {
  const {
    briefing,
    isBriefingLoading,
    briefingFilter,
    fetchBriefing,
    handleBriefingFilterChange,
  } = useDashboard();

  return {
    briefing,
    isBriefingLoading,
    briefingFilter,
    fetchBriefing,
    handleBriefingFilterChange,
  };
}
