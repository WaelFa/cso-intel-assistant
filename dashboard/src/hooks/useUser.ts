import { useDashboard } from "../context/DashboardContext";

export function useUser() {
  const { userName, hasOnboarded, setUserName } = useDashboard();
  return { userName, hasOnboarded, setUserName };
}
