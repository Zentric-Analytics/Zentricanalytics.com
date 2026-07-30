import { redirect } from "next/navigation";
import { requireAuthenticatedUser } from "@/lib/hr/permissions/authorize";

export default async function EmployeeNotificationsPage() {
  await requireAuthenticatedUser();
  redirect("/hr/notifications");
}
