export const dynamic = "force-dynamic";

const head = process.env.RENDER_GIT_COMMIT ?? "local development candidate";
const items = [
  ["Environment", "Staging only — production untouched"],
  ["Branch", "dev"],
  ["HEAD SHA", head],
  ["Unit 9A–9F", "IMPLEMENTED — governed inputs, calculation, reconciliation, approval, finalization, retro and YTD"],
  ["Unit 9G–9J", "IMPLEMENTED — payslips, simulated payments, accounting, statutory outputs and Regulatory Watch"],
  ["Migrations", "58 applied — none pending on staging"],
  ["Automated suite", "913 / 913 passing across 76 files"],
  ["Nigeria certification", "NOT CERTIFIED — official finalization remains fail-closed pending qualified review"],
  ["Payment boundary", "Export and simulated settlement only; no real money movement"],
  ["Current workflow", "NG-CANDIDATE-2026.2 final staging evidence and immutable Stage 1 package"],
  ["Passed staging evidence", "Prior-YTD/YTD/retro/acknowledgement/amendment concurrency, fail-closed certification, privacy-safe 403s and PostgreSQL immutability"],
  ["Defects fixed", "Candidate-aware migration gate plus prior Unit 9 staging remediations"],
  ["Next release gate", "New qualified Stage 1 compliance review; candidate remains NOT CERTIFIED"],
] as const;

export default function Unit9StatusPage() {
  return <main><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-sm font-semibold uppercase tracking-[0.18em] text-indigo-700">Staging validation status</p><h1 className="mt-2 text-3xl font-bold text-slate-950">Unit 9 — Nigeria Payroll &amp; Global Payroll Foundation</h1><p className="mt-2 max-w-3xl text-slate-600">Non-sensitive release evidence only. Payroll, tax, bank and payment data are never displayed here.</p></div><span className="rounded-full bg-amber-100 px-4 py-2 text-sm font-bold text-amber-950">FINAL STAGING VALIDATION IN PROGRESS — NOT CERTIFIED</span></div><section className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{items.map(([label,value]) => <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" key={label}><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p><p className="mt-2 font-semibold text-slate-900">{value}</p></article>)}</section><section className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-5"><h2 className="font-bold text-amber-950">Fail-closed certification boundary</h2><p className="mt-2 text-sm text-amber-900">Nigeria payroll is not certified. Engineering and simulation evidence may be reviewed, but an official payroll run cannot finalize until every calculation-driving rule has authoritative evidence, effective dates, tests, qualified Stage 1 review and separate Stage 2 certification approval.</p></section></main>;
}
