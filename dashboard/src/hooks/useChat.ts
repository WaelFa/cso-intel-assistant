import { useDashboard } from "../context/DashboardContext";

export function useChat() {
  const {
    messages,
    setMessages,
    inputVal,
    setInputVal,
    isChatting,
    setIsChatting,
    isGenerating,
    activeAgent,
    focusedAgentId,
    setFocusedAgentId,
    activeToolStatus,
    conversationId,
    reasoningEffort,
    setReasoningEffort,
    handlePromptSubmit,
    handleStopGeneration,
    handleClearChat,
    executePillAction,
  } = useDashboard();

  return {
    messages,
    setMessages,
    inputVal,
    setInputVal,
    isChatting,
    setIsChatting,
    isGenerating,
    activeAgent,
    focusedAgentId,
    setFocusedAgentId,
    activeToolStatus,
    conversationId,
    reasoningEffort,
    setReasoningEffort,
    handlePromptSubmit,
    handleStopGeneration,
    handleClearChat,
    executePillAction,
  };
}
