import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("HR worker scheduling", () => {
  const root = resolve(import.meta.dirname, "..");
  const packageJson = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));
  const launcher = readFileSync(resolve(root, "scripts/start-with-hr-workers.mjs"), "utf8");

  it("starts the production server through the governed worker launcher", () => {
    expect(packageJson.scripts.start).toBe("node scripts/start-with-hr-workers.mjs");
    expect(launcher).toContain('["next", "start"]');
  });

  it("runs email and activation workers with independent configured secrets", () => {
    expect(launcher).toContain('"/api/internal/hr/outbox", process.env.EMAIL_WORKER_SECRET');
    expect(launcher).toContain('"/api/internal/hr/recruitment-activation", process.env.ORGANIZATION_WORKER_SECRET');
    expect(launcher).toContain('"/api/internal/hr/workforce-events", process.env.ORGANIZATION_WORKER_SECRET');
  });

  it("prevents overlapping ticks and handles graceful shutdown", () => {
    expect(launcher).toContain("if (running || stopped) return");
    expect(launcher).toContain('for (const signal of ["SIGTERM", "SIGINT"])');
    expect(launcher).toContain("clearInterval(interval)");
  });
});
