import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    await prisma.hrOrganization.count();
    return NextResponse.json({ status: "ready", database: "ok" }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ status: "not_ready", database: "unavailable" }, { status: 503, headers: { "Cache-Control": "no-store", "Retry-After": "10" } });
  }
}
