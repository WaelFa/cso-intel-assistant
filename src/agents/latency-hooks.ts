// ──────────────────────────────────────────────────────────────────
// Latency instrumentation — per-step / per-tool timing logs.
//
// Emits one log line per:
//   - Agent operation start (model id, input length, conversation id)
//   - Agent step finish (step type, latency, prompt/completion tokens,
//     reasoning tokens, model id)
//   - Tool start / end (tool name, latency, agent that owns it)
//   - Handoff start / complete (which sub-agent was delegated to)
//
// The output lands in the existing Pino logger (`cso-intel-assistant`
// logger in src/index.ts), which already goes to stdout in dev and
// to Railway's `railway logs` in production. No new destination —
// grep `[latency]` to filter.
//
// Why this is its own file: every agent (supervisor + 4 sub-agents)
// needs the same hook set, and we want the start-time for each
// operation captured in a closure that's keyed by `operationId` so
// the onStart/onStepFinish/onEnd pairings match up.
//
// Turn this off by setting LATENCY_INSTRUMENT=0 in .env, or by
// removing the `hooks:` field from createSupervisorAgent in
// src/agents/agents.ts.
// ──────────────────────────────────────────────────────────────────

import type { Agent, AgentHooks } from "@voltagent/core";
import type { Logger } from "@voltagent/logger";

type Timer = { startedAt: number };
type OpState = {
	agentName: string;
	modelId: string;
	conversationId?: string;
	startedAt: number;
	stepIndex: number;
	toolTimers: Map<string, Timer>;
};

const ENABLED = process.env.LATENCY_INSTRUMENT !== "0";

/**
 * Build an AgentHooks set for one agent. Pass the same logger the
 * VoltAgent app uses so all latency logs are tagged with the same
 * `name` and inherit the same log level.
 *
 * The returned hooks close over a per-operation Map keyed by
 * `operationId` so concurrent requests don't clobber each other's
 * timers.
 */
