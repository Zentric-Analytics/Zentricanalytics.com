import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/hr/permissions/authorize";
import { evaluateActivationReadiness } from "@/lib/hr/recruitment/states";
import { prisma } from "@/lib/prisma";
import { OnboardingActionForm } from "./OnboardingActionForm";

export default async function OnboardingPage({ params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission("onboarding.view");
  const { id } = await params;
  const organizationId = auth.user.organizationId;
  const [employee, users] = await Promise.all([
    prisma.hrEmployee.findFirst({
      where: { id, organizationId },
      include: {
        employmentAssignments: { where: { status: "ACTIVE" }, include: { department: true, position: true } },
        lifecycleInstances: { where: { type: "ONBOARDING" }, include: { tasks: { orderBy: { dueAt: "asc" } } }, orderBy: { createdAt: "desc" }, take: 1 },
        user: true,
      },
    }),
    prisma.hrUser.findMany({ where: { organizationId, status: "ACTIVE" }, orderBy: { email: "asc" } }),
  ]);
  if (!employee) notFound();
  const onboarding = employee.lifecycleInstances[0];
  if (!onboarding) notFound();
  const requiredComplete = onboarding.tasks.filter((task) => task.required).every((task) => task.status === "COMPLETED");
  const conversion = await prisma.hrPreHireConversion.findUnique({ where: { employeeId: employee.id } });
  const readiness = evaluateActivationReadiness({
    finalHrApprovalComplete: Boolean(conversion),
    blockingRequirementsComplete: requiredComplete,
    startDate: employee.startDate ?? new Date(8640000000000000),
    now: new Date(),
    securitySetupComplete: !employee.user || employee.user.mfaEnabled,
    activeAssignmentExists: employee.employmentAssignments.length > 0,
    cancelledOrOnHold: ["CANCELLED", "ON_HOLD"].includes(employee.employmentStatus),
  });
  const complete = onboarding.tasks.filter((task) => task.status === "COMPLETED").length;
  return <main className="space-y-7">
    <header><p className="text-sm font-bold uppercase tracking-widest text-teal-700">Pre-hire onboarding</p><h1 className="mt-2 text-3xl font-bold">{employee.legalFirstName} {employee.lastName}</h1><p className="mt-2 text-slate-600">{employee.employeeNumber} · {employee.employmentStatus} · starts {employee.startDate?.toLocaleDateString() ?? "not set"}</p></header>
    <section className={`rounded-2xl border p-5 ${readiness.ready ? "border-emerald-300 bg-emerald-50" : "border-amber-300 bg-amber-50"}`}><h2 className="text-xl font-bold">Activation readiness: {readiness.ready ? "READY" : "BLOCKED"}</h2><p className="mt-2 text-sm">{complete}/{onboarding.tasks.length} tasks completed · {onboarding.tasks.filter((task) => task.required && task.status !== "COMPLETED").length} blocking tasks remain</p>{readiness.blockers.length ? <ul className="mt-2 list-disc pl-5 text-sm">{readiness.blockers.map((blocker) => <li key={blocker}>{blocker}</li>)}</ul> : null}</section>
    <section className="grid gap-5 xl:grid-cols-2"><div className="rounded-2xl border bg-white p-5"><h2 className="text-xl font-bold">Employment assignment</h2>{employee.employmentAssignments.map((assignment) => <p className="mt-2 text-sm" key={assignment.id}>{assignment.position?.title ?? "Position"} · {assignment.department.name} · effective {assignment.effectiveFrom.toLocaleDateString()}</p>)}</div><div className="rounded-2xl border bg-white p-5"><h2 className="text-xl font-bold">Readiness controls</h2><div className="mt-3 grid gap-3 sm:grid-cols-2"><OnboardingActionForm label="Update pre-hire state"><input type="hidden" name="operation" value="STATE" /><input type="hidden" name="employeeId" value={employee.id} /><select className="input w-full" name="to"><option>ON_HOLD</option><option>PRE_HIRE</option><option>CANCELLED</option></select><input className="input w-full" name="startDate" type="date" /><input className="input w-full" name="reason" placeholder="Required reason" required /></OnboardingActionForm><OnboardingActionForm label="Activate employee and eligible user"><input type="hidden" name="operation" value="ACTIVATE" /><input type="hidden" name="employeeId" value={employee.id} /></OnboardingActionForm></div></div></section>
    <section><h2 className="text-xl font-bold">Onboarding tasks</h2><div className="mt-3 grid gap-3 xl:grid-cols-2">{onboarding.tasks.map((task) => <article className="rounded-2xl border bg-white p-4" key={task.id}><div className="flex justify-between gap-3"><strong>{task.title}</strong><span>{task.status}</span></div><p className="mt-2 text-sm text-slate-600">{task.ownerType} · due {task.dueAt.toLocaleString()} · {task.required ? "blocking" : "optional"}</p>{task.description ? <p className="mt-2 text-sm">{task.description}</p> : null}<OnboardingActionForm label="Update task"><input type="hidden" name="operation" value="TASK" /><input type="hidden" name="employeeId" value={employee.id} /><input type="hidden" name="taskId" value={task.id} /><select className="input w-full" name="to"><option>IN_PROGRESS</option><option>COMPLETED</option><option>PENDING</option><option>CANCELLED</option></select><select className="input w-full" name="assignedUserId"><option value="">Current or team owner</option>{users.map((user) => <option value={user.id} key={user.id}>{user.email}</option>)}</select><input className="input w-full" name="dueAt" type="datetime-local" /><input className="input w-full" name="evidenceReference" placeholder="Evidence reference or secure object key" /><textarea className="input w-full" name="notes" placeholder="Completion, reopen, or reassignment notes" required /></OnboardingActionForm></article>)}</div></section>
  </main>;
}
