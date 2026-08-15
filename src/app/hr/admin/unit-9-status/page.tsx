export const dynamic = "force-dynamic";

const head = process.env.RENDER_GIT_COMMIT ?? "local development candidate";
const items = [
  ["Environment", "Staging only — production untouched"],
  ["Branch", "dev"],
  ["HEAD SHA", head],
  ["Unit 9A–9F", "IMPLEMENTED — governed inputs, calculation, reconciliation, approval, finalization, retro and YTD"],
  ["Unit 9G–9J", "IMPLEMENTED — payslips, simulated payments, accounting, statutory outputs and Regulatory Watch"],
  ["Migrations", "54 applied — none pending on staging"],
  ["Automated suite", "808 / 808 passing across 73 files"],
  ["Nigeria certification", "NOT CERTIFIED — official finalization remains fail-closed pending complete legal evidence"],
  ["Payment boundary", "Export and simulated settlement only; no real money movement"],
  ["Current workflow", "Nigeria certification evidence package ready for qualified compliance review"],
  ["Passed staging evidence", "Lifecycle fail-closed, scoped payment roles, privacy-safe 403s, PostgreSQL concurrency, integrity, Regulatory Watch and 250-operation load smoke"],
  ["Defects fixed", "Migration BOM, resource-heavy live runner, fixture currency mismatch, and legal-rejection evidence matcher"],
  ["Next release gate", "Qualified reviewer decisions on 15 rule rows and 8 questions, followed by separate independent certification"],
] as const;

export default function Unit9StatusPage() {
  return <main><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-sm font-semibold uppercase tracking-[0.18em] text-indigo-700">Staging validation status</p><h1 className="mt-2 text-3xl font-bold text-slate-950">Unit 9 — Nigeria Payroll &amp; Global Payroll Foundation</h1><p className="mt-2 max-w-3xl text-slate-600">Non-sensitive release evidence only. Payroll, tax, bank and payment data are never displayed here.</p></div><span className="rounded-full bg-amber-100 px-4 py-2 text-sm font-bold text-amber-950">STAGING VALIDATION IN PROGRESS</span></div><section className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{items.map(([label,value]) => <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" key={label}><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p><p className="mt-2 font-semibold text-slate-900">{value}</p></article>)}</section><section className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-5"><h2 className="font-bold text-amber-950">Fail-closed certification boundary</h2><p className="mt-2 text-sm text-amber-900">Nigeria payroll is not certified. Engineering and simulation gates continue, but an official payroll run cannot finalize until every calculation-driving rule has authoritative evidence, effective dates, tests, independent review and certification approval.</p></section></main>;
}
