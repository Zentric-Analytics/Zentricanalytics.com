import { PrismaClient } from "@prisma/client";
import { runHrBootstrap } from "./hr-bootstrap-lib.mjs";

const prisma = new PrismaClient();
try {
  const result = await runHrBootstrap(prisma, process.env, (message) => console.info(message));
  if (result.status === "already_initialized") process.exitCode = 0;
} catch (error) {
  console.error(`HRMS bootstrap failed: ${error instanceof Error ? error.message : "Unknown error"}`);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
