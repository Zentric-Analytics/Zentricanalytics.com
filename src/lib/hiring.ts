import { z } from 'zod';
import { countryPhoneOptions, normalizePhoneForCountry } from './phone';
import { resolveRoleAppliedFor, roleAppliedForOptions } from './recruitment-options';
import { employmentTypeOptions, stage1WorkModeOptions, yesNoOptions } from './stage1-fields';
export const stageStatuses = ['Locked','Available','In Progress','Submitted','Under Review','Approved','Correction Requested','Rejected','Completed'] as const;
export const applicationStatuses = ['Application Submitted','Screening','Candidate Information Required','Interview Scheduled','Assessment Required','Offer Pending','Offer Sent','Offer Accepted','Agreement Pending','Onboarding Pending','Final Review','Enrollment Completed','Hired','Rejected'] as const;
export type StageStatus = typeof stageStatuses[number];
export function isStageStatus(value: unknown): value is StageStatus { return typeof value === 'string' && (stageStatuses as readonly string[]).includes(value); }
export function toStageStatus(value: unknown, fallback: StageStatus = 'Locked'): StageStatus { return isStageStatus(value) ? value : fallback; }
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
export const workModes = stage1WorkModeOptions;
export const idTypes = ['National Identification Number / NIN','International Passport','Driver’s Licence','Voter’s Card','Other Government-issued ID'] as const;
export const optionalText = (max = 1000) => z.string().trim().max(max).optional().or(z.literal(''));
export const optionalUrl = z.string().trim().url('Enter a valid URL, or leave this blank.').optional().or(z.literal(''));
export const initialApplicationSchema = z.object({
  firstName: z.string().trim().min(1, 'Enter your first name.'),
  middleInitial: optionalText(50),
  lastName: z.string().trim().min(1, 'Enter your last name.'),
  preferredName: optionalText(100),
  residentialAddress: z.string().trim().min(2, 'Enter your residential address.'),
  email: z.string().email('Enter a valid email address.'),
  phoneCountryIso: z.enum(countryPhoneOptions.map((country) => country.iso) as [string, ...string[]], { errorMap: () => ({ message: 'Select a valid country.' }) }),
  phoneNational: z.string().min(4, 'Enter a phone number.'),
  stateOfResidence: optionalText(120),
  lgaOfResidence: optionalText(120),
  nationality: optionalText(120),
  rightToWorkNigeria: z.enum(['Yes', 'No', 'N/A']).optional().or(z.literal('')),
  genderForHr: optionalText(40),
  role: z.enum(roleAppliedForOptions, { errorMap: () => ({ message: 'Select the role you are applying for.' }) }),
  otherRole: optionalText(100),
  experienceLevel: optionalText(80),
  employmentType: z.enum(employmentTypeOptions, { errorMap: () => ({ message: 'Select an employment type.' }) }),
  workMode: z.enum(stage1WorkModeOptions, { errorMap: () => ({ message: 'Select a work mode preference.' }) }),
  availableStartDate: optionalText(40),
  noticePeriod: optionalText(100),
  salaryExpectation: optionalText(100),
  salaryNegotiable: z.enum(yesNoOptions).optional().or(z.literal('')),
  canWorkMondayFriday: z.enum(yesNoOptions).optional().or(z.literal('')), 
  preferredWorkingTime: optionalText(100),
  heardAboutUs: optionalText(160),
  skills: z.string().min(2, 'Enter at least one relevant skill.'),
  portfolioUrl: optionalUrl,
  portfolioAvailable: optionalText(20),
  certificatesAvailable: optionalText(20),
  certificatesNote: optionalText(300),
  otherDocumentNote: optionalText(300),
  educationHistory: optionalText(2000),
  employmentHistory: optionalText(2000),
  message: z.string().trim().min(10, 'Enter a short application message.').max(1500),
  referee1Name: optionalText(120), referee1CompanyRole: optionalText(160), referee1Relationship: optionalText(80), referee1Phone: optionalText(80), referee1Email: z.string().trim().email('Enter a valid referee email, or leave this blank.').optional().or(z.literal('')), referee1MayContact: z.enum(yesNoOptions).optional().or(z.literal('')),
  referee2Name: optionalText(120), referee2CompanyRole: optionalText(160), referee2Relationship: optionalText(80), referee2Phone: optionalText(80), referee2Email: z.string().trim().email('Enter a valid referee email, or leave this blank.').optional().or(z.literal('')), referee2MayContact: z.enum(yesNoOptions).optional().or(z.literal('')),
  declarationAccuracy: z.literal('on', { errorMap: () => ({ message: 'Confirm the declaration.' }) }),
  privacyConsent: z.literal('on', { errorMap: () => ({ message: 'Consent is required to process your application.' }) }),
  signatureName: z.string().min(2, 'Type your legal name as your electronic signature.'),
  signatureConsent: z.literal('on', { errorMap: () => ({ message: 'Confirm your electronic signature.' }) })
}).superRefine((data, ctx) => { const phone = normalizePhoneForCountry(data.phoneCountryIso, data.phoneNational); if (!phone.valid) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['phoneNational'], message: phone.error }); if (data.role === 'Other' && !data.otherRole?.trim()) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['otherRole'], message: 'Specify the role when Other is selected.' }); });
export function toStage1SubmissionPayload(data: z.infer<typeof initialApplicationSchema>) { const phone = normalizePhoneForCountry(data.phoneCountryIso, data.phoneNational); if (!phone.valid) throw new Error(phone.error); const location = [data.lgaOfResidence, data.stateOfResidence].filter(Boolean).join(', ') || data.residentialAddress; return { ...data, roleAppliedFor: resolveRoleAppliedFor(data.role, data.otherRole), experienceLevel: data.experienceLevel || 'Not specified', phoneCountryIso: phone.iso, phoneCountryName: phone.countryName, phoneDialCode: phone.dialCode, phoneNational: phone.nationalNumber, phoneE164: phone.e164, fullName: [data.firstName, data.middleInitial, data.lastName].filter(Boolean).join(' '), location }; }
export function generateApplicationId(sequence: number, date = new Date()) { return `ZA-APP-${date.getUTCFullYear()}-${String(sequence).padStart(5, '0')}`; }
export function maskSensitive(value: string) { const clean = value.replace(/\s+/g, ''); return clean.length <= 4 ? '****' : `${'*'.repeat(Math.max(4, clean.length - 4))}${clean.slice(-4)}`; }
export const stage1DownloadAllowedStatuses: StageStatus[] = ['Approved','Completed'];
export type Stage1DownloadEligibilityInput = { stagePresent: boolean; submissionPresent: boolean; submissionSubmitted: boolean; signaturePresent: boolean; signatureConfirmed: boolean; signedAtPresent: boolean; stageStatus: StageStatus };
export function isStage1DownloadEligible(input: Stage1DownloadEligibilityInput) { return input.stagePresent && input.submissionPresent && input.submissionSubmitted && input.signaturePresent && input.signatureConfirmed && input.signedAtPresent && stage1DownloadAllowedStatuses.includes(input.stageStatus); }
export function canDownloadDocument(status: StageStatus, signed: boolean, submittedAt?: string | null, signedAt?: string | null) { return isStage1DownloadEligible({ stagePresent: true, submissionPresent: true, submissionSubmitted: Boolean(submittedAt), signaturePresent: signed, signatureConfirmed: signed, signedAtPresent: Boolean(signedAt), stageStatus: status }); }
export function sanitizeDownloadFilenamePart(value: string) { return value.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/-+/g, '-').replace(/^[-.]+|[-.]+$/g, '').slice(0, 80) || 'application'; }
export const documentStatuses = ['Locked','Not Started','In Progress','Submitted','Signed','Under Review','Correction Requested','Approved','Download Available'] as const;
export function isAccessCodeUsable(input: { expiresAt: Date; usedAt?: Date | null }, now = new Date()) { return !input.usedAt && input.expiresAt.getTime() > now.getTime(); }
export function getStage1ApprovalEffects() { return { stage1Status: 'Approved', stage2Status: 'Available', applicationStatus: 'Candidate Information Required', currentStageOrder: 2 } as const; }
export function adminActionAuditName(action: 'approve' | 'reject' | 'correction') { if (action === 'approve') return 'Admin approved Stage 1'; if (action === 'reject') return 'Admin rejected Stage 1'; return 'Admin requested correction'; }

