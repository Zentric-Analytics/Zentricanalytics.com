import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/hr/permissions/authorize";
import { resetHrUserMfaAction } from "../actions";

export default async function AdminMfaResetPage() {
  const auth = await requireRole("ADMIN");
  const users = await prisma.hrUser.findMany({ where: { organizationId: auth.user.organizationId, mfaEnabled: true, id: { not: auth.user.id } }, orderBy: { email: "asc" } });
  return <main><h1 className="text-3xl font-bold">Emergency MFA reset</h1><p className="mt-2 text-slate-600">Use only after identity verification. The reset is audited and revokes every target session.</p><section className="mt-6 max-w-xl rounded-2xl bg-white p-5"><form action={resetHrUserMfaAction} className="grid gap-3"><select className="input" name="userId" required><option value="">Select MFA-enabled user</option>{users.map((user) => <option value={user.id} key={user.id}>{user.email}</option>)}</select><textarea className="input" name="reason" placeholder="Identity verification and reset reason" required /><button className="btn btn-primary">Reset MFA and revoke sessions</button></form></section></main>;
}
