import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedHrUser } from "@/lib/hr/auth/session";
import { createUnit9Run, listUnit9Runs } from "@/lib/hr/payroll/unit9-service";

const createInput = z.object({
  payGroupId: z.string().cuid(), calendarPeriodId: z.string().cuid(), jurisdictionVersionId: z.string().cuid(),
  kind: z.enum(["REGULAR", "OFF_CYCLE", "EMERGENCY", "CORRECTION"]).optional(), sequence: z.number().int().positive().optional(),
  idempotencyKey: z.string().trim().min(8).max(200),
});

async function payrollActor(permission: "payroll.read" | "payroll.create") {
  const auth = await getAuthenticatedHrUser();
  if (!auth) return null;
  if (!auth.permissions.has(permission)) return false;
  return { organizationId: auth.user.organizationId, userId: auth.user.id, role: auth.roles.join(",") };
}

export async function GET() {
  const actor = await payrollActor("payroll.read");
  if (actor === null) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (actor === false) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return NextResponse.json({ runs: await listUnit9Runs(prisma, actor) }, { headers: { "cache-control": "private, no-store" } });
}

export async function POST(request: Request) {
  const actor = await payrollActor("payroll.create");
  if (actor === null) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (actor === false) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const parsed = createInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid payroll run request." }, { status: 400 });
  try {
    const run = await createUnit9Run(prisma, actor, parsed.data);
    return NextResponse.json({ run }, { status: 201, headers: { "cache-control": "no-store" } });
  } catch (error) {
    const conflict = typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
    return NextResponse.json({ error: conflict ? "An authoritative payroll run already exists for this scope." : error instanceof Error ? error.message : "Payroll run creation failed." }, { status: conflict ? 409 : 422 });
  }
}
