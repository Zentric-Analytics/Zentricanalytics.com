import { afterEach, expect, it, vi } from "vitest";
import { GET as metrics } from "@/app/api/internal/hr/metrics/route";
import { GET as readiness } from "@/app/api/health/ready/route";

const db = vi.hoisted(() => ({
  $queryRaw: vi.fn(),
  hrOrganization: { count: vi.fn() },
  hrEmailOutbox: { count: vi.fn(), findFirst: vi.fn() },
  hrLoginAttempt: { count: vi.fn() },
  hrLifecycleTask: { count: vi.fn() },
  hrWorkflowStageRun: { count: vi.fn() },
  hrEmployeeDocumentVersion: { count: vi.fn() },
}));

vi.mock("@/lib/prisma", () => ({ prisma: db }));

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetAllMocks();
});

it("rejects missing and incorrect monitor tokens before any database query", async () => {
  vi.stubEnv("MONITORING_SECRET", "m".repeat(64));
  for (const headers of [undefined, { authorization: "Bearer wrong-fictional-token" }]) {
    const response = await metrics(new Request("http://localhost/api/internal/hr/metrics", { headers }));
    expect(response.status).toBe(401);
  }
  expect(db.hrEmailOutbox.count).not.toHaveBeenCalled();
});

it("reports held work separately without exposing queued records", async () => {
  const token = "m".repeat(64);
  vi.stubEnv("MONITORING_SECRET", token);
  db.hrEmailOutbox.count.mockImplementation(async ({ where }) => where.status === "HELD" ? 7 : 0);
  db.hrEmailOutbox.findFirst.mockResolvedValue(null);
  for (const counter of [db.hrLoginAttempt, db.hrLifecycleTask, db.hrWorkflowStageRun, db.hrEmployeeDocumentVersion]) {
    counter.count.mockResolvedValue(0);
  }
  const response = await metrics(new Request("http://localhost/api/internal/hr/metrics", {
    headers: { authorization: `Bearer ${token}` },
  }));
  expect(response.status).toBe(200);
  expect(response.headers.get("Cache-Control")).toBe("no-store");
  expect((await response.json()).outbox).toEqual({
    pending: 0, failed: 0, abandoned: 0, held: 7, oldestPendingAgeSeconds: 0,
  });
});

it("returns a sanitized, uncached 503 when database readiness fails", async () => {
  db.$queryRaw.mockRejectedValue(new Error("fictional driver connection details"));
  const response = await readiness();
  expect(response.status).toBe(503);
  expect(response.headers.get("Cache-Control")).toBe("no-store");
  expect(await response.json()).toEqual({ status: "not_ready", database: "unavailable" });
});
