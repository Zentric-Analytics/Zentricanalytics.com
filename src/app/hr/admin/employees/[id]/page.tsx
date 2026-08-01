import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { unsealHrCredential } from "@/lib/hr/auth/crypto";
import { requirePermission } from "@/lib/hr/permissions/authorize";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";
import {
  addEmergencyContactAction,
  addEmployeeAddressAction,
  archiveEmployeeAction,
  createSystemAccessAssignmentAction,
  revokeSystemAccessAssignmentAction,
  saveEmployeeBankAccountAction,
  saveEmployeeIdentifierAction,
  saveEmployeeTaxProfileAction,
  terminateEmployeeAction,
  updateEmployeeProfileAction,
} from "../actions";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return <><dt className="font-semibold">{label}</dt><dd className="break-all">{children ?? "—"}</dd></>;
}

export default async function EmployeeProfilePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ provisioned?: string }> }) {
  const auth = await requirePermission("employee.read_all");
  const { id } = await params;
  const employee = await prisma.hrEmployee.findFirst({
    where: { id, organizationId: auth.user.organizationId },
    include: {
      addresses: true,
      emergencyContacts: true,
      identifiers: true,
      bankAccounts: { orderBy: [{ isPrimary: "desc" }, { createdAt: "desc" }] },
      taxProfile: true,
      employmentAssignments: { include: { department: true, team: true, position: true }, orderBy: { effectiveFrom: "desc" } },
      statusHistory: { include: { changedBy: { select: { email: true } } }, orderBy: { effectiveAt: "desc" } },
      systemAccessAssignments: { orderBy: { createdAt: "desc" } },
      user: { include: { roles: { where: { revokedAt: null }, include: { role: true } } } },
      salaryRecords: { orderBy: { effectiveFrom: "desc" }, take: 5 },
      lifecycleInstances: { orderBy: { createdAt: "desc" }, take: 5 },
      assetAssignments: { where: { status: "ACTIVE" } },
      documents: { where: { retentionStatus: "ACTIVE", archivedAt: null } },
    },
  });
  if (!employee) notFound();
  const mayReadBank = auth.permissions.has("payroll.read_bank_details");
  const mayReadTax = auth.permissions.has("payroll.read_salary");
  const mayReadSensitive = auth.permissions.has("document.read_sensitive");
  const query = await searchParams;
  const currentAssignment = employee.employmentAssignments.find(({ status, effectiveTo }) => status === "ACTIVE" && (!effectiveTo || effectiveTo > new Date()));

  return <>
    {query.provisioned ? <p role="status" className="mb-4 rounded-xl bg-teal-50 p-4 text-teal-800">Employee provisioned and activated successfully.</p> : null}
    <h1 className="text-3xl font-bold">{employee.legalFirstName} {employee.middleName} {employee.lastName}</h1>
    <p className="mt-2 font-mono text-slate-600">{employee.employeeNumber}</p>
    <nav aria-label="Employee profile sections" className="mt-5 flex flex-wrap gap-2 text-sm">{["Overview","Personal","Employment","Assignments","Compensation","Payroll","Leave","Documents","Assets","Onboarding","User access","Audit history"].map(label => <a className="rounded-full border bg-white px-3 py-2" href={`#${label.toLowerCase().replaceAll(" ", "-")}`} key={label}>{label}</a>)}</nav>
    <section id="overview" className="mt-5 rounded-2xl bg-slate-900 p-5 text-white"><div className="grid gap-4 md:grid-cols-4"><div><p className="text-xs uppercase text-slate-300">Status</p><p className="font-bold">{employee.employmentStatus}</p></div><div><p className="text-xs uppercase text-slate-300">Department / position</p><p>{currentAssignment?.department.name ?? "Unassigned"} · {currentAssignment?.position.title ?? "Unassigned"}</p></div><div><p className="text-xs uppercase text-slate-300">User access</p><p>{employee.user ? `${employee.user.status} · MFA ${employee.user.mfaEnabled ? "enabled" : "not enabled"}` : "No account"}</p></div><div><p className="text-xs uppercase text-slate-300">Outstanding</p><p>{employee.assetAssignments.length} assets · {employee.lifecycleInstances.filter(({ status }) => status === "ACTIVE").length} lifecycle · {employee.documents.length} documents</p></div></div><div className="mt-5 flex flex-wrap gap-2"><a className="btn bg-white text-slate-900" href={`/hr/admin/assignments?employeeId=${employee.id}`}>Assign or transfer</a><a className="btn bg-white text-slate-900" href={`/hr/admin/payroll/setup?employeeId=${employee.id}`}>Change salary</a><a className="btn bg-white text-slate-900" href={`/hr/admin/users?employeeId=${employee.id}`}>Manage access</a><a className="btn bg-white text-slate-900" href={`/hr/admin/lifecycle?employeeId=${employee.id}`}>Start lifecycle</a><a className="btn bg-white text-slate-900" href={`/hr/admin/documents?employeeId=${employee.id}`}>Upload document</a><a className="btn bg-white text-slate-900" href={`/hr/admin/assets?employeeId=${employee.id}`}>Assign asset</a></div></section>

    <div className="mt-6 grid gap-5 lg:grid-cols-2">
      <section className="rounded-2xl bg-white p-5">
        <h2 className="text-lg font-bold">Personal and employment information</h2>
        <dl className="mt-4 grid grid-cols-[minmax(9rem,auto)_1fr] gap-x-4 gap-y-3 text-sm">
          <Row label="Preferred name">{employee.preferredName}</Row>
          <Row label="Company email">{employee.companyEmail}</Row>
          <Row label="Company email status">{employee.companyEmailStatus}</Row>
          <Row label="Personal email">{employee.personalEmail}</Row>
          <Row label="Preferred notification email">{employee.preferredNotificationEmail}</Row>
          <Row label="Phone">{employee.phone}</Row>
          <Row label="Hire date">{employee.hireDate?.toLocaleDateString()}</Row>
          <Row label="Start date">{employee.startDate?.toLocaleDateString()}</Row>
          <Row label="Work mode">{employee.workMode}</Row>
          <Row label="Probation ends">{employee.probationEndDate?.toLocaleDateString()}</Row>
          <Row label="Confirmation date">{employee.confirmationDate?.toLocaleDateString()}</Row>
          <Row label="Status">{employee.employmentStatus}</Row>
          <Row label="Recruitment link">{employee.recruitmentApplicationId ? "Linked to approved candidate history" : "Direct employee record"}</Row>
        </dl>
        <details className="mt-5">
          <summary className="cursor-pointer font-semibold text-teal-700">Edit profile</summary>
          <form action={updateEmployeeProfileAction} className="mt-3 grid gap-3">
            <input type="hidden" name="employeeId" value={employee.id} />
            <input className="input" name="employeeNumber" defaultValue={employee.employeeNumber} required />
            <input className="input" name="legalFirstName" defaultValue={employee.legalFirstName} required />
            <input className="input" name="middleName" defaultValue={employee.middleName ?? ""} />
            <input className="input" name="lastName" defaultValue={employee.lastName} required />
            <input className="input" name="preferredName" defaultValue={employee.preferredName ?? ""} />
            <input className="input" name="companyEmail" type="email" defaultValue={employee.companyEmail ?? ""} />
            <select className="input" name="companyEmailStatus" defaultValue={employee.companyEmailStatus}><option>PENDING</option><option>ACTIVE</option><option>SUSPENDED</option><option>DISABLED</option></select>
            <input className="input" name="personalEmail" type="email" defaultValue={employee.personalEmail ?? ""} />
            <input className="input" name="preferredNotificationEmail" type="email" defaultValue={employee.preferredNotificationEmail ?? ""} />
            <input className="input" name="phone" defaultValue={employee.phone ?? ""} />
            <input className="input" name="hireDate" type="date" defaultValue={employee.hireDate?.toISOString().slice(0, 10) ?? ""} required />
            <input className="input" name="startDate" type="date" defaultValue={employee.startDate?.toISOString().slice(0, 10) ?? ""} />
            <select className="input" name="workMode" defaultValue={employee.workMode ?? ""}><option value="">Work mode</option><option>ONSITE</option><option>HYBRID</option><option>REMOTE</option></select>
            <input className="input" name="probationEndDate" type="date" defaultValue={employee.probationEndDate?.toISOString().slice(0, 10) ?? ""} />
            <input className="input" name="confirmationDate" type="date" defaultValue={employee.confirmationDate?.toISOString().slice(0, 10) ?? ""} />
            <input className="input" name="noticePeriodStartDate" type="date" defaultValue={employee.noticePeriodStartDate?.toISOString().slice(0, 10) ?? ""} />
            <textarea className="input" name="notes" defaultValue={employee.notes ?? ""} placeholder="Employment notes" />
            <select className="input" name="employmentStatus" defaultValue={employee.employmentStatus}>
              <option>DRAFT</option><option>ONBOARDING</option><option>ACTIVE</option><option>ON_LEAVE</option><option>SUSPENDED</option><option>NOTICE_PERIOD</option><option>RESIGNED</option>
            </select>
            <input className="input" name="reason" placeholder="Reason for change" required />
            <button className="btn btn-primary">Save profile</button>
          </form>
        </details>
      </section>

      <section className="rounded-2xl bg-white p-5">
        <h2 className="text-lg font-bold">Bank details</h2>
        {mayReadBank ? <>
          {employee.bankAccounts.map((account) => <dl className="mt-4 grid grid-cols-[minmax(9rem,auto)_1fr] gap-x-4 gap-y-3 text-sm" key={account.id}>
            <Row label="Bank">{account.bankName}</Row><Row label="Account name">{account.accountName}</Row>
            <Row label="Account number"><span className="font-mono">{unsealHrCredential(account.accountNumberEncrypted)}</span></Row>
            <Row label="Currency">{account.currency}</Row>
          </dl>)}
          <form action={saveEmployeeBankAccountAction} className="mt-5 grid gap-3">
            <input type="hidden" name="employeeId" value={employee.id} />
            <input className="input" name="bankName" placeholder="Bank name" required />
            <input className="input" name="accountName" placeholder="Account name" required />
            <input className="input" name="accountNumber" autoComplete="off" placeholder="Full account number" required />
            <input className="input" name="currency" defaultValue="NGN" maxLength={3} required />
            <button className="btn btn-primary">Save new primary account</button>
          </form>
        </> : <p className="mt-3 text-sm text-slate-600">Bank details require payroll banking permission.</p>}
      </section>
    </div>

    <section className="mt-5 overflow-x-auto rounded-2xl bg-white p-5"><h2 className="text-lg font-bold">Employment status history</h2><table className="mt-4 w-full text-left text-sm"><thead><tr className="border-b"><th className="py-3">Effective</th><th>Previous</th><th>New status</th><th>Changed by</th><th>Reason</th></tr></thead><tbody>{employee.statusHistory.map((item) => <tr className="border-b last:border-0" key={item.id}><td className="py-3">{item.effectiveAt.toLocaleString()}</td><td>{item.previousStatus ?? "Initial"}</td><td>{item.newStatus}</td><td>{item.changedBy.email}</td><td>{item.reason}</td></tr>)}</tbody></table>{!employee.statusHistory.length && <p className="mt-3 text-sm text-slate-500">No status transitions recorded.</p>}</section>

    <div className="mt-5 grid gap-5 lg:grid-cols-2">
      <section className="rounded-2xl bg-white p-5">
        <h2 className="text-lg font-bold">Addresses</h2>
        {employee.addresses.map((address) => <p className="mt-3 text-sm" key={address.id}><strong>{address.type}{address.isPrimary ? " (Primary)" : ""}:</strong> {address.line1}{address.line2 ? `, ${address.line2}` : ""}, {address.city}{address.state ? `, ${address.state}` : ""}, {address.country} {address.postalCode}</p>)}
        <form action={addEmployeeAddressAction} className="mt-4 grid gap-3">
          <input type="hidden" name="employeeId" value={employee.id} />
          <select className="input" name="type"><option>HOME</option><option>MAILING</option><option>EMERGENCY</option></select>
          <input className="input" name="line1" placeholder="Address line 1" required /><input className="input" name="line2" placeholder="Address line 2" />
          <input className="input" name="city" placeholder="City" required /><input className="input" name="state" placeholder="State/region" />
          <input className="input" name="postalCode" placeholder="Postal code" /><input className="input" name="country" placeholder="Country" required />
          <button className="btn btn-secondary">Add primary address</button>
        </form>
      </section>
      <section className="rounded-2xl bg-white p-5">
        <h2 className="text-lg font-bold">Emergency contacts</h2>
        {employee.emergencyContacts.map((contact) => <dl className="mt-3 grid grid-cols-[8rem_1fr] gap-2 text-sm" key={contact.id}>
          <Row label="Name">{contact.fullName}</Row><Row label="Relationship">{contact.relationship}</Row><Row label="Phone">{contact.phone}</Row><Row label="Email">{contact.email}</Row>
        </dl>)}
        <form action={addEmergencyContactAction} className="mt-4 grid gap-3">
          <input type="hidden" name="employeeId" value={employee.id} />
          <input className="input" name="fullName" placeholder="Full name" required /><input className="input" name="relationship" placeholder="Relationship" required />
          <input className="input" name="phone" placeholder="Phone" required /><input className="input" name="email" type="email" placeholder="Email" />
          <button className="btn btn-secondary">Add primary contact</button>
        </form>
      </section>
    </div>

    <div className="mt-5 grid gap-5 lg:grid-cols-2">
      <section className="rounded-2xl bg-white p-5">
        <h2 className="text-lg font-bold">Government and identity records</h2>
        {mayReadSensitive ? <>
          {employee.identifiers.map((identifier) => <dl className="mt-3 grid grid-cols-[8rem_1fr] gap-2 text-sm" key={identifier.id}>
            <Row label="Type">{identifier.type}</Row><Row label="Full value"><span className="font-mono">{unsealHrCredential(identifier.valueEncrypted)}</span></Row>
            <Row label="Country">{identifier.issuingCountry}</Row><Row label="Expires">{identifier.expiresAt?.toLocaleDateString()}</Row>
          </dl>)}
          <form action={saveEmployeeIdentifierAction} className="mt-4 grid gap-3">
            <input type="hidden" name="employeeId" value={employee.id} />
            <select className="input" name="type"><option>NATIONAL_ID</option><option>PASSPORT</option><option>TAX_ID</option><option>PENSION_ID</option><option>WORK_PERMIT</option><option>OTHER</option></select>
            <input className="input" name="value" autoComplete="off" placeholder="Full identifier" required /><input className="input" name="issuingCountry" placeholder="Issuing country" />
            <input className="input" name="expiresAt" type="date" /><button className="btn btn-primary">Save protected identifier</button>
          </form>
        </> : <p className="mt-3 text-sm text-slate-600">Protected identifiers require sensitive-document permission.</p>}
      </section>
      <section className="rounded-2xl bg-white p-5">
        <h2 className="text-lg font-bold">Tax and pension</h2>
        {mayReadTax ? <>
          {employee.taxProfile ? <dl className="mt-3 grid grid-cols-[9rem_1fr] gap-2 text-sm">
            <Row label="Tax country">{employee.taxProfile.taxCountry}</Row>
            <Row label="Tax identifier">{employee.taxProfile.taxIdentifierEncrypted ? <span className="font-mono">{unsealHrCredential(employee.taxProfile.taxIdentifierEncrypted)}</span> : null}</Row>
            <Row label="Pension provider">{employee.taxProfile.pensionProvider}</Row>
            <Row label="Pension identifier">{employee.taxProfile.pensionIdentifierEncrypted ? <span className="font-mono">{unsealHrCredential(employee.taxProfile.pensionIdentifierEncrypted)}</span> : null}</Row>
          </dl> : null}
          <form action={saveEmployeeTaxProfileAction} className="mt-4 grid gap-3">
            <input type="hidden" name="employeeId" value={employee.id} /><input className="input" name="taxCountry" defaultValue={employee.taxProfile?.taxCountry ?? "Nigeria"} required />
            <input className="input" name="taxIdentifier" autoComplete="off" placeholder="Full tax identifier" /><input className="input" name="pensionProvider" placeholder="Pension provider" />
            <input className="input" name="pensionIdentifier" autoComplete="off" placeholder="Full pension identifier" /><button className="btn btn-primary">Save tax profile</button>
          </form>
        </> : <p className="mt-3 text-sm text-slate-600">Tax details require payroll salary permission.</p>}
      </section>
    </div>

    <section className="mt-5 overflow-x-auto rounded-2xl bg-white p-5">
      <h2 className="text-lg font-bold">Assignment history</h2>
      <table className="mt-4 w-full text-left text-sm"><thead><tr className="border-b"><th className="py-3">Effective</th><th>Department</th><th>Team</th><th>Position</th><th>Type</th><th>Status</th><th>Reason</th></tr></thead>
        <tbody>{employee.employmentAssignments.map((assignment) => <tr className="border-b last:border-0" key={assignment.id}><td className="py-3">{assignment.effectiveFrom.toLocaleDateString()} – {assignment.effectiveTo?.toLocaleDateString() ?? "Current"}</td><td>{assignment.department.name}</td><td>{assignment.team?.name ?? "—"}</td><td>{assignment.position.title}</td><td>{assignment.employmentType}</td><td>{assignment.status}</td><td>{assignment.reason}</td></tr>)}</tbody>
      </table>
      {!employee.employmentAssignments.length ? <p className="mt-3 text-slate-500">No assignment history yet.</p> : null}
    </section>

    <section className="mt-5 rounded-2xl bg-white p-5"><h2 className="text-lg font-bold">System access assignments</h2>{auth.permissions.has("assignment.create") && <form action={createSystemAccessAssignmentAction} className="mt-4 grid gap-3 md:grid-cols-3"><input type="hidden" name="employeeId" value={employee.id} /><input className="input" name="systemKey" placeholder="System key, e.g. google-workspace" required /><input className="input" name="displayName" placeholder="System name" required /><input className="input" name="accountRef" placeholder="Non-secret account reference" /><select className="input" name="status"><option>REQUESTED</option><option>ACTIVE</option></select><input className="input" name="expectedEndAt" type="date" /><input className="input md:col-span-2" name="reason" placeholder="Assignment reason" required /><button className="btn btn-primary">Assign access</button></form>}<div className="mt-4 overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b"><th className="py-3">System</th><th>Account reference</th><th>Status</th><th>Assigned</th><th>Expected end</th><th>Action</th></tr></thead><tbody>{employee.systemAccessAssignments.map((item) => <tr className="border-b last:border-0" key={item.id}><td className="py-3">{item.displayName}<span className="block font-mono text-xs text-slate-500">{item.systemKey}</span></td><td>{item.accountRef ?? "—"}</td><td>{item.status}</td><td>{item.assignedAt?.toLocaleString() ?? "Requested"}</td><td>{item.expectedEndAt?.toLocaleDateString() ?? "—"}</td><td>{item.status !== "REVOKED" && auth.permissions.has("assignment.end") ? <form action={revokeSystemAccessAssignmentAction} className="flex gap-2"><input type="hidden" name="id" value={item.id} /><input className="input max-w-48" name="reason" placeholder="Revocation reason" required /><ConfirmSubmitButton className="font-semibold text-red-700" message={`Revoke ${item.displayName} access for this employee?`}>Revoke</ConfirmSubmitButton></form> : item.endReason ?? "—"}</td></tr>)}</tbody></table>{!employee.systemAccessAssignments.length && <p className="py-4 text-sm text-slate-500">No system access assignments.</p>}</div></section>

    <section className="mt-5 rounded-2xl border border-red-200 bg-white p-5">
      <h2 className="text-lg font-bold">Employment lifecycle</h2>
      {!["TERMINATED", "ARCHIVED"].includes(employee.employmentStatus) ? <form action={terminateEmployeeAction} className="mt-4 grid gap-3 md:grid-cols-[220px_1fr_auto]"><input type="hidden" name="employeeId" value={employee.id} /><input className="input" name="effectiveDate" type="date" required /><input className="input" name="reason" placeholder="Termination reason" required /><ConfirmSubmitButton className="btn btn-secondary text-red-700" message="Terminate this employee and end active assignments? Historical records will be retained.">Terminate employment</ConfirmSubmitButton></form> : null}
      {employee.employmentStatus === "TERMINATED" ? <form action={archiveEmployeeAction} className="mt-4 grid gap-3 md:grid-cols-[1fr_auto]"><input type="hidden" name="employeeId" value={employee.id} /><input className="input" name="reason" placeholder="Archive reason" required /><ConfirmSubmitButton className="btn btn-secondary text-red-700" message="Archive this terminated employee? Payroll, documents, assignments, and audit history will remain retained.">Archive employee</ConfirmSubmitButton></form> : null}
      {employee.employmentStatus === "ARCHIVED" ? <p className="mt-3 text-sm text-slate-600">This employee is archived. All history remains available.</p> : null}
    </section>
  </>;
}
