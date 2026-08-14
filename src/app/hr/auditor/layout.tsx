import { HrPortalShell } from "@/components/HrPortalShell";
import { requireAnyRole } from "@/lib/hr/permissions/authorize";

const links: Array<[string, string]> = [["Audit evidence", "/hr/auditor"], ["Performance evidence", "/hr/auditor/performance"], ["Compensation evidence", "/hr/auditor/compensation"]];

export default async function AuditorLayout({ children }: { children: React.ReactNode }) {
  const auth = await requireAnyRole(["AUDITOR"]);
  return <HrPortalShell title="Audit workspace" email={auth.user.email} links={links}>{children}</HrPortalShell>;
}
