export const dynamic = "force-dynamic";

const head = process.env.RENDER_GIT_COMMIT ?? "local implementation working tree";
const items = [
  ["Environment", "Development implementation — production untouched"],
  ["Branch", "feature/hrms-unit-08-compensation-rewards-blueprint"],
  ["HEAD SHA", head],
  ["8A–8F", "Foundation implementation in progress: architecture, history, budgets, decisions, rewards, privacy and handoff"],
  ["Tests", "Focused Unit 8 validation in progress; baseline was 723/723"],
  ["Migrations", "43 existing migrations + 2 additive Unit 8 migrations pending staging validation"],
  ["Owner decisions", "Approved defaults locked into implementation"],
  ["Blockers", "None at the local implementation checkpoint"],
  ["Next gate", "Complete local release suite, then staging identity preflight and additive migration"],
] as const;

export default function Unit8StatusPage() {
  return <main><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-sm font-semibold uppercase tracking-[0.18em] text-indigo-700">Implementation status</p><h1 className="mt-2 text-3xl font-bold text-slate-950">Unit 8 — Compensation &amp; Rewards Management</h1><p className="mt-2 max-w-3xl text-slate-600">Non-sensitive engineering status. No individual compensation data appears here.</p></div><span className="rounded-full bg-blue-100 px-4 py-2 text-sm font-bold text-blue-950">IMPLEMENTING</span></div><section className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{items.map(([label,value]) => <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" key={label}><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p><p className="mt-2 font-semibold text-slate-900">{value}</p></article>)}</section><section className="mt-6 rounded-2xl border border-indigo-200 bg-indigo-50 p-5"><h2 className="font-bold text-indigo-950">Current gate</h2><p className="mt-2 text-sm font-semibold text-indigo-900">LOCAL FOUNDATION AND PRIVACY VALIDATION</p><p className="mt-2 text-sm text-indigo-900">Production remains untouched. Staging follows only after the local release suite passes.</p></section></main>;
}
