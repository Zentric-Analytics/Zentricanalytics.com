import { NextResponse } from "next/server";
import { authorizeInternalRequest } from "@/lib/hr/internal-auth";
import { replayCompensationDeadLetter, runCompensationOperationalWindow } from "@/lib/hr/compensation/worker";

export async function POST(request: Request) {
  if (!authorizeInternalRequest(request, process.env.ORGANIZATION_WORKER_SECRET)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const input = await request.json().catch(() => ({})) as { action?: string; organizationId?: string; windowKey?: string };
  if (input.action === "replay-dead-letter") {
    if (!input.organizationId || !/^\d{4}-\d{2}-\d{2}T\d{2}$/.test(input.windowKey ?? "")) return NextResponse.json({ error: "A valid organization and hourly window are required." }, { status: 400 });
    const replayed = await replayCompensationDeadLetter(input.organizationId, input.windowKey!);
    return NextResponse.json({ replayed: true, jobId: replayed.id, windowKey: replayed.windowKey }, { headers: { "cache-control": "no-store" } });
  }
  const results = await runCompensationOperationalWindow();
  return NextResponse.json({ jobs: results.length, completed: results.filter(({ status }) => status === "COMPLETED").length, results }, { headers: { "cache-control": "no-store" } });
}
