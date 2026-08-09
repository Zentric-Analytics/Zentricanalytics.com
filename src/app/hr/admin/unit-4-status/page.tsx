const deployedHead = process.env.RENDER_GIT_COMMIT ?? "local candidate — see Git branch";
const statusItems = [
  ["Current Unit 4 subsection", "4C — Workforce Event Engine"],
  ["Current milestone", "Governed promotion, transfer, manager, position, grade, location, and legal-entity changes"],
  ["Branch", "feature/hrms-unit-04-workforce-operations"],
  ["HEAD SHA", deployedHead],
  ["Current staging deployment", "Units 1–3 staging baseline; Unit 4 candidate not deployed"],
  ["Database / migration", "Two additive Unit 4 migrations prepared; staging application pending"],
  ["Test totals", "558/558 passing at last full gate; TypeScript, ESLint, Prisma, and build passed"],
  ["Browser workflow", "Authenticated staging administrator; workforce-event UI awaits exact candidate deployment"],
  ["Defects found", "Legacy direct termination, incomplete supervisor mutation, and missing position-capacity revalidation"],
  ["Fixes applied", "Governed separation plus tenant, capacity, supervisor-history, approval, and execution protections"],
  ["Next release gate", "Authenticated staging deployment, migrations, browser E2E, concurrency, and restore"],
] as const;

export default function Unit4StatusPage() {
  return <main><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-sm font-semibold uppercase tracking-[0.18em] text-indigo-700">Live engineering status</p><h1 className="mt-2 text-3xl font-bold text-slate-950">Unit 4 — Workforce Operations</h1><p className="mt-2 max-w-3xl text-slate-600">Staging-only implementation. Units 1–3 production behavior remains frozen.</p></div><span className="rounded-full bg-amber-100 px-4 py-2 text-sm font-bold text-amber-900">IN PROGRESS</span></div>
    <section className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3" aria-label="Unit 4 implementation status">{statusItems.map(([label, value]) => <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" key={label}><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p><p className="mt-2 font-semibold text-slate-900">{value}</p></article>)}</section>
    <section className="mt-6 rounded-2xl border border-indigo-200 bg-indigo-50 p-5"><h2 className="font-bold text-indigo-950">Release boundary</h2><p className="mt-2 text-sm text-indigo-900">No Unit 4 production deployment is authorized. Production remains untouched.</p></section>
    <section className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-5"><h2 className="font-bold text-emerald-950">Staging identity verified</h2><p className="mt-2 text-sm text-emerald-900">Render Staging Workspace · Zentricanalytics.com-Staging · staging.zentricanalytics.com · PostgreSQL zentric_analytics_staging · staging-scoped storage and workers.</p></section></main>;
}
