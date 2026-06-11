import { promises as fs } from "node:fs";
import { join, resolve } from "node:path";

const DATA_DIR = resolve(process.cwd(), "data");

async function cleanDir(dirPath) {
	try {
		const entries = await fs.readdir(dirPath, { withFileTypes: true });
		for (const entry of entries) {
			if (entry.name === ".gitkeep") continue;
			const fullPath = join(dirPath, entry.name);
			if (entry.isDirectory()) {
				await fs.rm(fullPath, { recursive: true, force: true });
				console.log(`Deleted directory: ${fullPath}`);
			} else {
				await fs.unlink(fullPath);
				console.log(`Deleted file: ${fullPath}`);
			}
		}
	} catch (err) {
		if (err.code !== "ENOENT") {
			console.error(`Error cleaning directory ${dirPath}:`, err.message);
		}
	}
}

async function run() {
	console.log("Starting data cleanup...");

	// 1. Clean briefings
	console.log("Cleaning briefings...");
	await cleanDir(join(DATA_DIR, "briefings"));

	// 2. Clean presentations
	console.log("Cleaning presentations...");
	await cleanDir(join(DATA_DIR, "presentations"));

	// 3. Clean voltagent memory DB files
	console.log("Cleaning voltagent database...");
	const voltagentDir = join(DATA_DIR, "voltagent");
	try {
		const dbFiles = ["memory.db", "memory.db-wal", "memory.db-shm"];
		for (const file of dbFiles) {
			const filePath = join(voltagentDir, file);
			await fs.unlink(filePath).catch(() => {});
			console.log(`Deleted db file if existed: ${filePath}`);
		}
	} catch (err) {
		console.error("Error cleaning database files:", err.message);
	}

	// 4. Delete settings
	console.log("Cleaning settings...");
	const settingsFile = join(DATA_DIR, "settings.json");
	await fs.unlink(settingsFile).catch(() => {});
	console.log(`Deleted settings file if existed: ${settingsFile}`);

	console.log("\nCleanup completed! Start the project to recreate initial seed data and default settings.");
}

run().catch((err) => {
	console.error("Cleanup script failed:", err);
	process.exit(1);
});
