export const dynamic = "force-dynamic";

const head = process.env.RENDER_GIT_COMMIT ?? "local successor candidate";
const service = process.env.RENDER_SERVICE_ID ?? "local development service";
const items = [
  ["Environment", "Staging only — production untouched"],
  ["Candidate", "NG-CANDIDATE-2026.8 — NOT CERTIFIED"],
  ["Runtime SHA", head],
  ["Service", service],
  ["Certification boundary", "Persisted manifest + snapshot lineage; finalization and official outputs fail closed"],
  ["Genuine PostgreSQL concurrency", "Implementation-review evidence PASS; dev merge and staging application deployment pending"],
  ["Signed-in isolation", "Pending exact-SHA staging deployment"],
  ["Next gate", "Independent implementation re-review before dev merge or exact-SHA staging deployment"],
] as const;

export default function Unit9Candidate20268StatusPage() {
  return <main><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-sm font-semibold uppercase tracking-[0.18em] text-indigo-700">Staging validation status</p><h1 className="mt-2 text-3xl font-bold text-slate-950">Unit 9 — NG-CANDIDATE-2026.8</h1><p className="mt-2 max-w-3xl text-slate-600">Non-sensitive engineering evidence only.</p></div><span className="rounded-full bg-amber-100 px-4 py-2 text-sm font-bold text-amber-950">NOT CERTIFIED</span></div><section className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{items.map(([label,value])=><article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" key={label}><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p><p className="mt-2 font-semibold text-slate-900">{value}</p></article>)}</section><section className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-5"><h2 className="font-bold text-amber-950">Fail-closed boundary</h2><p className="mt-2 text-sm text-amber-900">No official finalization, payslip publication, payment, settlement, filing or remittance is permitted until the persisted candidate package is independently certified.</p></section></main>;
}
