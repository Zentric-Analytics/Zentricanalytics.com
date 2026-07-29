"use server";
import { redirect } from "next/navigation";
import { revokeCurrentHrSession } from "@/lib/hr/auth/session";

export async function hrLogoutAction() {
  await revokeCurrentHrSession();
  redirect("/hr/login");
}
