import { NextResponse } from "next/server";
import { authorizeInternalRequest } from "@/lib/hr/internal-auth";
import { processHrOutbox } from "@/lib/hr/notifications/worker";

export async function POST(request: Request) {
  if (!authorizeInternalRequest(request, process.env.EMAIL_WORKER_SECRET)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const outcomes = await processHrOutbox(25);
  return NextResponse.json(outcomes, { headers: { "Cache-Control": "no-store" } });
}
