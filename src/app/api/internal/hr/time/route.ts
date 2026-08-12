import { NextResponse } from "next/server";
import { authorizeInternalRequest } from "@/lib/hr/internal-auth";
import { runTimeOperationalWindow } from "@/lib/hr/time/worker";

export async function POST(request: Request) {
  if (!authorizeInternalRequest(request, process.env.ORGANIZATION_WORKER_SECRET)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const results = await runTimeOperationalWindow();
  return NextResponse.json({ jobs: results.length, completed: results.filter(({ status }) => status === "COMPLETED").length, results }, { headers: { "cache-control": "no-store" } });
}
