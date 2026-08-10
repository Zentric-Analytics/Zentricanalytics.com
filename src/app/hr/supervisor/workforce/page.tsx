import { forbidden } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAuthenticatedUser } from "@/lib/hr/permissions/authorize";
import { supervisedEmployeeIds } from "@/lib/hr/supervisors/scope";
import { requestTeamWorkforceEventAction } from "./actions";

export default async function SupervisorWorkforcePage() {
  const auth = await requireAuthenticatedUser();
  if (!auth.user.employee) forbidden();
  const employeeIds = await supervisedEmployeeIds(prisma, { organizationId: auth.user.organizationId, supervisorEmployeeId: auth.user.employee.id });
  const [employees, positions, locations, events] = await Promise.all([
    prisma.hrEmployee.findMany({ where: { organizationId: auth.user.organizationId, id: { in: employeeIds } }, orderBy: { legalFirstName: "asc" } }),
    prisma.hrPosition.findMany({ where: { organizationId: auth.user.organizationId, status: "ACTIVE" }, orderBy: { title: "asc" } }),
    prisma.hrLocation.findMany({ where: { organizationId: auth.user.organizationId, status: "ACTIVE" }, orderBy: { name: "asc" } }),
    prisma.hrWorkforceEvent.findMany({ where: { organizationId: auth.user.organizationId, employeeId: { in: employeeIds } }, include: { employee: true }, orderBy: { createdAt: "desc" }, take: 50 }),
  ]);
  return <><h1 className="text-3xl font-bold">Team workforce requests</h1><p className="mt-2 text-slate-600">Requests require the configured independent approval workflow.</p><section className="mt-6 rounded-2xl bg-white p-5"><form action={requestTeamWorkforceEventAction} className="grid gap-3 md:grid-cols-3"><select className="input" name="employeeId" required><option value="">Direct report</option>{employees.map((employee) => <option value={employee.id} key={employee.id}>{employee.legalFirstName} {employee.lastName}</option>)}</select><select className="input" name="type"><option>PROMOTION</option><option>TRANSFER</option><option>POSITION_CHANGE</option><option>MANAGER_CHANGE</option><option>LOCATION_CHANGE</option><option>WORK_ARRANGEMENT_CHANGE</option></select><input className="input" name="requestedEffectiveAt" type="date" required/><select className="input" name="positionId"><option value="">Position unchanged</option>{positions.map((position) => <option value={position.id} key={position.id}>{position.title}</option>)}</select><select className="input" name="managerEmployeeId"><option value="">Manager unchanged</option>{employees.map((employee) => <option value={employee.id} key={employee.id}>{employee.legalFirstName} {employee.lastName}</option>)}</select><select className="input" name="locationId"><option value="">Location unchanged</option>{locations.map((location) => <option value={location.id} key={location.id}>{location.name}</option>)}</select><select className="input" name="workMode"><option value="">Work mode unchanged</option><option>ONSITE</option><option>HYBRID</option><option>REMOTE</option></select><input className="input md:col-span-2" name="reason" placeholder="Business reason" required/><button className="btn btn-primary">Submit request</button></form></section><section className="mt-6 space-y-3">{events.map((event) => <article className="rounded-xl bg-white p-4" key={event.id}><strong>{event.type}</strong> · {event.employee.legalFirstName} {event.employee.lastName}<span className="float-right">{event.status}</span><p className="mt-2 text-sm text-slate-600">Effective {event.requestedEffectiveAt.toLocaleDateString()} · {event.reason}</p></article>)}</section></>;
}
