import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedHrUser } from "@/lib/hr/auth/session";
import { createPaymentDestinationVersion } from "@/lib/hr/payroll/unit9-financial-service";

const input = z.object({ employeeId: z.string().cuid(), bankName: z.string().trim().min(2).max(120), accountName: z.string().trim().min(2).max(160), accountNumber: z.string().regex(/^\d{6,34}$/), currency: z.string().regex(/^[A-Z]{3}$/), effectiveFrom: z.coerce.date() });

export async function POST(request: Request) {
  const auth = await getAuthenticatedHrUser();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!auth.permissions.has("payroll.read_bank_details")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const parsed = input.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid payment destination." }, { status: 400 });
  try {
    return NextResponse.json(await createPaymentDestinationVersion(prisma, { organizationId: auth.user.organizationId, userId: auth.user.id, role: auth.roles.join(",") }, parsed.data));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Payment destination update failed." }, { status: 422 });
  }
}
