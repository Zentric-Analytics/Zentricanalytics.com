import { NextResponse } from "next/server";
import { authorizeInternalRequest } from "@/lib/hr/internal-auth";
import { runUnit5OperationalWindow } from "@/lib/hr/leave/unit5-operations";

export async function POST(request: Request) {
  if (!authorizeInternalRequest(request, process.env.ORGANIZATION_WORKER_SECRET)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const results = await runUnit5OperationalWindow();
  return NextResponse.json({ jobs: results.length, completed: results.filter(({ status }) => status === "COMPLETED").length, failed: results.filter(({ status }) => ["FAILED", "ABANDONED"].includes(status)).length, results }, { headers: { "cache-control": "no-store" } });
}
