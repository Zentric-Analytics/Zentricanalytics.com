import { prisma } from "@/lib/prisma";
import { requireAuthenticatedUser } from "@/lib/hr/permissions/authorize";
import { updateSelfProfileAction } from "./actions";

export default async function EmployeeProfilePage() {
  const auth = await requireAuthenticatedUser();
  if (!auth.user.employee) throw new Error("An employee profile is required.");
  const employee = await prisma.hrEmployee.findFirstOrThrow({
    where: { id: auth.user.employee.id, organizationId: auth.user.organizationId },
    include: {
      addresses: { orderBy: [{ isPrimary: "desc" }, { createdAt: "desc" }] },
      emergencyContacts: { orderBy: [{ isPrimary: "desc" }, { createdAt: "desc" }] },
      employmentAssignments: { include: { department: true, team: true, position: true }, orderBy: { effectiveFrom: "desc" } },
      bankAccounts: { where: { isPrimary: true }, take: 1 },
      assignedToAssignments: { where: { status: "ACTIVE" }, include: { supervisorEmployee: true }, take: 1 },
    },
  });
  const current = employee.employmentAssignments.find(({ status }) => status === "ACTIVE") ?? employee.employmentAssignments[0];
  return <main><h1 className="text-3xl font-bold">My profile</h1><p className="mt-2 text-slate-600">Your complete employment record and self-service contact details.</p>
    <div className="mt-6 grid gap-5 lg:grid-cols-2">
      <section className="rounded-2xl bg-white p-5"><h2 className="font-bold">Identity and employment</h2><dl className="mt-4 grid grid-cols-[minmax(8rem,auto)_1fr] gap-x-4 gap-y-2 text-sm"><dt>Employee number</dt><dd>{employee.employeeNumber}</dd><dt>Legal name</dt><dd>{employee.legalFirstName} {employee.middleName} {employee.lastName}</dd><dt>Company email</dt><dd className="break-all">{employee.companyEmail ?? "—"}</dd><dt>Status</dt><dd>{employee.employmentStatus}</dd><dt>Hire date</dt><dd>{employee.hireDate?.toLocaleDateString() ?? "—"}</dd><dt>Department</dt><dd>{current?.department.name ?? "—"}</dd><dt>Team</dt><dd>{current?.team?.name ?? "—"}</dd><dt>Position</dt><dd>{current?.position.title ?? "—"}</dd><dt>Location</dt><dd>{current?.location ?? "—"}</dd><dt>Supervisor</dt><dd>{employee.assignedToAssignments[0] ? `${employee.assignedToAssignments[0].supervisorEmployee.legalFirstName} ${employee.assignedToAssignments[0].supervisorEmployee.lastName}` : "—"}</dd></dl></section>
      <section className="rounded-2xl bg-white p-5"><h2 className="font-bold">Contact details</h2><form action={updateSelfProfileAction} className="mt-4 grid gap-3"><label className="text-sm font-semibold">Preferred name<input className="input mt-1" name="preferredName" defaultValue={employee.preferredName ?? ""} /></label><label className="text-sm font-semibold">Personal email<input className="input mt-1" name="personalEmail" type="email" defaultValue={employee.personalEmail ?? ""} /></label><label className="text-sm font-semibold">Preferred notification email<input className="input mt-1" name="preferredNotificationEmail" type="email" defaultValue={employee.preferredNotificationEmail ?? ""} /></label><label className="text-sm font-semibold">Phone<input className="input mt-1" name="phone" defaultValue={employee.phone ?? ""} /></label><button className="btn btn-primary">Save contact details</button></form></section>
      <section className="rounded-2xl bg-white p-5"><h2 className="font-bold">Addresses</h2><div className="mt-3 space-y-3 text-sm">{employee.addresses.map((address) => <address className="not-italic" key={address.id}><strong>{address.type}{address.isPrimary ? " · Primary" : ""}</strong><br />{address.line1}{address.line2 ? <><br />{address.line2}</> : null}<br />{address.city}{address.state ? `, ${address.state}` : ""} {address.postalCode}<br />{address.country}</address>)}{!employee.addresses.length && <p className="text-slate-500">No address recorded.</p>}</div></section>
      <section className="rounded-2xl bg-white p-5"><h2 className="font-bold">Emergency contacts and payment account</h2><div className="mt-3 space-y-3 text-sm">{employee.emergencyContacts.map((contact) => <p key={contact.id}><strong>{contact.fullName}</strong> · {contact.relationship}<br />{contact.phone}{contact.email ? ` · ${contact.email}` : ""}</p>)}{!employee.emergencyContacts.length && <p className="text-slate-500">No emergency contact recorded.</p>}<hr /><p><strong>Primary bank account:</strong> {employee.bankAccounts[0] ? `${employee.bankAccounts[0].bankName} · ending ${employee.bankAccounts[0].accountNumberLastFour}` : "Not recorded"}</p><p className="text-xs text-slate-500">Full banking credentials are restricted to authorized payroll administrators.</p></div></section>
    </div>
  </main>;
}
