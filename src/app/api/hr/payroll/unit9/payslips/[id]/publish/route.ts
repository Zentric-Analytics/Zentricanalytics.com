import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedHrUser } from "@/lib/hr/auth/session";
import { publishUnit9Payslip } from "@/lib/hr/payroll/unit9-financial-service";

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthenticatedHrUser();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!auth.permissions.has("payroll.finalize")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  try {
    const { id } = await params;
    return NextResponse.json(await publishUnit9Payslip(prisma, { organizationId: auth.user.organizationId, userId: auth.user.id, role: auth.roles.join(",") }, id));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Payslip publication failed." }, { status: 422 });
  }
}
