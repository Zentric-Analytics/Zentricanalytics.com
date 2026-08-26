import { PrismaClient } from "@prisma/client";
import { reconcileHrRolePermissions } from "./hr-bootstrap-lib.mjs";

if (process.env.HR_ROLE_RECONCILE_CONFIRM !== "staging-only") {
  throw new Error("REFUSE TO RUN: HR_ROLE_RECONCILE_CONFIRM must equal staging-only.");
}

const prisma = new PrismaClient();
try {
  const [{ database, productionMarker }] = await prisma.$queryRaw`
    SELECT current_database() AS database,
      EXISTS (SELECT 1 FROM "HrOrganizationSetting" WHERE key = 'environment' AND value::text ILIKE '%production%') AS "productionMarker"
  `;
  if (database !== "zentric_analytics_staging" || productionMarker) {
    throw new Error(`REFUSE TO RUN: expected zentric_analytics_staging and no production marker; received ${database}.`);
  }
  const first = await reconcileHrRolePermissions(prisma);
  const second = await reconcileHrRolePermissions(prisma);
  if (second.rolesCreated !== 0 || second.removed !== 0) throw new Error("Reconciliation is not idempotent on its second run.");
  if (Math.max(first.maxOrganizationTransactionMs, second.maxOrganizationTransactionMs) >= 5_000) {
    throw new Error("Reconciliation approached or exceeded the prior 5-second transaction boundary.");
  }
  console.log(JSON.stringify({
    databaseEnvironment: "staging",
    organizations: first.organizations,
    firstRun: first,
    secondRun: second,
    priorFailureBoundaryMs: 5_000,
    result: "PASS",
  }));
} finally {
  await prisma.$disconnect();
}
