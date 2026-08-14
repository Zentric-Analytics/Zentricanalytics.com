export const dynamic = "force-dynamic";

const head = process.env.RENDER_GIT_COMMIT ?? "local implementation working tree";
const items = [
  ["Environment", "Implementation branch — staging deployment not started; production untouched"],
  ["Branch", "feature/hrms-unit-09-global-payroll-implementation"],
  ["HEAD SHA", head],
  ["Unit 9A", "IN PROGRESS — jurisdiction, certification, pay-group, calendar and regulatory foundations"],
  ["Unit 9B", "PENDING — input certification, cutoff and frozen snapshots"],
  ["Unit 9C–9F", "PENDING — Nigeria PAYE, gross-to-net, reconciliation, finalization, retro and YTD"],
  ["Unit 9G–9J", "PENDING — payslips, payments, statutory outputs, Regulatory Watch and validation"],
  ["Migrations", "52 present locally: 51 validated baseline + 1 additive Unit 9 foundation migration"],
  ["Focused tests", "Unit 9 domain and compatibility checks running continuously"],
  ["Nigeria certification", "NOT CERTIFIED — finalization fails closed pending complete authoritative-source evidence"],
  ["Payment boundary", "Canonical export/simulation only; no real money movement authorized"],
  ["Production", "Untouched and out of scope"],
] as const;

export default function Unit9StatusPage() {
  return <main><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-sm font-semibold uppercase tracking-[0.18em] text-indigo-700">Implementation status</p><h1 className="mt-2 text-3xl font-bold text-slate-950">Unit 9 — Nigeria Payroll &amp; Global Payroll Foundation</h1><p className="mt-2 max-w-3xl text-slate-600">Non-sensitive engineering status. Payroll, tax and payment data are never displayed here.</p></div><span className="rounded-full bg-amber-100 px-4 py-2 text-sm font-bold text-amber-950">IMPLEMENTATION IN PROGRESS</span></div><section className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{items.map(([label,value]) => <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" key={label}><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p><p className="mt-2 font-semibold text-slate-900">{value}</p></article>)}</section><section className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-5"><h2 className="font-bold text-amber-950">Current release gate</h2><p className="mt-2 text-sm text-amber-900">Complete Unit 9A persistence and real PostgreSQL migration validation before starting frozen-input orchestration. No readiness verdict has been issued.</p></section></main>;
}
