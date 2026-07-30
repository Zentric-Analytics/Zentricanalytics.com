const baseUrl = String(process.env.APPLICATION_BASE_URL ?? "").replace(/\/+$/, "");
const confirmed = process.env.LOAD_TEST_CONFIRM === "non-production";
if (!confirmed || !/^https:\/\//.test(baseUrl) || !/(staging|localhost|127\.0\.0\.1)/i.test(baseUrl)) {
  console.error("BLOCKED Load smoke runs only against a confirmed non-production HTTPS target.");
  process.exit(1);
}
const total = Math.min(1000, Math.max(10, Number(process.env.LOAD_TEST_REQUESTS) || 100));
const concurrency = Math.min(25, Math.max(1, Number(process.env.LOAD_TEST_CONCURRENCY) || 10));
let cursor = 0;
let failed = 0;
const durations = [];
async function worker() {
  while (cursor < total) {
    cursor += 1;
    const start = performance.now();
    try {
      const response = await fetch(`${baseUrl}/api/health/ready`, { cache: "no-store" });
      if (!response.ok) failed += 1;
    } catch { failed += 1; }
    durations.push(performance.now() - start);
  }
}
await Promise.all(Array.from({ length: concurrency }, worker));
durations.sort((left, right) => left - right);
const percentile = (value) => durations[Math.min(durations.length - 1, Math.floor(durations.length * value))];
console.info(`Load smoke: requests=${total}, concurrency=${concurrency}, failures=${failed}, p50Ms=${percentile(0.5).toFixed(1)}, p95Ms=${percentile(0.95).toFixed(1)}.`);
if (failed || percentile(0.95) > 2000) process.exitCode = 1;
