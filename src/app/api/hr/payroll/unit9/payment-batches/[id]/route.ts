import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedHrUser } from "@/lib/hr/auth/session";
import { transitionUnit9PaymentBatch } from "@/lib/hr/payroll/unit9-financial-service";

const input = z.object({ to: z.enum(["APPROVED", "EXPORTED", "SUBMITTED", "ACKNOWLEDGED", "SETTLED", "REJECTED", "RETURNED"]), reason: z.string().trim().min(3).max(500), providerReference: z.string().trim().min(3).max(200).optional() });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthenticatedHrUser();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = input.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid payment action." }, { status: 400 });
  const permission = parsed.data.to === "APPROVED" ? "payroll.payment.approve" : parsed.data.to === "EXPORTED" ? "payroll.export" : parsed.data.to === "SETTLED" || parsed.data.to === "ACKNOWLEDGED" ? "payroll.payment.reconcile" : "payroll.payment.submit";
  if (!auth.permissions.has(permission)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  try {
    const { id } = await params;
    return NextResponse.json(await transitionUnit9PaymentBatch(prisma, { organizationId: auth.user.organizationId, userId: auth.user.id, role: auth.roles.join(",") }, id, parsed.data));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Payment action failed." }, { status: 422 });
  }
}
