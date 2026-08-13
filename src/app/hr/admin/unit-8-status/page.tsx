export const dynamic = "force-dynamic";

const head = process.env.RENDER_GIT_COMMIT ?? "local blueprint working tree";

const items = [
  ["Environment", "Development blueprint only — staging and production untouched"],
  ["Branch", "feature/hrms-unit-08-compensation-rewards-blueprint"],
  ["HEAD SHA", head],
  ["Audit phase", "Units 1–7 repository audit complete"],
  ["8A–8F", "Architecture defined; runtime implementation not started"],
  ["Tests", "723/723 passing; TypeScript, ESLint, Prisma and production build passed"],
  ["Migrations", "43 existing migrations; no Unit 8 runtime migration created"],
  ["Owner decisions", "18 compensation-policy decisions awaiting approval"],
  ["Blockers", "Implementation approval and owner policy decisions"],
  ["Next gate", "Owner approval of the Unit 8 blueprint"],
] as const;

export default function Unit8StatusPage() {
  return <main><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-sm font-semibold uppercase tracking-[0.18em] text-indigo-700">Architecture blueprint</p><h1 className="mt-2 text-3xl font-bold text-slate-950">Unit 8 — Compensation &amp; Rewards Management</h1><p className="mt-2 max-w-3xl text-slate-600">Non-sensitive architecture status. No individual compensation data appears on this page.</p></div><span className="rounded-full bg-amber-100 px-4 py-2 text-sm font-bold text-amber-950">AWAITING OWNER APPROVAL</span></div><section className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3" aria-label="Unit 8 blueprint status">{items.map(([label,value]) => <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" key={label}><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p><p className="mt-2 font-semibold text-slate-900">{value}</p></article>)}</section><section className="mt-6 rounded-2xl border border-indigo-200 bg-indigo-50 p-5"><h2 className="font-bold text-indigo-950">Current gate</h2><p className="mt-2 text-sm font-semibold text-indigo-900">UNIT 8 BLUEPRINT COMPLETE — READY FOR IMPLEMENTATION APPROVAL</p><p className="mt-2 text-sm text-indigo-900">No Unit 8 runtime implementation, migration, staging deployment, or production change is authorized by this status.</p></section></main>;
}
