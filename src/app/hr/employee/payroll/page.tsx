import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireAuthenticatedUser } from "@/lib/hr/permissions/authorize";

export const dynamic = "force-dynamic";
export default async function MyPayrollPage() {
  const auth=await requireAuthenticatedUser(); const employeeId=auth.user.employee?.id;
  if(!employeeId) return <main><h1 className="text-3xl font-bold">My payroll</h1><p className="mt-4 text-slate-600">No employee profile is linked to this account.</p></main>;
  const results=await prisma.hrPayrollAuthoritativeResult.findMany({where:{organizationId:auth.user.organizationId,employeeId,finalizedAt:{not:null}},orderBy:{createdAt:'desc'}});
  const payslips=await prisma.hrPayrollPayslipVersion.findMany({where:{organizationId:auth.user.organizationId,employeeId,publishedAt:{not:null}},orderBy:{generatedAt:'desc'}});
  return <main><p className="text-sm font-semibold uppercase tracking-widest text-indigo-700">My HR</p><h1 className="mt-2 text-3xl font-bold">Payroll &amp; payslips</h1><p className="mt-2 text-slate-600">Only your finalized payroll is shown.</p><section className="mt-8 grid gap-4">{results.map(result=><article className="rounded-2xl border bg-white p-5" key={result.id}><div className="flex justify-between"><h2 className="font-bold">Payroll result</h2><span>{result.currency} {result.netPay.toFixed(2)}</span></div><p className="mt-3 text-sm text-slate-600">Gross {result.grossEarnings.toFixed(2)} − PAYE {result.paye.toFixed(2)} − deductions {result.employeeDeductions.toFixed(2)} ± adjustments {result.adjustments.toFixed(2)} = net {result.netPay.toFixed(2)}</p></article>)}</section><section className="mt-8"><h2 className="text-xl font-bold">Official payslips</h2>{payslips.map(p=><Link className="mt-3 block rounded-xl border bg-white p-4 font-semibold text-indigo-700" href={`/hr/employee/payroll/payslips/${p.id}`} key={p.id}>Payslip version {p.version} · {p.generatedAt.toISOString().slice(0,10)}</Link>)}</section></main>;
}
