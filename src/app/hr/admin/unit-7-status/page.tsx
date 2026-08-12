const deployedHead = process.env.RENDER_GIT_COMMIT ?? "local — see Git HEAD";
const environment = process.env.APP_ENV ?? (process.env.RENDER_SERVICE_ID ? "render" : "local");

const items = [
  ["Environment", `${environment} — blueprint only; production untouched`],
  ["Branch", "feature/hrms-unit-07-performance-career-blueprint"],
  ["HEAD SHA", deployedHead],
  ["Current phase", "Repository audit and Unit 7A–7F production architecture blueprint complete"],
  ["Repository audit", "Workforce identity, job masters, workflows, Unit 4 promotion execution, permissions, audit, outbox, workers, locking, and recovery patterns classified"],
  ["7A–7F architecture", "Job expectations; goals/evidence/feedback; reviews/calibration; development; promotion readiness/cases; automation/governance/recovery"],
  ["Tests", "Blueprint/status regression checks only; no Unit 7 runtime validation is claimed"],
  ["Owner decisions", "Level visibility, ratings, cadence, feedback privacy, calibration, readiness, promotion workflow, development ownership, and retention remain approval gates"],
  ["Blockers", "No technical blueprint blocker; broad implementation requires separate owner approval"],
  ["Next gate", "Owner review and explicit Unit 7 implementation authorization"],
] as const;

export default function Unit7StatusPage() {
  return <main><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-sm font-semibold uppercase tracking-[0.18em] text-indigo-700">Architecture status</p><h1 className="mt-2 text-3xl font-bold text-slate-950">Unit 7 — Performance, Goals, Career Development &amp; Promotion Readiness</h1><p className="mt-2 max-w-3xl text-slate-600">Repository audit and architecture only. No Unit 7 migrations, runtime implementation, staging deployment, or production change is authorized by this page.</p></div><span className="rounded-full bg-indigo-100 px-4 py-2 text-sm font-bold text-indigo-900">BLUEPRINT COMPLETE</span></div><section className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3" aria-label="Unit 7 blueprint status">{items.map(([label, value]) => <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" key={label}><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p><p className="mt-2 font-semibold text-slate-900">{value}</p></article>)}</section><section className="mt-6 rounded-2xl border border-indigo-200 bg-indigo-50 p-5"><h2 className="font-bold text-indigo-950">Current verdict</h2><p className="mt-2 text-sm font-semibold text-indigo-900">UNIT 7 BLUEPRINT COMPLETE — READY FOR IMPLEMENTATION APPROVAL</p><p className="mt-2 text-sm text-indigo-900">This is not a production-readiness verdict and does not authorize implementation or deployment.</p></section></main>;
}
