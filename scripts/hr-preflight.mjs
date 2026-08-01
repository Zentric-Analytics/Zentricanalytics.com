import { PrismaClient } from "@prisma/client";
import { runHrPreflight } from "./hr-preflight-lib.mjs";

const prisma = new PrismaClient();
try {
  const result = await runHrPreflight(prisma, process.env, (message) => console.info(message));
  if (!result.ready) process.exitCode = 1;
} catch (error) {
  console.error(`HRMS preflight failed: ${error instanceof Error ? error.message : "Unknown error"}`);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
