// ──────────────────────────────────────────────────────────────────
// Overnight Briefing Scheduler
//
// Registers a single in-process cron job that calls
// `prepareBriefing()` on the configured schedule. Exposes:
//
//   - startScheduler()        — boot: ensure today's snapshot exists
//                               and start the recurring cron.
//   - reconfigureScheduler()  — called by the settings PUT endpoint
//                               to re-bind the cron expression.
//   - stopScheduler()         — graceful shutdown (HMR / tests).
//   - runScheduledJob()       — exported so a manual "Run Now" button
//                               can trigger the same path the cron uses.
//
// Why an in-process scheduler rather than VoltAgent's cloud "cron"
// trigger: the project brief calls for the time to be changeable
// from the settings dashboard. In-process `node-cron` lets us
// re-register on settings change without leaving the app.
// ──────────────────────────────────────────────────────────────────

import { createPinoLogger } from "@voltagent/logger";
import cron, { type ScheduledTask } from "node-cron";
import {
	prepareBriefing,
	readPreparedBriefing,
} from "../services/briefing-preparer.js";
import { type AppSettings, readSettings } from "../services/settings-store.js";

const logger = createPinoLogger({
	name: "scheduler",
	level: "info",
}).child({ component: "scheduler" });

let currentTask: ScheduledTask | null = null;
let currentSettings: AppSettings | null = null;

// ── Boot-time recovery ───────────────────────────────────────────
//
// If the server starts after today's scheduled run was supposed to
// fire, we still want a snapshot to exist so the dashboard doesn't
// open with an empty panel. We only auto-prepare on boot if there
// is no snapshot for today yet.

export async function startScheduler(): Promise<void> {
	const settings = await readSettings();
	currentSettings = settings;
	logger.info(
		`[scheduler] Booting with cron="${settings.briefingCron}" timezone="${settings.briefingTimezone}"`,
	);

	// Boot recovery — only run if today's snapshot is missing.
	const today = new Date().toISOString().slice(0, 10);
	const existing = await readPreparedBriefing(today);
	if (!existing) {
		logger.info(
			`[scheduler] No prepared briefing for ${today} — running recovery preparation`,
		);
		runScheduledJob("boot-recovery").catch((err) => {
			logger.error(
				`[scheduler] Boot recovery failed: ${err instanceof Error ? err.message : String(err)}`,
			);
		});
	} else {
		logger.info(
			`[scheduler] Existing briefing for ${today} found (preparedAt=${existing.preparedAt}, live=${existing.isLive}) — no recovery needed`,
		);
	}

	startCron(settings);
}

function startCron(settings: AppSettings): void {
	stopCron();
	if (!cron.validate(settings.briefingCron)) {
		logger.error(
			`[scheduler] Invalid cron expression "${settings.briefingCron}" — scheduler NOT started. Fix data/settings.json.`,
		);
		return;
	}
	currentTask = cron.schedule(
		settings.briefingCron,
		() => {
			runScheduledJob("overnight-cron").catch((err) => {
				logger.error(
					`[scheduler] Scheduled run failed: ${err instanceof Error ? err.message : String(err)}`,
				);
			});
		},
		{ timezone: settings.briefingTimezone },
	);
	logger.info(
		`[scheduler] Cron registered: "${settings.briefingCron}" (${settings.briefingTimezone})`,
	);
}

function stopCron(): void {
	if (currentTask) {
		currentTask.stop();
		currentTask = null;
	}
}

// ── Reconfigure (called by the settings PUT endpoint) ───────────

export async function reconfigureScheduler(
	newSettings: Partial<AppSettings>,
): Promise<AppSettings> {
	const merged: AppSettings = {
		...DEFAULT_SETTINGS_HYDRATED,
		...currentSettings,
		...newSettings,
	} as AppSettings;
	currentSettings = merged;
	if (cron.validate(merged.briefingCron)) {
		startCron(merged);
	} else {
		logger.error(
			`[scheduler] Reconfigure: invalid cron "${merged.briefingCron}" — cron NOT re-registered`,
		);
	}
	return merged;
}

// Cached defaults so reconfigureScheduler can hydrate if currentSettings
// has not been populated yet (e.g. PUT arriving before boot).
const DEFAULT_SETTINGS_HYDRATED: AppSettings = {
	briefingCron: "40 7 * * *",
	briefingTimezone: "UTC",
};

// ── Manual / scheduled run ───────────────────────────────────────

let inFlight: Promise<void> | null = null;

export async function runScheduledJob(
	preparedBy:
		| "overnight-cron"
		| "manual-refresh"
		| "boot-recovery" = "manual-refresh",
): Promise<void> {
	// Serialise — if a run is already in progress, await it. This
	// prevents a manual refresh button from racing a scheduled tick.
	if (inFlight) {
		logger.info("[scheduler] Run already in progress — awaiting it");
		return inFlight;
	}
	inFlight = (async () => {
		try {
			const record = await prepareBriefing({ preparedBy });
			logger.info(
				`[scheduler] ${preparedBy} run complete: live=${record.isLive} (${record.executedMs}ms)`,
			);
		} finally {
			inFlight = null;
		}
	})();
	return inFlight;
}

// ── Shutdown ─────────────────────────────────────────────────────

export function stopScheduler(): void {
	stopCron();
	logger.info("[scheduler] Stopped");
}
