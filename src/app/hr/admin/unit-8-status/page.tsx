export const dynamic = "force-dynamic";

const head = process.env.RENDER_GIT_COMMIT ?? "local implementation working tree";
const items = [
  ["Environment", "Staging validation — production untouched"],
  ["Branch", "feature/hrms-unit-08-compensation-rewards-blueprint"],
  ["HEAD SHA", head],
  ["Staging deployment", "dep-d9v1khbm8hqs73dsrdn0"],
  ["8A–8F", "Foundation implemented; live workflow, privacy, concurrency and recovery validation in progress"],
  ["Tests", "762/762 passing across 69 files; TypeScript, ESLint, Prisma and production build pass"],
  ["Migrations", "45 migrations applied to staging; none pending after immutable range-index remediation"],
  ["Owner decisions", "Approved defaults locked into implementation"],
  ["Defects fixed", "PostgreSQL exclusion now uses the immutable tsrange expression required by timestamp columns"],
  ["Blockers", "None; isolated paid restore target remains a later owner-approval boundary"],
  ["Next gate", "Legacy compensation compatibility, governed compensation lifecycle, privacy and real PostgreSQL concurrency"],
] as const;

export default function Unit8StatusPage() {
  return <main><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-sm font-semibold uppercase tracking-[0.18em] text-indigo-700">Implementation status</p><h1 className="mt-2 text-3xl font-bold text-slate-950">Unit 8 — Compensation &amp; Rewards Management</h1><p className="mt-2 max-w-3xl text-slate-600">Non-sensitive engineering status. No individual compensation data appears here.</p></div><span className="rounded-full bg-blue-100 px-4 py-2 text-sm font-bold text-blue-950">STAGING VALIDATION</span></div><section className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{items.map(([label,value]) => <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" key={label}><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p><p className="mt-2 font-semibold text-slate-900">{value}</p></article>)}</section><section className="mt-6 rounded-2xl border border-indigo-200 bg-indigo-50 p-5"><h2 className="font-bold text-indigo-950">Current gate</h2><p className="mt-2 text-sm font-semibold text-indigo-900">LIVE UNIT 8 LIFECYCLE AND DATA-INTEGRITY VALIDATION</p><p className="mt-2 text-sm text-indigo-900">Staging health and readiness pass. Production remains untouched.</p></section></main>;
}
