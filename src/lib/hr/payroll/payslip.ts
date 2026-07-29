import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export async function createPayslipPdf(input: {
  organizationName: string; periodName: string; payDate: Date; employeeNumber: string; employeeName: string;
  currency: string; baseSalary: string; grossEarnings: string; totalDeductions: string; employerBenefits: string; netPay: string;
  components: { name: string; type: string; amount: string }[];
}) {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595, 842]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const draw = (text: string, x: number, y: number, size = 10, strong = false) => page.drawText(text, { x, y, size, font: strong ? bold : font, color: rgb(0.08, 0.15, 0.2) });
  draw(input.organizationName, 48, 785, 18, true);
  draw("PAYSLIP", 470, 785, 13, true);
  draw(input.periodName, 48, 755, 12, true);
  draw(`Pay date: ${input.payDate.toISOString().slice(0, 10)}`, 48, 736);
  draw(`Employee: ${input.employeeName}`, 48, 700);
  draw(`Employee number: ${input.employeeNumber}`, 48, 682);
  draw("Description", 48, 640, 10, true); draw("Type", 330, 640, 10, true); draw(`Amount (${input.currency})`, 438, 640, 10, true);
  page.drawLine({ start: { x: 48, y: 632 }, end: { x: 547, y: 632 }, thickness: 0.8 });
  let y = 612;
  draw("Base salary", 48, y); draw("EARNING", 330, y); draw(input.baseSalary, 455, y);
  for (const line of input.components) {
    y -= 22;
    if (y < 170) break;
    draw(line.name.slice(0, 46), 48, y); draw(line.type, 330, y); draw(line.amount, 455, y);
  }
  y -= 36;
  page.drawLine({ start: { x: 48, y: y + 18 }, end: { x: 547, y: y + 18 }, thickness: 0.8 });
  draw("Gross earnings", 330, y, 10, true); draw(input.grossEarnings, 455, y, 10, true);
  y -= 22; draw("Total deductions", 330, y, 10, true); draw(input.totalDeductions, 455, y, 10, true);
  y -= 22; draw("Employer benefits", 330, y); draw(input.employerBenefits, 455, y);
  y -= 30; draw("NET PAY", 330, y, 12, true); draw(`${input.currency} ${input.netPay}`, 438, y, 12, true);
  draw("This document is confidential. Authenticate through Zentric HR to access payroll records.", 48, 72, 8);
  return new Uint8Array(await pdf.save());
}
