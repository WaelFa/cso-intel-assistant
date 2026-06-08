import { spawn } from "child_process";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, "..");
const dashboardDir = join(rootDir, "dashboard");

console.log("🚀 Starting CSO Strategic Intelligence Assistant Project...");

// 1. Start Hono Backend Server
console.log("👉 Starting VoltAgent Backend (Port 3141)...");
const backend = spawn("npm", ["run", "dev"], {
  cwd: rootDir,
  shell: true,
  stdio: ["inherit", "pipe", "pipe"],
});

let frontendStarted = false;

const startFrontend = () => {
  if (frontendStarted) return;
  frontendStarted = true;

  console.log("\n👉 Starting Next.js Dashboard Frontend (Port 3000)...");
  const frontend = spawn("npm", ["run", "dev"], {
    cwd: dashboardDir,
    shell: true,
    stdio: "inherit",
  });

  frontend.on("close", (code) => {
    console.log(`Frontend process exited with code ${code}`);
    cleanup();
  });
};

// Listen to backend outputs to trigger frontend startup once backend is ready
backend.stdout.on("data", (data) => {
  const output = data.toString();
  process.stdout.write(`[Backend] ${output}`);

  // Hono server logs seed completion or server startup
  if (output.includes("[seed]") || output.includes("Server running") || output.includes("Local:")) {
    // Wait an additional 500ms to ensure the port is fully bound
    setTimeout(startFrontend, 500);
  }
});

backend.stderr.on("data", (data) => {
  process.stderr.write(`[Backend ERROR] ${data.toString()}`);
});

backend.on("close", (code) => {
  console.log(`Backend process exited with code ${code}`);
  cleanup();
});

// Fallback safety trigger: start frontend after 4 seconds if logs don't match
const safetyTimeout = setTimeout(startFrontend, 4000);

const cleanup = () => {
  clearTimeout(safetyTimeout);
  console.log("\nStopping all services...");
  try {
    backend.kill();
  } catch (e) {}
  process.exit();
};

process.on("SIGINT", cleanup);
process.on("SIGTERM", cleanup);
