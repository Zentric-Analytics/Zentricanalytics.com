import { prisma } from "@/lib/prisma";
import { requireAuthenticatedUser } from "@/lib/hr/permissions/authorize";
import { sendMailboxWelcomeAction, sendLinkedInvitationAction, reconcileEmploymentAction } from "./actions";
import { ReviewedFlowForm } from "./ReviewedFlowForm";

export default async function EmployeeAccessPage({ params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuthenticatedUser();
  const { id } = await params;
  const app = await prisma.jobApplication.findFirstOrThrow({ where: { id, organizationId: auth.user.organizationId, deletedAt: null }, include: { applicant: true, hrEmployee: true, emails: { where: { template: "hr-mailbox-welcome" }, select: { id: true, createdAt: true, status: true }, orderBy: { createdAt: "desc" }, take: 10 } } });
  const vacancy = app.vacancyId ? await prisma.hrVacancy.findFirstOrThrow({ where: { id: app.vacancyId, organizationId: auth.user.organizationId }, include: { responsibleHrUser: true } }) : null;
  if (!vacancy || (vacancy.responsibleHrUserId !== auth.user.id && !auth.user.isPrimaryAdmin)) throw new Error("Only the assigned HR person or primary administrator may manage new-hire access.");
  const invitations = app.hrEmployee?.userId ? await prisma.hrAccountInvitation.findMany({
    where: { organizationId: auth.user.organizationId, userId: app.hrEmployee.userId },
    select: { id: true, createdAt: true, expiresAt: true, usedAt: true, status: true, createdBy: { select: { email: true } } },
    orderBy: { createdAt: "desc" }, take: 10,
  }) : [];
  return <main className="mx-auto max-w-3xl space-y-5 p-6">
    <h1 className="text-2xl font-bold">Company mailbox and HRMS invitation</h1>
    <p>{app.applicant.fullName} · {app.applicationId}</p>
    <p>Personal delivery address: {app.applicant.email}</p>
    {app.hrEmployee && <section className="rounded-xl border p-4">
      <h2 className="text-xl font-bold">Employment handover</h2>
      <p>Employment status: {app.hrEmployee.employmentStatus}. Account setup does not activate employment.</p>
      <p>For a previously completed application with missing employment details, reconcile the accepted offer into the same employee record. Conflicting assignments are blocked for HR review; activation and onboarding checks are not bypassed.</p>
      <form action={reconcileEmploymentAction}><input type="hidden" name="applicationId" value={id} /><button className="btn btn-primary">Reconcile accepted employment details</button></form>
      <ReviewedFlowForm applicationId={id} />
    </section>}
    <form action={sendMailboxWelcomeAction} className="grid gap-3">
      <input type="hidden" name="applicationId" value={id} />
      <label>Assigned company email<input className="input" type="email" name="companyEmail" defaultValue={app.hrEmployee?.companyEmail ?? ""} required /></label>
      <label>Temporary mailbox password<input className="input" type="password" name="temporaryPassword" autoComplete="new-password" required maxLength={256} /></label>
      <label>Reply-To HR email<input className="input" type="email" name="replyTo" defaultValue={vacancy.responsibleHrUser?.email ?? auth.user.email} required /></label>
      <p>The system includes Outlook sign-in, password-change and authenticator instructions. It asks the recipient to confirm access to the Reply-To address from their new company mailbox. Temporary credentials are emailed but not retained in employee history.</p>
      <button className="btn btn-primary">Send first message</button>
    </form>
    <h2 className="text-xl font-bold">Message history</h2>
    {app.emails.map(email => <p key={email.id}>{email.createdAt.toLocaleString()} · {email.status}</p>)}
    {!app.emails.length && <p>No mailbox messages recorded.</p>}
    <h2 className="text-xl font-bold">HRMS invitation history</h2>
    <p>Latest 10 invitations. Creation is not proof of delivery or mailbox security setup.</p>
    {invitations.map(invitation => <p key={invitation.id}>{invitation.createdAt.toLocaleString()} · {invitation.status} · Sent by {invitation.createdBy.email} · {invitation.usedAt ? `Accepted ${invitation.usedAt.toLocaleString()}` : `Expires ${invitation.expiresAt.toLocaleString()}`}</p>)}
    {!invitations.length && <p>No HRMS invitations recorded.</p>}
    <p>After receiving the company-mailbox confirmation, send the employee-linked HRMS invitation. This does not happen automatically.</p>
    {app.hrEmployee && <form action={sendLinkedInvitationAction}><input type="hidden" name="employeeId" value={app.hrEmployee.id} /><button className="btn btn-primary">Send HRMS invitation to company email</button></form>}
    <a href={`/hr/recruitment/${id}`}>Back to application history</a>
    {app.hrEmployee && auth.permissions.has("employee.read_all") && <a href={`/hr/admin/employees/${app.hrEmployee.id}`}>Open linked employee history</a>}
  </main>;
}
