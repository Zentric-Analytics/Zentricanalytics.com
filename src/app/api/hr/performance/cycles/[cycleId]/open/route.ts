import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/hr/permissions/authorize";
import { openPerformanceCycle } from "@/lib/hr/performance/commands";

export async function POST(request: NextRequest, { params }: { params: Promise<{ cycleId: string }> }) {
  const auth = await requirePermission("performance.review.admin");
  const { cycleId } = await params;
  const body = await request.json() as { expectedVersion?: number };
  if (!Number.isInteger(body.expectedVersion) || Number(body.expectedVersion) < 1) {
    return NextResponse.json({ error: "A valid expectedVersion is required." }, { status: 400 });
  }
  const reviewCount = await prisma.$transaction(
    (tx) => openPerformanceCycle(tx, {
      organizationId: auth.user.organizationId,
      actorUserId: auth.user.id,
      actorRole: "TALENT_ADMIN",
    }, { cycleId, expectedVersion: Number(body.expectedVersion) }),
    { isolationLevel: "Serializable" },
  );
  return NextResponse.json({ cycleId, reviewCount, status: "SELF_REVIEW_OPEN" });
}
