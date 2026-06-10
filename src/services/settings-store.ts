// ──────────────────────────────────────────────────────────────────
// Settings Store
//
// Persists user-tunable runtime configuration to `data/settings.json`.
// First-class setting today: the cron expression that schedules the
// overnight intelligence briefing. The store is intentionally tiny —
// it returns validated values or default fallbacks, never throws on
// missing file, and emits structured logs on every read/write so the
// dashboard can confirm when its PUT actually took effect.
//
// Concurrency: a single in-process write queue guarantees that two
// simultaneous PUTs cannot interleave and corrupt the file. There is
// no cross-process locking (this is a single-process server).
// ──────────────────────────────────────────────────────────────────

import { promises as fs } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createPinoLogger } from "@voltagent/logger";
import { z } from "zod";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const DATA_ROOT = process.env.DATA_DIR ?? join(__dirname, "..", "..", "data");
const SETTINGS_PATH = join(DATA_ROOT, "settings.json");

const logger = createPinoLogger({
	name: "settings-store",
	level: "info",
}).child({ component: "settings-store" });

// ── Schema ────────────────────────────────────────────────────────

// node-cron cron expression: 5 fields (minute hour dom month dow).
// Validated loosely here — node-cron will throw at schedule time if
// the expression is nonsense, which is logged and the previous good
// schedule is kept.
const cronExpressionSchema = z
	.string()
	.min(1)
	.max(100)
	.refine((expr) => /^[0-9*\/\-,]+(\s+[0-9*\/\-,]+){4}$/.test(expr.trim()), {
		message:
			"cronExpression must be a 5-field cron string (minute hour dom month dow)",
	});

const timezoneSchema = z
	.string()
	.min(1)
	.max(64)
	.refine((tz) => {
		try {
			// Throws if the timezone is not recognised by the runtime.
			new Intl.DateTimeFormat("en-US", { timeZone: tz });
			return true;
		} catch {
			return false;
		}
	}, "timezone must be a valid IANA tz identifier (e.g. 'Asia/Dubai')");

const settingsSchema = z.object({
	briefingCron: cronExpressionSchema,
	briefingTimezone: timezoneSchema,
	userName: z.string().min(1).max(64).optional(),
	agentName: z.string().min(1).max(64).optional(),
	updatedAt: z.string().optional(),
});

export type AppSettings = z.infer<typeof settingsSchema>;

export const DEFAULT_SETTINGS: AppSettings = {
	// 7:40 AM, every day, in the default runtime timezone.
	briefingCron: "40 7 * * *",
	briefingTimezone: "UTC",
	userName: "Chief Strategy Officer",
	agentName: "Jarvis",
};

// ── Read / Write ──────────────────────────────────────────────────

let writeQueue: Promise<void> = Promise.resolve();

export async function readSettings(): Promise<AppSettings> {
	try {
		const raw = await fs.readFile(SETTINGS_PATH, "utf-8");
		const parsed = JSON.parse(raw);
		const result = settingsSchema.safeParse(parsed);
		if (!result.success) {
			logger.warn(
				`[settings] data/settings.json failed validation — using defaults: ${result.error.issues.map((i) => i.message).join("; ")}`,
			);
			return { ...DEFAULT_SETTINGS };
		}
		return result.data;
	} catch (err) {
		if ((err as NodeJS.ErrnoException).code === "ENOENT") {
			return { ...DEFAULT_SETTINGS };
		}
		logger.error(
			`[settings] Failed to read settings: ${err instanceof Error ? err.message : String(err)} — using defaults`,
		);
		return { ...DEFAULT_SETTINGS };
	}
}

export interface UpdateSettingsInput {
	briefingCron?: string;
	briefingTimezone?: string;
	userName?: string;
	agentName?: string;
}

export async function updateSettings(
	partial: UpdateSettingsInput,
): Promise<AppSettings> {
	// Chain writes through a serial queue so concurrent callers cannot
	// race on the file.
	const next = writeQueue.then(async () => {
		const current = await readSettings();
		const cleanPartial = Object.fromEntries(
			Object.entries(partial).filter(([_, v]) => v !== undefined),
		);
		const merged = {
			...current,
			...cleanPartial,
			updatedAt: new Date().toISOString(),
		};
		const result = settingsSchema.parse(merged); // throws on invalid
		await fs.mkdir(dirname(SETTINGS_PATH), { recursive: true });
		const tmpPath = `${SETTINGS_PATH}.tmp-${process.pid}-${Date.now()}`;
		await fs.writeFile(tmpPath, JSON.stringify(result, null, 2), "utf-8");
		await fs.rename(tmpPath, SETTINGS_PATH);
		logger.info(
			`[settings] Updated settings: cron="${result.briefingCron}" timezone="${result.briefingTimezone}"`,
		);
		return result;
	});
	writeQueue = next.then(
		() => undefined,
		() => undefined,
	);
	return next;
}
