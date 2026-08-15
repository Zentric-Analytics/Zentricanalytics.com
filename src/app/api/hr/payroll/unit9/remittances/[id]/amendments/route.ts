import { NextResponse } from "next/server";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { getAuthenticatedHrUser } from "@/lib/hr/auth/session";
import { createUnit9RemittanceAmendmentSimulation } from "@/lib/hr/payroll/unit9-financial-service";
import { prisma } from "@/lib/prisma";

const input = z.object({ idempotencyKey: z.string().trim().min(8).max(200), reason: z.string().trim().min(8).max(500), deltaManifest: z.record(z.string(), z.unknown()) });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthenticatedHrUser();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!auth.permissions.has("payroll.statutory.submit")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const parsed = input.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid simulated amendment." }, { status: 400 });
  try {
    const { id } = await params;
    return NextResponse.json(await createUnit9RemittanceAmendmentSimulation(prisma, { organizationId: auth.user.organizationId, userId: auth.user.id, role: auth.roles.join(",") }, id, { ...parsed.data, deltaManifest: parsed.data.deltaManifest as Prisma.InputJsonValue }));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Simulated amendment failed." }, { status: 422 });
  }
}
