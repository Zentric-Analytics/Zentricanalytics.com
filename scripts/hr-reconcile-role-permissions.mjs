import { PrismaClient } from "@prisma/client";
import { reconcileHrRolePermissions } from "./hr-bootstrap-lib.mjs";

const target = new URL(process.env.DATABASE_URL ?? "postgresql://missing/missing");
const database = target.pathname.slice(1);
if (process.env.APP_ENV !== "staging" || process.env.DR_RESTORE_CONFIRM !== "isolated-restore" || !/^zentric_unit8_restore(?:_|$)/.test(database)) {
  throw new Error("Refusing role reconciliation outside an explicitly confirmed isolated Unit 8 staging restore target.");
}

const prisma = new PrismaClient({ datasourceUrl: target.toString() });
try {
  await reconcileHrRolePermissions(prisma, (message) => console.info(message));
} finally {
  await prisma.$disconnect();
}
