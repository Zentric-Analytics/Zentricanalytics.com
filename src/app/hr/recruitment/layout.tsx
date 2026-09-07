import Link from "next/link";
import { requireAuthenticatedUser } from "@/lib/hr/permissions/authorize";

export default async function RecruitmentLayout({ children }: { children: React.ReactNode }) {
  const auth = await requireAuthenticatedUser();
  const admin = auth.roles.some(role => role === "ADMIN" || role === "HR_ADMIN");
  return <><nav className="flex gap-4 border-b p-4" aria-label="Recruitment navigation">
    <Link href={admin ? "/hr/admin/dashboard" : "/hr/employee"}>HRMS home</Link>
    <Link href="/hr/recruitment">Recruitment stages</Link>
  </nav>{children}</>;
}
