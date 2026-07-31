import Link from "next/link";
import { requireAnyPermission } from "@/lib/hr/permissions/authorize";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const label = (value: string | null) => (value ?? "UNCLASSIFIED").replaceAll("_", " ");

export default async function RecruitmentWorkspace() {
  const auth = await requireAnyPermission(["application.view", "handover.view", "onboarding.view", "recruitment.admin"]);
  const organizationId = auth.user.organizationId;
  const [applications, interviews, handovers, preHires] = await Promise.all([
    prisma.jobApplication.findMany({
      where: { organizationId, recruitmentStatus: { not: null } },
      include: { applicant: true },
      orderBy: { updatedAt: "desc" },
      take: 100,
    }),
    prisma.hrInterview.findMany({
      where: { organizationId },
      orderBy: { startsAt: "asc" },
      take: 50,
    }),
    prisma.hrRecruitmentHandover.findMany({
      where: { organizationId },
      include: { requirements: true, documentReviews: true },
      orderBy: { updatedAt: "desc" },
      take: 100,
    }),
    prisma.hrEmployee.findMany({
      where: { organizationId, employmentStatus: { in: ["PRE_HIRE", "READY_FOR_START", "ON_HOLD"] } },
      include: {
        lifecycleInstances: {
          where: { type: "ONBOARDING" },
          include: { tasks: true },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
      orderBy: { startDate: "asc" },
    }),
  ]);
  return <main>
    <p className="text-sm font-bold uppercase tracking-widest text-teal-700">Connected hiring lifecycle</p>
    <h1 className="mt-2 text-3xl font-bold">Recruitment and pre-hire workspace</h1>
    <p className="mt-2 text-slate-600">Review applications, interview schedules, HR handovers, blocking requirements, and start readiness without losing recruitment history.</p>

    <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {[
        ["Applications", applications.length],
        ["Upcoming interviews", interviews.filter((item) => item.status === "SCHEDULED").length],
        ["HR handovers", handovers.length],
        ["Pre-hires", preHires.length],
      ].map(([title, value]) => <article className="rounded-2xl border bg-white p-5" key={title}>
        <p className="text-sm text-slate-600">{title}</p><p className="mt-1 text-3xl font-bold">{value}</p>
      </article>)}
    </div>

    <section className="mt-7">
      <h2 className="text-xl font-bold">Application review queue</h2>
      <div className="mt-3 overflow-x-auto rounded-2xl border bg-white">
        <table className="w-full min-w-[760px] text-left text-sm"><thead><tr className="border-b bg-slate-50">
          {["Reference","Candidate","Role","Status","Updated","Action"].map((item) => <th className="p-3" key={item}>{item}</th>)}
        </tr></thead><tbody>{applications.map((application) => <tr className="border-b last:border-0" key={application.id}>
          <td className="p-3 font-semibold">{application.applicationReference}</td>
          <td className="p-3">{application.applicant.fullName}<br/><span className="text-slate-500">{application.applicant.email}</span></td>
          <td className="p-3">{application.roleAppliedFor}</td><td className="p-3">{label(application.recruitmentStatus)}</td>
          <td className="p-3">{application.updatedAt.toLocaleString()}</td>
          <td className="p-3"><Link className="font-bold text-teal-700" href={`/hr/admin/applications/${application.id}`}>Review application</Link></td>
        </tr>)}</tbody></table>
        {!applications.length ? <p className="p-5 text-slate-600">No governed applications have been submitted yet.</p> : null}
      </div>
    </section>

    <section className="mt-7 grid gap-5 xl:grid-cols-2">
      <div><h2 className="text-xl font-bold">HR handovers</h2><div className="mt-3 space-y-3">
        {handovers.map((handover) => {
          const blocking = handover.requirements.filter((item) => item.blocking && !["VERIFIED","WAIVED"].includes(item.status)).length;
          const documents = handover.documentReviews.filter((item) => item.reviewScope === "HR" && item.status !== "VERIFIED").length;
          return <article className="rounded-2xl border bg-white p-4" key={handover.id}><div className="flex justify-between gap-3"><strong>{label(handover.status)}</strong><span>v{handover.version}</span></div><p className="mt-2 text-sm text-slate-600">{blocking} blocking requirements · {documents} document actions</p></article>;
        })}
        {!handovers.length ? <p className="rounded-2xl border bg-white p-5 text-slate-600">No accepted offers await HR handover.</p> : null}
      </div></div>
      <div><h2 className="text-xl font-bold">Pre-hire readiness</h2><div className="mt-3 space-y-3">
        {preHires.map((employee) => {
          const tasks = employee.lifecycleInstances[0]?.tasks ?? [];
          const complete = tasks.filter((task) => task.status === "COMPLETED").length;
          return <article className="rounded-2xl border bg-white p-4" key={employee.id}><div className="flex justify-between gap-3"><strong>{employee.legalFirstName} {employee.lastName}</strong><span>{label(employee.employmentStatus)}</span></div><p className="mt-2 text-sm text-slate-600">{employee.employeeNumber} · starts {employee.startDate?.toLocaleDateString() ?? "not set"} · {complete}/{tasks.length} onboarding tasks complete</p></article>;
        })}
        {!preHires.length ? <p className="rounded-2xl border bg-white p-5 text-slate-600">No pre-hires are awaiting start readiness.</p> : null}
      </div></div>
    </section>
  </main>;
}
