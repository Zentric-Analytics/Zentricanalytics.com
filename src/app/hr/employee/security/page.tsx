import { redirect } from "next/navigation";
import { requireAuthenticatedUser } from "@/lib/hr/permissions/authorize";

export default async function EmployeeSecurityPage() {
  await requireAuthenticatedUser();
  redirect("/hr/security");
}
