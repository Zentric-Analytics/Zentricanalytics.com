import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { authorizeInternalRequest } from "@/lib/hr/internal-auth";
import { transitionVacancy } from "@/lib/hr/recruitment/vacancies";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  if (!authorizeInternalRequest(request, process.env.ORGANIZATION_WORKER_SECRET)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const now = new Date();
  let cursor: string | undefined;
  let inspected = 0;
  let published = 0;
  let blocked = 0;
  // Keyset pages ensure blocked older schedules do not starve later ones.
  while (true) {
    const candidates = await prisma.hrVacancy.findMany({
      where: { status: "SCHEDULED", scheduledPublishAt: { lte: now }, ...(cursor ? { id: { gt: cursor } } : {}) },
      select: { id: true, organizationId: true, createdById: true, version: true },
      orderBy: { id: "asc" }, take: 50,
    });
    if (!candidates.length) break;
    for (const vacancy of candidates) {
      inspected++;
      try {
        await prisma.$transaction(tx => transitionVacancy(tx, {
          vacancyId: vacancy.id, organizationId: vacancy.organizationId,
          actorUserId: vacancy.createdById, expectedVersion: vacancy.version,
          to: "OPEN", source: "SCHEDULED_JOB", now,
          reason: "Scheduled publication time reached; publication safeguards rechecked.",
        }), { isolationLevel: "Serializable" });
        published++;
      } catch {
        // Remain hidden and retry next sweep; no raw employee/database errors exposed.
        blocked++;
      }
    }
    cursor = candidates[candidates.length - 1].id;
  }
  if (published) {
    revalidatePath("/careers");
    revalidatePath("/hr/admin/vacancies");
  }
  return NextResponse.json({ inspected, published, blocked });
}
