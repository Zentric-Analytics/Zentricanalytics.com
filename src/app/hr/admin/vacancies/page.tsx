import { requirePermission } from "@/lib/hr/permissions/authorize";
import { prisma } from "@/lib/prisma";
import { recruitmentTransitionMaps } from "@/lib/hr/recruitment/states";
import { createVacancyAction, vacancyDelegationAction, assignResponsibleHrAction } from "./actions";
import { VacancyTransitionForm } from "./VacancyTransitionForm";
import { Ban, BriefcaseBusiness, Clock3, Send } from "lucide-react";

export default async function VacanciesPage() {
  const auth = await requirePermission("vacancy.view");
  const [vacancies, departments, hiringTeams, users] = await Promise.all([
    prisma.hrVacancy.findMany({
      where: { organizationId: auth.user.organizationId },
      include: { department: true, hiringTeam: { include: { members: { where: { status: "ACTIVE", user: { status: "ACTIVE" } }, include: { user: true } } } }, responsibleHrTeam: true, responsibleHrUser: true, vacancyOwner: true, delegations: { where: { endedAt: null }, include: { delegateUser: true } } },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.hrDepartment.findMany({ where: { organizationId: auth.user.organizationId, status: "ACTIVE" }, orderBy: { name: "asc" } }),
    prisma.hrHiringTeam.findMany({ where: { organizationId: auth.user.organizationId, status: "ACTIVE" }, orderBy: { name: "asc" } }),
    prisma.hrUser.findMany({ where: { organizationId: auth.user.organizationId, status: "ACTIVE" }, include: { roles: { where: { revokedAt: null }, include: { role: true } } }, orderBy: { email: "asc" } }),
  ]);
  const published = vacancies.filter(vacancy => vacancy.status === "OPEN" && vacancy.careersVisible).length;
  const drafts = vacancies.filter(vacancy => vacancy.status === "DRAFT").length;
  const closed = vacancies.filter(vacancy => ["CLOSED", "FILLED", "CANCELLED"].includes(vacancy.status)).length;

  return <main>
    <p className="text-sm font-bold uppercase tracking-widest text-teal-700">Recruitment administration</p>
    <h1 className="mt-2 text-3xl font-bold">Vacancies</h1>
    <p className="mt-2 text-slate-600">Only approved, explicitly published vacancies become visible on the public Careers page.</p>
    <div className="hr-grid-4">{[{label:"Total vacancies",value:vacancies.length,icon:BriefcaseBusiness},{label:"Published / open",value:published,icon:Send},{label:"Draft",value:drafts,icon:Clock3},{label:"Closed",value:closed,icon:Ban}].map(({label,value,icon:Icon}) => <article className="hr-card hr-stat" key={label}><span className="hr-icon"><Icon /></span><span><strong>{value}</strong><p>{label}</p></span></article>)}</div>

    {auth.permissions.has("vacancy.create") ? <form action={createVacancyAction} className="mt-7 grid gap-3 rounded-2xl border bg-white p-5 md:grid-cols-2">
      <h2 className="text-xl font-bold md:col-span-2">Create vacancy</h2>
      <input className="input" name="title" placeholder="Job title" required />
      <select className="input" name="departmentId" required><option value="">Department</option>{departments.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select>
      <select className="input" name="hiringTeamId" required><option value="">Hiring Team</option>{hiringTeams.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select>
      <select className="input" name="responsibleHrUserId" required><option value="">Responsible HR person</option>{users.filter(item => item.roles.some(({ role }) => ["ADMIN", "HR_ADMIN"].includes(role.key))).map((item) => <option value={item.id} key={item.id}>{item.email}</option>)}</select>
      <input type="hidden" name="vacancyOwnerId" value={auth.user.id} />
      <select className="input" name="hiringManagerId"><option value="">Hiring manager (optional)</option>{users.map((item) => <option value={item.id} key={item.id}>{item.email}</option>)}</select>
      <select className="input" name="employmentType" required>{["FULL_TIME","PART_TIME","CONTRACT","INTERN","TEMPORARY"].map((item) => <option value={item} key={item}>{item.replaceAll("_", " ")}</option>)}</select>
      <select className="input" name="workMode" required>{["ONSITE","HYBRID","REMOTE"].map((item) => <option key={item}>{item}</option>)}</select>
      <input className="input" name="numberOfOpenings" type="number" min={1} defaultValue={1} required />
      <input className="input" name="locationLabel" placeholder="Public location" />
      <input className="input" name="opensAt" type="datetime-local" />
      <input className="input" name="applicationDeadline" type="datetime-local" />
      <textarea className="input min-h-36 md:col-span-2" name="description" placeholder="Public job description (minimum 50 characters)" required minLength={50} />
      {["responsibilities","minimumQualifications","preferredQualifications","requiredDocuments","screeningQuestions"].map((name) => <textarea className="input min-h-24" name={name} key={name} placeholder={`${name.replaceAll(/([A-Z])/g, " $1")} — one per line`} />)}
      <input className="input" name="salaryMinimum" type="number" min={0} placeholder="Salary minimum (internal)" />
      <input className="input" name="salaryMaximum" type="number" min={0} placeholder="Salary maximum (internal)" />
      <input className="input" name="currency" defaultValue="NGN" maxLength={3} required />
      <label className="flex items-center gap-2"><input name="publicSalary" type="checkbox" value="true" /> Show salary publicly</label>
      <button className="btn btn-primary md:col-span-2">Create draft vacancy</button>
    </form> : null}

    <section className="mt-7 space-y-4">
      {vacancies.map((vacancy) => <article className="rounded-2xl border bg-white p-5" key={vacancy.id}>
        <div className="flex flex-wrap justify-between gap-3">
          <div><p className="text-sm font-semibold text-teal-700">{vacancy.vacancyNumber}</p><h2 className="text-xl font-bold">{vacancy.title}</h2><p className="text-sm text-slate-600">{vacancy.department.name} · {vacancy.hiringTeam.name} · owner {vacancy.vacancyOwner.email}</p></div>
          <p className="font-bold">{vacancy.status} · v{vacancy.version}</p>
        </div>
        <p className="mt-3 text-sm text-slate-700">{vacancy.description}</p>
        <p>Responsible HR: {vacancy.responsibleHrUser?.email ?? "Not assigned — legacy record requires assignment"}</p>
        {vacancy.status === "SCHEDULED" && <p>Scheduled publication: {vacancy.scheduledPublishAt?.toISOString().replace("T", " ").replace(".000Z", " UTC") ?? "Missing — automatic publication is blocked"}. Remains hidden until all publication checks pass.</p>}
        {(vacancy.createdById === auth.user.id || auth.user.isPrimaryAdmin) && <form action={assignResponsibleHrAction} className="flex gap-2"><input type="hidden" name="vacancyId" value={vacancy.id} /><select className="input" name="responsibleHrUserId" required defaultValue={vacancy.responsibleHrUserId ?? ""}><option value="">Assign responsible HR person</option>{users.filter(item => item.roles.some(({ role }) => ["ADMIN", "HR_ADMIN"].includes(role.key))).map(item => <option key={item.id} value={item.id}>{item.email}</option>)}</select><button className="btn">Save HR owner</button></form>}
        {vacancy.createdById === auth.user.id && <details className="mt-3"><summary>Approval delegation</summary>
          <p>Selected delegates may approve individually for this vacancy only.</p>
          <form action={vacancyDelegationAction} className="grid gap-2">
            <input type="hidden" name="vacancyId" value={vacancy.id} />
            <label>Reason for absence<textarea name="reason" required maxLength={2000} className="input" /></label>
            {vacancy.hiringTeam.members.map(member => <label key={member.id}><input type="checkbox" name="delegateUserIds" value={member.userId} defaultChecked={vacancy.delegations.some(d => d.delegateUserId === member.userId)} /> {member.user.email}</label>)}
            <button className="btn">Save selected delegates</button>
          </form>
          {vacancy.delegations.length > 0 && <form action={vacancyDelegationAction}><input type="hidden" name="vacancyId" value={vacancy.id} /><input type="hidden" name="operation" value="end" /><button className="btn">End delegation</button></form>}
        </details>}
        <div className="mt-4 flex flex-wrap gap-3">
          {recruitmentTransitionMaps.vacancy[vacancy.status].map((next) => {
            const permission = next === "PENDING_APPROVAL" ? "vacancy.submit" : ["APPROVED","RETURNED_FOR_CORRECTION"].includes(next) ? "vacancy.approve" : ["OPEN","SCHEDULED"].includes(next) ? "vacancy.publish" : next === "PAUSED" ? "vacancy.pause" : next === "FILLED" ? "vacancy.fill" : next === "CANCELLED" ? "vacancy.cancel" : "vacancy.close";
            return auth.permissions.has(permission) ? <VacancyTransitionForm
              vacancyId={vacancy.id}
              expectedVersion={vacancy.version}
              to={next}
              key={next}
            /> : null;
          })}
        </div>
      </article>)}
    </section>
  </main>;
}
