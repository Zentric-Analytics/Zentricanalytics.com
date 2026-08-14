import { spawnSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";
import { reconcileHrRolePermissions, runHrBootstrap } from "./hr-bootstrap-lib.mjs";
import { hrEnvironmentChecks, runHrPreflight } from "./hr-preflight-lib.mjs";

const report = (message) => console.info(message);
const configuration = hrEnvironmentChecks(process.env);
if (configuration.issues.length) {
  configuration.issues.forEach((issue) => console.error(`BLOCKED ${issue}`));
  process.exit(1);
}
report(`HRMS release target environment: ${configuration.appEnv}. Secrets and database location are hidden.`);

const executable = process.platform === "win32" ? "yarn.cmd" : "yarn";
const migration = spawnSync(executable, ["prisma", "migrate", "deploy"], { stdio: "inherit", shell: false });
if (migration.error || migration.status !== 0) {
  console.error("BLOCKED Prisma migration deployment failed.");
  process.exit(1);
}

const prisma = new PrismaClient();
try {
  const initialized = await prisma.hrUserRole.findFirst({
    where: { revokedAt: null, role: { key: "ADMIN" }, user: { status: "ACTIVE" } },
    select: { id: true },
  });
  let created = false;
  if (!initialized) {
    if (String(process.env.HR_BOOTSTRAP_ENABLED).toLowerCase() !== "true") {
      throw new Error("HRMS is not initialized. Set the one-time HR_BOOTSTRAP_ENABLED flag and guarded bootstrap secrets.");
    }
    const result = await runHrBootstrap(prisma, process.env, report);
    created = result.status === "created";
  } else {
    report("PASS HRMS already initialized; bootstrap was skipped and bootstrap secrets were not read.");
  }
  await reconcileHrRolePermissions(prisma, report);
  const preflight = await runHrPreflight(prisma, process.env, report, { allowInitialMfaEnrollment: created });
  if (!preflight.ready) throw new Error("HRMS release preflight failed.");
  if (created) report("INITIALIZATION ONLY Deploy once, enroll privileged MFA immediately, remove bootstrap secrets and HR_BOOTSTRAP_ENABLED, then redeploy.");
} catch (error) {
  console.error(`BLOCKED ${error instanceof Error ? error.message : "HRMS release failed."}`);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
