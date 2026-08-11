import { spawn } from "node:child_process";

const port = process.env.PORT || "3000";
const intervalMs = Math.max(5_000, Number(process.env.HR_WORKER_INTERVAL_MS) || 30_000);
const initialDelayMs = Math.max(1_000, Number(process.env.HR_WORKER_INITIAL_DELAY_MS) || 10_000);
const baseUrl = `http://127.0.0.1:${port}`;

const server = spawn(process.platform === "win32" ? "npx.cmd" : "npx", ["next", "start"], {
  stdio: "inherit",
  env: process.env,
});

let running = false;
let stopped = false;

async function invoke(path, secret) {
  if (!secret) {
    console.warn(`[hr-worker] ${path} skipped: required secret is not configured.`);
    return;
  }
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { authorization: `Bearer ${secret}` },
    signal: AbortSignal.timeout(Math.min(intervalMs, 25_000)),
  });
  if (!response.ok) throw new Error(`${path} returned HTTP ${response.status}`);
}

async function tick() {
  if (running || stopped) return;
  running = true;
  try {
    await invoke("/api/internal/hr/outbox", process.env.EMAIL_WORKER_SECRET);
    await invoke("/api/internal/hr/recruitment-activation", process.env.ORGANIZATION_WORKER_SECRET);
    await invoke("/api/internal/hr/workforce-events", process.env.ORGANIZATION_WORKER_SECRET);
    await invoke("/api/internal/hr/leave", process.env.ORGANIZATION_WORKER_SECRET);
  } catch (error) {
    console.error(`[hr-worker] ${error instanceof Error ? error.message : "worker invocation failed"}`);
  } finally {
    running = false;
  }
}

const initialTimer = setTimeout(() => {
  void tick();
}, initialDelayMs);
const interval = setInterval(() => {
  void tick();
}, intervalMs);

function shutdown(signal) {
  stopped = true;
  clearTimeout(initialTimer);
  clearInterval(interval);
  if (!server.killed) server.kill(signal);
}

for (const signal of ["SIGTERM", "SIGINT"]) process.on(signal, () => shutdown(signal));
server.on("exit", (code, signal) => {
  stopped = true;
  clearTimeout(initialTimer);
  clearInterval(interval);
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 1);
});

