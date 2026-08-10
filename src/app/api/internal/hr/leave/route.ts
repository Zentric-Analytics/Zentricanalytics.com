import { NextResponse } from "next/server";
import { authorizeInternalRequest } from "@/lib/hr/internal-auth";
import { processDueUnit5Leave } from "@/lib/hr/leave/unit5-accounting";

export async function POST(request: Request) {
  if (!authorizeInternalRequest(request, process.env.ORGANIZATION_WORKER_SECRET)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const results = await processDueUnit5Leave();
  return NextResponse.json({ inspected: results.length, applied: results.filter(({ applied }) => applied).length, failed: results.filter(({ error }) => error).length, results }, { headers: { "cache-control": "no-store" } });
}
