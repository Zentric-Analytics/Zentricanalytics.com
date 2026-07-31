import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/hr/permissions/authorize";
import { evaluateHandoverEligibility } from "@/lib/hr/recruitment/handover";
import { recruitmentTransitionMaps, type HandoverStatus } from "@/lib/hr/recruitment/states";
import { prisma } from "@/lib/prisma";
import { HandoverActionForm } from "./HandoverActionForm";

const label = (value: string) => value.replaceAll("_", " ");

export default async function HandoverPage({ params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission("handover.view");
  const { id } = await params;
  const organizationId = auth.user.organizationId;
  const handover = await prisma.hrRecruitmentHandover.findFirst({
    where: { id, organizationId },
    include: {
      offerAcceptance: { include: { offer: { include: { acceptedVersion: true } } } },
      requirements: true,
      documentReviews: true,
      conversion: true,
    },
  });
  if (!handover) notFound();
  const [application, definitions, users, eligibility, audits] = await Promise.all([
    prisma.jobApplication.findFirst({ where: { id: handover.applicationId, organizationId }, include: { applicant: true, documents: true } }),
    prisma.hrRecruitmentRequirementDefinition.findMany({ where: { organizationId } }),
    prisma.hrUser.findMany({ where: { organizationId, status: "ACTIVE" }, orderBy: { email: "asc" } }),
    prisma.$transaction((tx) => evaluateHandoverEligibility(tx, organizationId, handover.id)),
    prisma.hrAuditEvent.findMany({ where: { organizationId, OR: [{ entityId: handover.id }, { entityType: { in: ["HrRecruitmentRequirement", "HrRecruitmentDocumentReview"] } }] }, orderBy: { createdAt: "desc" }, take: 50 }),
  ]);
  if (!application) notFound();
  const accepted = handover.offerAcceptance.offer.acceptedVersion;
  const current = handover.status as HandoverStatus;
  return <main className="space-y-7">
    <header><p className="text-sm font-bold uppercase tracking-widest text-teal-700">HR handover</p><h1 className="mt-2 text-3xl font-bold">{application.applicant.fullName}</h1><p className="mt-2 text-slate-600">{application.applicant.applicantNumber} · {application.applicationReference} · {label(handover.status)} · v{handover.version}</p></header>
    <section className={`rounded-2xl border p-5 ${eligibility.eligible ? "border-emerald-300 bg-emerald-50" : "border-amber-300 bg-amber-50"}`}>
      <h2 className="text-xl font-bold">Pre-hire eligibility: {eligibility.eligible ? "ELIGIBLE" : "BLOCKED"}</h2>
      {eligibility.blockers.length ? <ul className="mt-2 list-disc pl-5 text-sm">{eligibility.blockers.map((blocker) => <li key={blocker}>{blocker}</li>)}</ul> : <p className="mt-2 text-sm">All current conversion gates pass.</p>}
    </section>
    <div className="grid gap-5 xl:grid-cols-2">
      <section className="rounded-2xl border bg-white p-5"><h2 className="text-xl font-bold">Accepted exact offer</h2>{accepted ? <dl className="mt-3 grid gap-2 sm:grid-cols-2"><Info name="Version" value={`v${accepted.version}`} /><Info name="Role" value={accepted.positionTitle} /><Info name="Department" value={accepted.departmentId} /><Info name="Legal entity" value={accepted.legalEntityId} /><Info name="Start date" value={accepted.startDate.toLocaleDateString()} /><Info name="Compensation" value={`${accepted.currency} ${accepted.salary.toString()} ${accepted.payFrequency}`} /></dl> : <p>Accepted version missing.</p>}</section>
      <section className="rounded-2xl border bg-white p-5"><h2 className="text-xl font-bold">Handover controls</h2><div className="mt-3 space-y-3">
        {recruitmentTransitionMaps.handover[current].filter((to) => to !== "CONVERTED_TO_PRE_HIRE").map((to) => <HandoverActionForm label={label(to)} key={to}>
          <input type="hidden" name="operation" value="TRANSITION" /><input type="hidden" name="handoverId" value={handover.id} /><input type="hidden" name="expectedVersion" value={handover.version} /><input type="hidden" name="to" value={to} /><input className="input w-full" name="reason" placeholder="Required reason" required />
        </HandoverActionForm>)}
        <HandoverActionForm label="Reassign HR owner"><input type="hidden" name="operation" value="REASSIGN" /><input type="hidden" name="handoverId" value={handover.id} /><input type="hidden" name="expectedVersion" value={handover.version} /><select className="input w-full" name="ownerUserId" required><option value="">Active HR owner</option>{users.map((user) => <option value={user.id} key={user.id}>{user.email}</option>)}</select><input className="input w-full" name="reason" placeholder="Reassignment reason" required /></HandoverActionForm>
        {handover.status === "APPROVED" && !handover.conversion ? <HandoverActionForm label="Approve and create PRE_HIRE"><input type="hidden" name="operation" value="CONVERT" /><input type="hidden" name="handoverId" value={handover.id} /></HandoverActionForm> : null}
        {handover.conversion ? <Link className="font-bold text-teal-700" href={`/hr/admin/onboarding/${handover.conversion.employeeId}`}>Open generated onboarding workspace</Link> : null}
      </div></section>
    </div>
    <section><h2 className="text-xl font-bold">Blocking requirements</h2><div className="mt-3 grid gap-3 xl:grid-cols-2">{handover.requirements.map((requirement) => {
      const definition = definitions.find((item) => item.id === requirement.definitionId);
      return <article className="rounded-2xl border bg-white p-4" key={requirement.id}><strong>{definition?.name ?? requirement.definitionId}</strong><p className="text-sm text-slate-600">{requirement.blocking ? "Blocking" : "Non-blocking"} · {label(requirement.status)} · v{requirement.version}</p><HandoverActionForm label="Update requirement"><input type="hidden" name="operation" value="REQUIREMENT" /><input type="hidden" name="handoverId" value={handover.id} /><input type="hidden" name="requirementId" value={requirement.id} /><input type="hidden" name="expectedVersion" value={requirement.version} /><select className="input w-full" name="to"><option>PENDING_SUBMISSION</option><option>SUBMITTED</option><option>UNDER_REVIEW</option><option>VERIFIED</option><option>REJECTED</option><option>WAIVED</option></select><input className="input w-full" name="reason" placeholder="Evidence, decision, or waiver reason" required /></HandoverActionForm></article>;
    })}</div></section>
    <section><h2 className="text-xl font-bold">Documents and exact review decisions</h2><div className="mt-3 grid gap-3 xl:grid-cols-2">{application.documents.map((document) => {
      const review = handover.documentReviews.find((item) => item.uploadedDocumentId === document.id && item.reviewScope === "HR");
      return <article className="rounded-2xl border bg-white p-4" key={document.id}><strong>{document.kind}: {document.fileName}</strong><p className="text-sm text-slate-600">{document.mimeType} · {document.sizeBytes} bytes · exact version {review?.documentVersion ?? 1} · {review?.status ?? "PENDING"}</p><HandoverActionForm label="Record document decision"><input type="hidden" name="operation" value="DOCUMENT" /><input type="hidden" name="handoverId" value={handover.id} /><input type="hidden" name="uploadedDocumentId" value={document.id} /><input type="hidden" name="documentVersion" value={review?.documentVersion ?? 1} /><select className="input w-full" name="decision"><option>VERIFIED</option><option>REJECTED</option><option>REPLACEMENT_REQUESTED</option></select><input className="input w-full" name="reason" placeholder="Verification notes or applicant-visible replacement reason" /></HandoverActionForm></article>;
    })}</div></section>
    <section><h2 className="text-xl font-bold">Governance history</h2>{audits.map((audit) => <article className="mt-2 rounded-xl border bg-white p-3" key={audit.id}><strong>{audit.action}</strong><p className="text-sm text-slate-600">{audit.createdAt.toLocaleString()} · correlation {audit.correlationId ?? "not recorded"}</p></article>)}</section>
  </main>;
}

function Info({ name, value }: { name: string; value: string }) { return <div><dt className="text-sm text-slate-500">{name}</dt><dd>{value}</dd></div>; }
