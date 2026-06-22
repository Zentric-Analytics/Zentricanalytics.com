import { maskSensitive } from './hiring';

export type PdfField = { label: string; value: string; sensitive?: boolean };
type SubmittedDocumentInput = { title: string; applicantName: string; applicationId: string; documentRef?: string; role?: string; fields: PdfField[]; documents?: PdfField[]; signatureName: string; submittedAt: string; signedAt?: string; version: number; status: string };

export function renderSubmittedDocumentText(input: SubmittedDocumentInput) {
  const rows = [
    'Zentric Analytics Ltd', 'PRIVATE & CONFIDENTIAL', 'Official recruitment communication', `Ref: ${input.documentRef ?? `ZA/HR/APP/${new Date().getUTCFullYear()}/${input.applicationId}`}`,
    'Employment Application', 'Candidate Information Form', 'Candidate Details', `Full legal name: ${input.applicantName}`, `Application ID: ${input.applicationId}`,
    ...input.fields.map(renderPlainRow), 'Role Interest and Availability', `Role applied for: ${input.role ?? ''}`, `Document status: ${input.status}`, `Submission timestamp: ${input.submittedAt}`, `Document version: ${input.version}`,
    'Documents Submitted', ...(input.documents?.length ? input.documents : [{ label: 'Documents submitted', value: 'Recorded in private recruitment storage' }]).map(renderPlainRow),
    'Candidate Declaration', 'I declare that the information submitted in this Stage 1 employment application is true and complete to the best of my knowledge. I understand that inaccurate information may affect my application.',
    'Candidate Data Privacy Acknowledgement', 'I acknowledge that Zentric Analytics Ltd may process my application data and private uploaded documents for recruitment review, verification, communication, and recruitment records management.',
    'Candidate Signature', `Electronic signature name: ${input.signatureName}`, 'Signature confirmation: Confirmed as electronic signature', `Signature timestamp: ${input.signedAt ?? input.submittedAt}`,
    'For Zentric Use Only', 'HR reviewer:', 'Stage 1 admin decision:', 'Internal notes:', 'Zentric Analytics Ltd | Recruitment Records | Private & Confidential',
  ];
  return rows.join('\n');
}

export async function renderSubmittedDocumentPdf(input: SubmittedDocumentInput) {
  const text = renderSubmittedDocumentText(input);
  return buildSimplePdf(text);
}

function renderPlainRow({ label, value, sensitive = false }: PdfField) { return `${label}: ${sensitive ? maskSensitive(value) : (value || '—')}`; }
function pdfEscape(value: string) { return value.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)'); }
function wrap(line: string, width = 92) { const words = line.split(/\s+/); const out: string[] = []; let cur = ''; for (const w of words) { if ((cur + ' ' + w).trim().length > width) { out.push(cur); cur = w; } else cur = (cur + ' ' + w).trim(); } if (cur) out.push(cur); return out.length ? out : ['']; }
function buildSimplePdf(text: string) {
  const lines = text.split('\n').flatMap((l) => wrap(l));
  const content = ['BT', '/F1 10 Tf', '50 780 Td', '14 TL', ...lines.map((line, i) => `${i === 0 ? '' : 'T* '}(${pdfEscape(line)}) Tj`), 'ET'].join('\n');
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`,
  ];
  let pdf = '%PDF-1.4\n'; const offsets = [0];
  objects.forEach((obj, index) => { offsets.push(Buffer.byteLength(pdf)); pdf += `${index + 1} 0 obj\n${obj}\nendobj\n`; });
  const xref = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map((o) => String(o).padStart(10, '0') + ' 00000 n ').join('\n')}\ntrailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(pdf);
}
