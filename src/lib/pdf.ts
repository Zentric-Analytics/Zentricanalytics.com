import { maskSensitive } from './hiring';

export type PdfField = {
  label: string;
  value: string;
  sensitive?: boolean;
};

type SubmittedDocumentInput = {
  title: string;
  applicantName: string;
  applicationId: string;
  documentRef?: string;
  role?: string;
  fields: PdfField[];
  documents?: PdfField[];
  signatureName: string;
  submittedAt: string;
  signedAt?: string;
  version: number;
  status: string;
};

export function renderSubmittedDocumentText(input: SubmittedDocumentInput) {
  const candidateRows = input.fields.map((field) => renderRow(field)).join('');
  const documentRows = getDocumentFields(input).map((field) => renderRow(field)).join('');
  const skillsRows = input.fields
    .filter((field) => ['Skills', 'Portfolio link', 'Message'].includes(field.label))
    .map((field) => renderRow(field))
    .join('');
  const documentReference = input.documentRef ?? buildDocumentReference(input.applicationId);

  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(input.title)}</title><style>${documentStyles}</style></head><body><main class="doc"><header class="top"><div class="confidential">PRIVATE &amp; CONFIDENTIAL</div><div class="brand">Zentric Analytics Ltd</div><div class="meta">Official recruitment communication</div><div class="meta">RC No.: Company Records | Registered Office: Zentric Analytics Ltd Registered Office | Email: hr@zentricanalytics.com | Website: zentricanalytics.com</div><div class="meta">Ref: ${escapeHtml(documentReference)}</div></header><section class="title"><h1>Employment Application</h1><p>Candidate Information Form</p></section><h2>Candidate Details</h2><table>${renderRow({ label: 'Full legal name', value: input.applicantName })}${renderRow({ label: 'Application ID', value: input.applicationId })}${candidateRows}</table><h2>Role Interest and Availability</h2><table>${renderRow({ label: 'Role applied for', value: input.role ?? '' })}${renderRow({ label: 'Document status', value: input.status })}${renderRow({ label: 'Submission timestamp', value: input.submittedAt })}${renderRow({ label: 'Document version', value: String(input.version) })}</table><h2>Documents Submitted</h2><table>${documentRows}</table><h2>Skills / Portfolio Summary</h2><table>${skillsRows}</table><h2>Candidate Declaration</h2><div class="declaration">I declare that the information submitted in this Stage 1 employment application is true and complete to the best of my knowledge. I understand that inaccurate information may affect my application.</div><h2>Candidate Data Privacy Acknowledgement</h2><div class="declaration">I acknowledge that Zentric Analytics Ltd may process my application data and private uploaded documents for recruitment review, verification, communication, and recruitment records management.</div><h2>Candidate Signature</h2><table>${renderRow({ label: 'Electronic signature name', value: input.signatureName })}${renderRow({ label: 'Signature confirmation', value: 'Confirmed as electronic signature' })}${renderRow({ label: 'Signature timestamp', value: input.signedAt ?? input.submittedAt })}<tr><th>Signature box</th><td class="signature">${escapeHtml(input.signatureName)}</td></tr></table><h2>For Zentric Use Only</h2><table>${renderRow({ label: 'HR reviewer', value: '' })}${renderRow({ label: 'Stage 1 admin decision', value: '' })}${renderRow({ label: 'Internal notes', value: '' })}</table><p class="footer-note">Zentric Analytics Ltd | Recruitment Records | Private & Confidential</p></main></body></html>`;
}

function getDocumentFields(input: SubmittedDocumentInput) {
  if (input.documents?.length) {
    return input.documents;
  }

  return [{ label: 'Documents submitted', value: 'Recorded in private recruitment storage' }];
}

function renderRow({ label, value, sensitive = false }: PdfField) {
  const displayValue = sensitive ? maskSensitive(value) : value || '—';

  return `<tr><th>${escapeHtml(label)}</th><td>${escapeHtml(displayValue)}</td></tr>`;
}

function buildDocumentReference(applicationId: string) {
  return `ZA/HR/APP/${new Date().getUTCFullYear()}/${applicationId}`;
}

function escapeHtml(value: string) {
  return String(value).replace(
    /[&<>'"]/g,
    (character) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        "'": '&#39;',
        '"': '&quot;',
      })[character]!,
  );
}

const documentStyles = `@page{margin:24mm 18mm;@bottom-center{content:"Zentric Analytics Ltd | Recruitment Records | Private & Confidential | Page " counter(page) " of " counter(pages);font-size:9px;color:#475569}}body{font-family:Arial,Helvetica,sans-serif;color:#0f172a;line-height:1.45}.doc{max-width:800px;margin:0 auto}.top{border-bottom:3px solid #0f172a;padding-bottom:12px;margin-bottom:18px}.brand{font-size:24px;font-weight:800;letter-spacing:.04em}.confidential{float:right;border:1px solid #0f172a;padding:6px 10px;font-weight:700;font-size:12px}.meta{font-size:12px;color:#334155}.title{text-align:center;margin:22px 0}.title h1{font-size:22px;margin:0;text-transform:uppercase}.title p{margin:4px 0 0;font-size:14px}h2{font-size:14px;text-transform:uppercase;border-bottom:1px solid #94a3b8;padding-bottom:4px;margin-top:20px}table{width:100%;border-collapse:collapse;margin-top:8px}th,td{border:1px solid #cbd5e1;padding:8px;vertical-align:top;font-size:12px}th{width:34%;text-align:left;background:#f8fafc}.declaration{border:1px solid #cbd5e1;padding:12px;font-size:12px}.signature{height:70px}.footer-note{margin-top:18px;font-size:11px;color:#475569}`;
