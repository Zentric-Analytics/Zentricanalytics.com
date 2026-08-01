const baseUrl = String(process.env.APPLICATION_BASE_URL ?? "").replace(/\/+$/, "");
if (!/^https:\/\//.test(baseUrl)) {
  console.error("BLOCKED APPLICATION_BASE_URL must be an HTTPS URL.");
  process.exit(1);
}
const checks = [
  ["/api/health/live", 200],
  ["/api/health/ready", 200],
  ["/hr/login", 200],
];
let failed = false;
for (const [path, expected] of checks) {
  try {
    const response = await fetch(`${baseUrl}${path}`, { redirect: "manual" });
    if (response.status !== expected) { failed = true; console.error(`BLOCKED ${path} returned ${response.status}; expected ${expected}.`); }
    else console.info(`PASS ${path}`);
  } catch {
    failed = true;
    console.error(`BLOCKED ${path} could not be reached.`);
  }
}
if (failed) process.exitCode = 1;
