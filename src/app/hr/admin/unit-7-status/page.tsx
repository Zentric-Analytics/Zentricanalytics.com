export const dynamic = "force-dynamic";

const deployedHead = process.env.RENDER_GIT_COMMIT ?? "local working tree";
const deploymentId = process.env.RENDER ? "Render staging — exact SHA shown above" : "local validation";

const items = [
  ["Environment", "Development / staging only — production untouched"],
  ["Branch", "feature/hrms-unit-07-performance-career-blueprint"],
  ["HEAD SHA", deployedHead],
  ["Deployment", deploymentId],
  ["Current subsection", "Release closure — encrypted isolated restore"],
  ["Database / migrations", "43 migrations applied to staging PostgreSQL; none pending"],
  ["Automated tests", "717/717 passing across 65 files; TypeScript, ESLint, Prisma and production build passed"],
  ["Browser workflow", "Effective promotion and 16-case PostgreSQL race matrix passed; restore target safely deleted after archive retrieval blocked"],
  ["Defects found", "Approved archive 6a30e21b4372 was instance-local and unavailable after deployment; remote archive configuration was incomplete"],
  ["Fixes applied", "Unit 7 restore targets are now guarded and supported; temporary secret and paid restore database were removed"],
  ["Next release gate", "Create and approve a durable encrypted archive, then repeat isolated restore correlation"],
] as const;

export default function Unit7StatusPage() {
  return <main><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-sm font-semibold uppercase tracking-[0.18em] text-indigo-700">Implementation status</p><h1 className="mt-2 text-3xl font-bold text-slate-950">Unit 7 — Performance, Goals, Career Development &amp; Promotion Readiness</h1><p className="mt-2 max-w-3xl text-slate-600">Live engineering checkpoint for the staging-only Unit 7 implementation. This page does not claim release readiness.</p></div><span className="rounded-full bg-amber-100 px-4 py-2 text-sm font-bold text-amber-900">RESTORE BLOCKED</span></div><section className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3" aria-label="Unit 7 implementation status">{items.map(([label, value]) => <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" key={label}><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p><p className="mt-2 font-semibold text-slate-900">{value}</p></article>)}</section><section className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-5"><h2 className="font-bold text-amber-950">Current verdict</h2><p className="mt-2 text-sm font-semibold text-amber-900">BLOCKED — UNIT 7 IS NOT YET PRODUCTION READY</p><p className="mt-2 text-sm text-amber-900">Production remains frozen. A durable encrypted archive must complete isolated restore correlation before PASS.</p></section></main>;
}
