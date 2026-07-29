import { PrismaClient } from "@prisma/client";

if (process.env.APP_ENV !== "staging" || process.env.DR_RESTORE_CONFIRM !== "isolated-restore") {
  console.error("BLOCKED Restore verification runs only against an isolated staging-class restore with DR_RESTORE_CONFIRM=isolated-restore.");
  process.exit(1);
}
if (!String(process.env.APPLICATION_BASE_URL ?? "").includes("restore")) {
  console.error("BLOCKED APPLICATION_BASE_URL must identify an isolated restore environment.");
  process.exit(1);
}

const prisma = new PrismaClient();
try {
  await prisma.$queryRaw`SELECT 1`;
  const [organizations, users, employees, audits, outbox, workflows] = await Promise.all([
    prisma.hrOrganization.count(), prisma.hrUser.count(), prisma.hrEmployee.count(),
    prisma.hrAuditEvent.count(), prisma.hrEmailOutbox.count(), prisma.hrWorkflowInstance.count(),
  ]);
  if (!organizations || !users || !audits) throw new Error("Restored database is missing required foundation records.");
  console.info(`PASS isolated restore is queryable: organizations=${organizations}, users=${users}, employees=${employees}, audits=${audits}, outbox=${outbox}, workflows=${workflows}. No data was changed.`);
} catch {
  console.error("BLOCKED isolated restore verification failed. Database details are intentionally hidden.");
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
