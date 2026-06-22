import { z } from 'zod';
export const stageStatuses = ['Locked','Available','In Progress','Submitted','Under Review','Approved','Correction Requested','Rejected','Completed'] as const;
export const applicationStatuses = ['Application Submitted','Screening','Candidate Information Required','Interview Scheduled','Assessment Required','Offer Pending','Offer Sent','Offer Accepted','Agreement Pending','Onboarding Pending','Final Review','Enrollment Completed','Hired','Rejected'] as const;
export type StageStatus = typeof stageStatuses[number];
export const stages = [
  { order: 1, key: 'initial-application', title: 'Initial Application', applicantAction: 'Submit your first-stage application and signed privacy consent.' },
  { order: 2, key: 'candidate-information', title: 'Candidate Information / Identity Verification', applicantAction: 'Provide HR and identity details after Stage 1 approval.' },
  { order: 3, key: 'screening-assessment', title: 'Screening / Interview / Assessment', applicantAction: 'Review admin instructions, confirm availability, and upload assessment if requested.' },
  { order: 4, key: 'offer', title: 'Offer Stage', applicantAction: 'Review, accept, or decline the offer when released.' },
  { order: 5, key: 'employment-agreement', title: 'Employment Agreement + Role Schedule', applicantAction: 'Review terms, role schedule, and e-sign agreement.' },
  { order: 6, key: 'onboarding', title: 'Onboarding Form', applicantAction: 'Submit payroll, next-of-kin, access, and start-date details.' },
  { order: 7, key: 'policy-acknowledgements', title: 'Policy, Privacy, and Access Acknowledgements', applicantAction: 'Acknowledge privacy, policy, confidentiality, communications, and system-access rules.' },
  { order: 8, key: 'final-hr-approval', title: 'Final HR Approval', applicantAction: 'HR confirms completion and employee-file readiness.' },
] as const;
export const workModes = ['Office','Remote','Hybrid','Flexible'] as const;
export const idTypes = ['National Identification Number / NIN','International Passport','Driver’s Licence','Voter’s Card','Other Government-issued ID'] as const;
export const initialApplicationSchema = z.object({ fullName: z.string().min(2), email: z.string().email(), phone: z.string().min(7), location: z.string().min(2), role: z.string().min(2), workMode: z.enum(workModes), experienceLevel: z.string().min(2), skills: z.string().min(2), portfolioUrl: z.string().url().optional().or(z.literal('')), message: z.string().min(20).max(1500), privacyConsent: z.literal('on'), signatureName: z.string().min(2), signatureConsent: z.literal('on') });
export function generateApplicationId(sequence: number, date = new Date()) { return `ZA-APP-${date.getUTCFullYear()}-${String(sequence).padStart(5, '0')}`; }
export function maskSensitive(value: string) { const clean = value.replace(/\s+/g, ''); return clean.length <= 4 ? '****' : `${'*'.repeat(Math.max(4, clean.length - 4))}${clean.slice(-4)}`; }
export function canDownloadDocument(status: StageStatus, signed: boolean, submittedAt?: string | null) { return signed && Boolean(submittedAt) && ['Submitted','Under Review','Approved','Completed'].includes(status); }
export const documentStatuses = ['Locked','Not Started','In Progress','Submitted','Signed','Under Review','Correction Requested','Approved','Download Available'] as const;
export function isAccessCodeUsable(input: { expiresAt: Date; usedAt?: Date | null }, now = new Date()) {
  return !input.usedAt && input.expiresAt.getTime() > now.getTime();
}
export function getStage1ApprovalEffects() {
  return { stage1Status: 'Approved', stage2Status: 'Available', applicationStatus: 'Candidate Information Required', currentStageOrder: 2 } as const;
}
export function adminActionAuditName(action: 'approve' | 'reject' | 'correction') {
  if (action === 'approve') return 'Admin approved Stage 1';
  if (action === 'reject') return 'Admin rejected Stage 1';
  return 'Admin requested correction';
}