export const stage2GenderOptions = ['Male','Female','Prefer not to say'] as const;
export const stage2IdTypeOptions = idTypes;
export const stage2AcceptedMimeTypes = new Set(['application/pdf','image/jpeg','image/pjpeg','image/jpg','image/png','image/x-png','image/webp']);
export const stage2AcceptedExtensions = new Set(['pdf','jpg','jpeg','png','webp']);
export const stage2SubmissionSchema = z.object({
  session: z.string().min(16, 'Open the portal with a valid session.'),
  fullLegalName: z.string().trim().min(2, 'Enter your full legal name.'),
  dateOfBirth: z.string().trim().min(1, 'Enter your date of birth.'),
  gender: z.enum(stage2GenderOptions, { errorMap: () => ({ message: 'Select a gender option.' }) }),
  nationality: z.string().trim().min(2, 'Enter your nationality.'),
  stateOfOrigin: z.string().trim().min(2, 'Enter your state of origin.'),
  stateOfResidence: z.string().trim().min(2, 'Enter your state of residence.'),
  lga: z.string().trim().min(2, 'Enter your LGA.'),
  residentialAddress: z.string().trim().min(5, 'Enter your residential address.'),
  currentCity: z.string().trim().min(2, 'Enter your current city/location.'),
  phoneNumber: z.string().trim().min(4, 'Enter your phone number.'),
  email: z.string().trim().email('Enter a valid email address.'),
  idType: z.enum(stage2IdTypeOptions, { errorMap: () => ({ message: 'Select an ID type.' }) }),
  idNumber: z.string().trim().min(2, 'Enter your ID number.'),
  idIssuingAuthority: optionalText(160),
  idIssueDate: optionalText(40),
  idExpiryDate: optionalText(40),
  nin: optionalText(80),
  taxId: optionalText(80),
  emergencyContactName: z.string().trim().min(2, 'Enter emergency contact name.'),
  emergencyContactRelationship: z.string().trim().min(2, 'Enter relationship.'),
  emergencyContactPhone: z.string().trim().min(4, 'Enter emergency contact phone.'),
  emergencyContactAddress: optionalText(500),
  declarationAccuracy: z.literal('on', { errorMap: () => ({ message: 'Confirm the declaration.' }) }),
  identityProcessingConsent: z.literal('on', { errorMap: () => ({ message: 'Consent is required.' }) }),
  signatureName: z.string().trim().min(2, 'Type your name as your electronic signature.'),
  signatureConsent: z.literal('on', { errorMap: () => ({ message: 'Confirm your electronic signature.' }) }),
});
export type Stage2SubmissionInput = z.infer<typeof stage2SubmissionSchema>;
export function toStage2SubmissionPayload(data: Stage2SubmissionInput) {
  const { session: _session, declarationAccuracy, identityProcessingConsent, signatureConsent, signatureName, idNumber, nin, taxId, ...safeData } = data;
  return {
    ...safeData,
    idNumberMasked: maskSensitive(idNumber),
    ninMasked: nin ? maskSensitive(nin) : '',
    taxIdMasked: taxId ? maskSensitive(taxId) : '',
    declarationAccuracy: declarationAccuracy === 'on',
    identityProcessingConsent: identityProcessingConsent === 'on',
    signatureConsent: signatureConsent === 'on',
    signatureName,
  };
}
export function getStage2ApprovalEffects() { return { stage2Status: 'Approved', stage3Status: 'Available', applicationStatus: 'Screening', currentStageOrder: 3 } as const; }
