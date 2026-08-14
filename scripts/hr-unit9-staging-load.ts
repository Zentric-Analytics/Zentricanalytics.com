import { PrismaClient, type Prisma } from "@prisma/client";
import { calculateFrozenPayroll, type FrozenPayrollManifest } from "../src/lib/hr/payroll/unit9-engine";

const databaseUrl = new URL(process.env.DATABASE_URL ?? "postgresql://missing/missing");
if (process.env.HR_UNIT9_STAGING_LOAD_CONFIRM !== "staging-only" || databaseUrl.pathname.slice(1) !== "zentric_analytics_staging") throw new Error("Refusing Unit 9 load validation outside the explicitly confirmed staging database.");

const prisma = new PrismaClient();
const requestCount = 250;
const concurrency = 10;
const durations: number[] = [];
const failures: string[] = [];

const percentile = (sorted: number[], fraction: number) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * fraction))];
try {
  const snapshot = await prisma.hrPayrollInputSnapshot.findFirstOrThrow({ orderBy: { createdAt: "desc" }, select: { sourceManifest: true, inputHash: true, payrollRunId: true } });
  let next = 0;
  await Promise.all(Array.from({ length: concurrency }, async () => {
    while (true) {
      const index = next++;
      if (index >= requestCount) return;
      const started = performance.now();
      try {
        const calculated = calculateFrozenPayroll(snapshot.sourceManifest as unknown as FrozenPayrollManifest, snapshot.inputHash);
        if (calculated.output.net.isNegative()) throw new Error("Calculated net pay became negative.");
        await prisma.$transaction([
          prisma.hrPayrollAuthoritativeRun.findUnique({ where: { id: snapshot.payrollRunId }, select: { id: true, status: true, correlationId: true } }),
          prisma.hrPayrollAuthoritativeResult.findMany({ where: { payrollRunId: snapshot.payrollRunId }, select: { id: true, outputHash: true }, take: 10 }),
          prisma.hrPayrollRiskFinding.count({ where: { payrollRunId: snapshot.payrollRunId } }),
          prisma.hrPayrollRunApproval.count({ where: { payrollRunId: snapshot.payrollRunId } }),
        ] as Prisma.PrismaPromise<unknown>[]);
      } catch (error) {
        failures.push(error instanceof Error ? error.message : String(error));
      } finally {
        durations.push(performance.now() - started);
      }
    }
  }));
  durations.sort((a, b) => a - b);
  if (failures.length) throw new Error(`Unit 9 load failures: ${JSON.stringify(failures.slice(0, 5))}`);
  console.log(JSON.stringify({ result: "PASS", database: databaseUrl.pathname.slice(1), requestCount, concurrency, failures: 0, p50Ms: Number(percentile(durations, 0.5).toFixed(1)), p95Ms: Number(percentile(durations, 0.95).toFixed(1)), p99Ms: Number(percentile(durations, 0.99).toFixed(1)), maxMs: Number(durations.at(-1)!.toFixed(1)) }));
} finally {
  await prisma.$disconnect();
}
