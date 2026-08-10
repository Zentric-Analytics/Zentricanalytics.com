import { NextResponse } from "next/server";
import { authorizeInternalRequest } from "@/lib/hr/internal-auth";
import { activateReadyEmployee } from "@/lib/hr/recruitment/prehire";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  if (!authorizeInternalRequest(request, process.env.ORGANIZATION_WORKER_SECRET)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const now = new Date();
  const candidates = await prisma.hrEmployee.findMany({
    where: {
      employmentStatus: { in: ["PRE_HIRE", "READY_FOR_START"] },
      startDate: { lte: now },
    },
    select: { id: true, organizationId: true },
    take: 100,
  });
  const results = [];
  for (const employee of candidates) {
    try {
      await prisma.$transaction((tx) => activateReadyEmployee(tx, {
        organizationId: employee.organizationId,
        employeeId: employee.id,
        source: "SCHEDULED_JOB",
        now,
      }));
      results.push({ employeeId: employee.id, status: "ACTIVATED" });
    } catch (error) {
      results.push({
        employeeId: employee.id,
        status: "BLOCKED",
        reason: error instanceof Error ? error.message : "Activation failed",
      });
    }
  }
  return NextResponse.json({
    inspected: candidates.length,
    activated: results.filter((result) => result.status === "ACTIVATED").length,
    results,
  });
}
