import { NextResponse } from "next/server";
import { authorizeInternalRequest } from "@/lib/hr/internal-auth";
import { activateDueOrganizationChanges } from "@/lib/hr/organization/restructuring";
export async function POST(request: Request) {
  if (!authorizeInternalRequest(request, process.env.ORGANIZATION_WORKER_SECRET)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(await activateDueOrganizationChanges(), { headers: { "cache-control": "no-store" } });
}