export function createLatencyHooks(logger: Logger): AgentHooks {
	// Per-operation state. VoltAgent's `onStart` gives us an
	// `operationId` we can use as the key, and `onEnd` lets us
	// garbage-collect the entry when the operation finishes.
	const states = new Map<string, OpState>();

	// Helper: pull model id off the agent. Falls back to
	// "(unknown)" if the agent doesn't expose one (shouldn't
	// happen, but defensive).
	const modelIdFor = (agent: Agent): string => {
		try {
			// getModelName() returns the resolved model id string
			// for the OpenRouter provider, e.g. "openai/gpt-4o-mini".
			return agent.getModelName();
		} catch {
			return "(unknown)";
		}
	};

	// Helper: human-readable delta in ms.
	const ms = (delta: number): string =>
		delta < 1000 ? `${delta.toFixed(0)}ms` : `${(delta / 1000).toFixed(2)}s`;

	return {
		onStart: ({ agent, context }) => {
			if (!ENABLED) return;
			const state: OpState = {
				agentName: agent.name,
				modelId: modelIdFor(agent),
				conversationId: context.conversationId,
				startedAt: Date.now(),
				stepIndex: 0,
				toolTimers: new Map(),
			};
			states.set(context.operationId, state);
			logger.info(
				`[latency] ▶ op-start agent=${state.agentName} model=${state.modelId} ` +
					`conv=${state.conversationId ?? "-"}`,
				{
					tag: "latency",
					event: "op-start",
					operationId: context.operationId,
					agent: state.agentName,
					model: state.modelId,
					conversationId: state.conversationId,
				},
			);
		},

		onStepFinish: ({ agent, step, context }) => {
			if (!ENABLED) return;
			const state = states.get(context.operationId);
			if (!state) return;
			state.stepIndex += 1;
			const stepMs = Date.now() - state.startedAt;
			const usage = (step as { usage?: Record<string, unknown> })?.usage;
			const usageOut = usage
				? {
						promptTokens: usage.promptTokens,
						completionTokens: usage.completionTokens,
						totalTokens: usage.totalTokens,
						reasoningTokens:
							(usage as { reasoningTokens?: number }).reasoningTokens ?? null,
						cachedInputTokens:
							(usage as { cachedInputTokens?: number }).cachedInputTokens ??
							null,
					}
				: null;
			const usagePart = usageOut
				? `tokens(in=${usageOut.promptTokens ?? "?"} out=${usageOut.completionTokens ?? "?"} reason=${usageOut.reasoningTokens ?? "?"} cached=${usageOut.cachedInputTokens ?? "?"})`
				: "tokens=-";
			logger.info(
				`[latency] ✓ step #${state.stepIndex} agent=${agent.name} type=${step.type} elapsed=${ms(stepMs)} ${usagePart}`,
				{
					tag: "latency",
					event: "step-finish",
					operationId: context.operationId,
					agent: agent.name,
					model: state.modelId,
					step: state.stepIndex,
					stepType: step.type,
					elapsed: ms(stepMs),
					usage: usageOut,
				},
			);
		},

		onEnd: ({ agent, context, error, output }) => {
			if (!ENABLED) return;
			const state = states.get(context.operationId);
			const totalMs = Date.now() - (state?.startedAt ?? Date.now());
			const status = error ? "error" : "ok";
			const errPart = error ? ` err=${error.message}` : "";
			logger.info(
				`[latency] ⏹ op-end agent=${agent.name} steps=${state?.stepIndex ?? 0} total=${ms(totalMs)} status=${status}${errPart}`,
				{
					tag: "latency",
					event: "op-end",
					operationId: context.operationId,
					agent: agent.name,
					model: state?.modelId,
					steps: state?.stepIndex ?? 0,
					totalElapsed: ms(totalMs),
					status,
					error: error?.message,
					outputBytes: output ? JSON.stringify(output).length : 0,
				},
			);
			states.delete(context.operationId);
		},

		onToolStart: ({ agent, tool, context, options }) => {
			if (!ENABLED) return;
			const state = states.get(context.operationId);
			if (!state) return;
			const toolName = tool?.name ?? "(anon)";
			const timerId = options?.toolContext?.callId ?? toolName;
			state.toolTimers.set(timerId, { startedAt: Date.now() });
			logger.info(
				`[latency]   → tool-start agent=${agent.name} tool=${toolName}`,
				{
					tag: "latency",
					event: "tool-start",
					operationId: context.operationId,
					agent: agent.name,
					tool: toolName,
					toolCallId: options?.toolContext?.callId,
				},
			);
		},

		onToolEnd: ({ agent, tool, context, error, options }) => {
			if (!ENABLED) return;
			const state = states.get(context.operationId);
			if (!state) return;
			const toolName = tool?.name ?? "(anon)";
			const timerId = options?.toolContext?.callId ?? toolName;
			const timer = state.toolTimers.get(timerId);
			const elapsed = timer ? Date.now() - timer.startedAt : -1;
			state.toolTimers.delete(timerId);
			const tErr = error ? ` err=${error.message}` : "";
			logger.info(
				`[latency]   ← tool-end agent=${agent.name} tool=${toolName} elapsed=${ms(elapsed)} status=${error ? "error" : "ok"}${tErr}`,
				{
					tag: "latency",
					event: "tool-end",
					operationId: context.operationId,
					agent: agent.name,
					tool: toolName,
					elapsed: ms(elapsed),
					status: error ? "error" : "ok",
					toolCallId: options?.toolContext?.callId,
				},
			);
			return undefined;
		},

		onHandoff: ({ agent, sourceAgent }) => {
			if (!ENABLED) return;
			logger.info(`[latency] ⇄ handoff ${sourceAgent.name} → ${agent.name}`, {
				tag: "latency",
				event: "handoff",
				from: sourceAgent.name,
				to: agent.name,
			});
		},

		onHandoffComplete: ({ agent, sourceAgent, context, result }) => {
			if (!ENABLED) return;
			logger.info(
				`[latency] ⇄ handoff-complete ${sourceAgent.name} → ${agent.name} ` +
					`(${typeof result === "string" ? `${result.length} chars` : "non-string"})`,
				{
					tag: "latency",
					event: "handoff-complete",
					from: sourceAgent.name,
					to: agent.name,
					resultBytes: typeof result === "string" ? result.length : 0,
				},
			);
		},
	};
}
