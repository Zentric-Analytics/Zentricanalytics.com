export const dynamic = "force-dynamic";

const deployedHead = process.env.RENDER_GIT_COMMIT ?? "local working tree";
const deploymentId = process.env.RENDER ? "Render staging — exact SHA shown above" : "local validation";

const items = [
  ["Environment", "Development / staging only — production untouched"],
  ["Branch", "feature/hrms-unit-07-performance-career-blueprint"],
  ["HEAD SHA", deployedHead],
  ["Deployment", deploymentId],
  ["Current subsection", "7A–7F release closure complete"],
  ["Database / migrations", "43 migrations applied to staging and isolated restore; none pending"],
  ["Automated tests", "721/721 passing; TypeScript, ESLint, Prisma and production build passed"],
  ["Durable archive", "779a86473028 — encrypted, checksummed, remotely retrieved"],
  ["Restore correlation", "PostgreSQL 18 Basic-256 MB / 1 GB; RTO 14.703s; zero duplicates, orphans or overlaps"],
  ["Lineage", "Person → review/calibration → readiness → promotion → Unit 4 event → assignment → outbox → audit PASS"],
  ["Cleanup", "Plaintext removed; restore secret and temporary database deleted; temporary ongoing cost zero"],
  ["Next release gate", "Separate owner authorization for Unit 7 production release"],
] as const;

export default function Unit7StatusPage() {
  return <main><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-700">Staging release status</p><h1 className="mt-2 text-3xl font-bold text-slate-950">Unit 7 — Performance, Goals, Career Development &amp; Promotion Readiness</h1><p className="mt-2 max-w-3xl text-slate-600">Final staging evidence for the validated Unit 7 candidate. Production was not accessed or modified.</p></div><span className="rounded-full bg-emerald-100 px-4 py-2 text-sm font-bold text-emerald-900">PASS</span></div><section className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3" aria-label="Unit 7 staging release status">{items.map(([label, value]) => <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" key={label}><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p><p className="mt-2 font-semibold text-slate-900">{value}</p></article>)}</section><section className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-5"><h2 className="font-bold text-emerald-950">Final verdict</h2><p className="mt-2 text-sm font-semibold text-emerald-900">PASS — Unit 7 Production Ready</p><p className="mt-2 text-sm text-emerald-900">This is a staging-readiness verdict only. Production deployment requires separate owner authorization.</p></section></main>;
}
