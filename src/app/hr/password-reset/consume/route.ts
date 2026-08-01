import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const input = z.object({ token: z.string().min(32).max(256) });

export async function POST(request: NextRequest) {
  const parsed = input.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ accepted: false }, { status: 400 });
  const response = NextResponse.json({ accepted: true }, { headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } });
  response.cookies.set("za_hr_reset", parsed.data.token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", maxAge: 600, path: "/hr/password-reset" });
  return response;
}
