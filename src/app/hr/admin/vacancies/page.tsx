import { requirePermission } from "@/lib/hr/permissions/authorize";
import { prisma } from "@/lib/prisma";
import { recruitmentTransitionMaps } from "@/lib/hr/recruitment/states";
import { createVacancyAction, transitionVacancyAction } from "./actions";

export default async function VacanciesPage() {
  const auth = await requirePermission("vacancy.view");
  const [vacancies, departments, hiringTeams, users] = await Promise.all([
    prisma.hrVacancy.findMany({
      where: { organizationId: auth.user.organizationId },
      include: { department: true, hiringTeam: true, responsibleHrTeam: true, vacancyOwner: true },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.hrDepartment.findMany({ where: { organizationId: auth.user.organizationId, status: "ACTIVE" }, orderBy: { name: "asc" } }),
    prisma.hrHiringTeam.findMany({ where: { organizationId: auth.user.organizationId, status: "ACTIVE" }, orderBy: { name: "asc" } }),
    prisma.hrUser.findMany({ where: { organizationId: auth.user.organizationId, status: "ACTIVE" }, orderBy: { email: "asc" } }),
  ]);

  return <main>
    <p className="text-sm font-bold uppercase tracking-widest text-teal-700">Recruitment administration</p>
    <h1 className="mt-2 text-3xl font-bold">Vacancies</h1>
    <p className="mt-2 text-slate-600">Only approved, explicitly published vacancies become visible on the public Careers page.</p>

    {auth.permissions.has("vacancy.create") ? <form action={createVacancyAction} className="mt-7 grid gap-3 rounded-2xl border bg-white p-5 md:grid-cols-2">
      <h2 className="text-xl font-bold md:col-span-2">Create vacancy</h2>
      <input className="input" name="title" placeholder="Job title" required />
      <select className="input" name="departmentId" required><option value="">Department</option>{departments.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select>
      <select className="input" name="hiringTeamId" required><option value="">Hiring Team</option>{hiringTeams.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select>
      <select className="input" name="responsibleHrTeamId" required><option value="">Responsible HR team</option>{hiringTeams.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select>
      <select className="input" name="vacancyOwnerId" required><option value="">Vacancy owner</option>{users.map((item) => <option value={item.id} key={item.id}>{item.email}</option>)}</select>
      <select className="input" name="hiringManagerId"><option value="">Hiring manager (optional)</option>{users.map((item) => <option value={item.id} key={item.id}>{item.email}</option>)}</select>
      <select className="input" name="employmentType" required>{["FULL_TIME","PART_TIME","CONTRACT","INTERN","TEMPORARY"].map((item) => <option key={item}>{item.replaceAll("_", " ")}</option>)}</select>
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
        <div className="mt-4 flex flex-wrap gap-3">
          {recruitmentTransitionMaps.vacancy[vacancy.status].map((next) => {
            const permission = next === "PENDING_APPROVAL" ? "vacancy.submit" : ["APPROVED","RETURNED_FOR_CORRECTION"].includes(next) ? "vacancy.approve" : ["OPEN","SCHEDULED"].includes(next) ? "vacancy.publish" : next === "PAUSED" ? "vacancy.pause" : next === "FILLED" ? "vacancy.fill" : next === "CANCELLED" ? "vacancy.cancel" : "vacancy.close";
            return auth.permissions.has(permission) ? <form action={transitionVacancyAction} className="flex gap-2" key={next}>
              <input type="hidden" name="vacancyId" value={vacancy.id} /><input type="hidden" name="expectedVersion" value={vacancy.version} /><input type="hidden" name="to" value={next} />
              <input className="input" name="reason" placeholder={`Reason for ${next.toLowerCase()}`} required minLength={3} />
              <button className="btn btn-secondary">{next.replaceAll("_", " ")}</button>
            </form> : null;
          })}
        </div>
      </article>)}
    </section>
  </main>;
}
