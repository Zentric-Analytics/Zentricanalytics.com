import { NextResponse } from "next/server";
import { rotateCurrentHrSession } from "@/lib/hr/auth/session";
import { sha256 } from "@/lib/security";

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  const expected = process.env.APPLICATION_BASE_URL ? new URL(process.env.APPLICATION_BASE_URL).origin : new URL(request.url).origin;
  if (!origin || origin !== expected || request.headers.get("sec-fetch-site") !== "same-origin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const rotated = await rotateCurrentHrSession({ ipHash: sha256(ip), userAgent: request.headers.get("user-agent")?.slice(0, 500) });
  return NextResponse.json({ rotated }, { status: rotated ? 200 : 401, headers: { "Cache-Control": "no-store" } });
}
