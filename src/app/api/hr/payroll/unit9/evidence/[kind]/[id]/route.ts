import { NextResponse } from "next/server";
import { getAuthenticatedHrUser } from "@/lib/hr/auth/session";
import { readUnit9Evidence, unit9EvidenceKinds, type Unit9EvidenceKind } from "@/lib/hr/payroll/unit9-evidence-service";
import { prisma } from "@/lib/prisma";

export async function GET(_request: Request, { params }: { params: Promise<{ kind: string; id: string }> }) {
  const auth = await getAuthenticatedHrUser();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!auth.permissions.has("payroll.statutory.read")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { kind, id } = await params;
  if (!unit9EvidenceKinds.includes(kind as Unit9EvidenceKind)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const evidence = await readUnit9Evidence(prisma, auth.user.organizationId, kind as Unit9EvidenceKind, id);
  if (!evidence) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(evidence, { headers: { "Cache-Control": "private, no-store" } });
}
