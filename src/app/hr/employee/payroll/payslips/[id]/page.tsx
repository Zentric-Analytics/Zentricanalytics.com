import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAuthenticatedUser } from "@/lib/hr/permissions/authorize";

export const dynamic="force-dynamic";
export default async function PayslipPage({params}:{params:Promise<{id:string}>}){
  const auth=await requireAuthenticatedUser(); const employeeId=auth.user.employee?.id; if(!employeeId) notFound(); const {id}=await params;
  const payslip=await prisma.hrPayrollPayslipVersion.findFirst({where:{id,organizationId:auth.user.organizationId,employeeId,publishedAt:{not:null}}}); if(!payslip) notFound();
  const result=await prisma.hrPayrollAuthoritativeResult.findFirst({where:{id:payslip.payrollResultId,organizationId:auth.user.organizationId,employeeId,finalizedAt:{not:null}}}); if(!result) notFound();
  const lines=await prisma.hrPayrollResultLine.findMany({where:{organizationId:auth.user.organizationId,payrollResultId:result.id},orderBy:{sequence:'asc'}});
  return <main><p className="text-sm font-semibold uppercase tracking-widest text-indigo-700">Official payslip</p><h1 className="mt-2 text-3xl font-bold">Payslip version {payslip.version}</h1><p className="mt-2 text-slate-600">Published {payslip.publishedAt?.toISOString()} · Reference {payslip.id}</p><section className="mt-8 rounded-2xl border bg-white p-6"><h2 className="text-xl font-bold">How was my pay calculated?</h2><div className="mt-5 space-y-3">{lines.map(line=><div className="flex justify-between border-b pb-2" key={line.id}><span>{line.code} · {line.category}</span><span>{result.currency} {line.amount.toFixed(2)}</span></div>)}</div><div className="mt-6 space-y-2 border-t pt-4"><p>Gross: {result.currency} {result.grossEarnings.toFixed(2)}</p><p>PAYE: {result.currency} {result.paye.toFixed(2)}</p><p>Employee deductions: {result.currency} {result.employeeDeductions.toFixed(2)}</p><p>Adjustments: {result.currency} {result.adjustments.toFixed(2)}</p><p className="text-lg font-bold">Net pay: {result.currency} {result.netPay.toFixed(2)}</p><p className="text-sm text-slate-600">Employer contributions (not deducted from net): {result.currency} {result.employerContributions.toFixed(2)}</p></div></section></main>;
}
