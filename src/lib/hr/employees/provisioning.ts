import { z } from "zod";

const optionalText = z.string().trim().max(500).optional();
const optionalDate = z.string().date().optional();

export const provisioningPayloadSchema = z.object({
  personal: z.object({
    legalFirstName: z.string().trim().min(1).max(100),
    middleName: optionalText,
    lastName: z.string().trim().min(1).max(100),
    preferredName: optionalText,
    dateOfBirth: optionalDate,
    personalEmail: z.string().trim().email().optional(),
    phone: optionalText,
    addressLine1: optionalText,
    city: optionalText,
    country: optionalText,
    emergencyName: optionalText,
    emergencyRelationship: optionalText,
    emergencyPhone: optionalText,
  }).partial().optional(),
  employment: z.object({
    employeeNumber: optionalText,
    hireDate: optionalDate,
    startDate: optionalDate,
    employmentType: z.enum(["FULL_TIME", "PART_TIME", "CONTRACT", "INTERN", "TEMPORARY"]).optional(),
    workMode: z.enum(["ONSITE", "HYBRID", "REMOTE"]).optional(),
    location: optionalText,
    probationEndDate: optionalDate,
    notes: optionalText,
  }).partial().optional(),
  assignment: z.object({
    departmentId: z.string().cuid().optional(),
    teamId: z.string().cuid().optional(),
    positionId: z.string().cuid().optional(),
    primaryManagerId: z.string().cuid().optional(),
    effectiveFrom: optionalDate,
    reason: optionalText,
  }).partial().optional(),
  compensation: z.object({
    currency: z.string().trim().length(3).optional(),
    baseSalary: z.string().regex(/^\d{1,15}(\.\d{1,2})?$/).optional(),
    payFrequency: z.enum(["MONTHLY", "BIWEEKLY", "WEEKLY"]).optional(),
    effectiveFrom: optionalDate,
    reason: optionalText,
  }).partial().optional(),
  payroll: z.object({
    bankName: optionalText,
    accountName: optionalText,
    accountNumber: z.string().trim().min(5).max(40).optional(),
    taxCountry: optionalText,
    taxId: optionalText,
    pensionProvider: optionalText,
    pensionId: optionalText,
  }).partial().optional(),
  access: z.object({
    createUser: z.boolean().optional(),
    email: z.string().trim().email().optional(),
    role: z.enum(["EMPLOYEE", "ADMIN", "HR_ADMIN", "PAYROLL_ADMIN"]).optional(),
    sendInvitation: z.boolean().optional(),
    requireMfa: z.boolean().optional(),
  }).partial().optional(),
  onboarding: z.object({
    start: z.boolean().optional(),
    templateId: z.string().cuid().optional(),
    orientationDate: optionalDate,
  }).partial().optional(),
}).default({});

export type ProvisioningPayload = z.infer<typeof provisioningPayloadSchema>;

export function provisioningReadiness(payload: ProvisioningPayload, options: { requireManager?: boolean } = {}) {
  const requireManager = options.requireManager ?? true;
  const checks = [
    { key: "personal", label: "Personal profile complete", ready: Boolean(payload.personal?.legalFirstName && payload.personal?.lastName && payload.personal?.personalEmail) },
    { key: "employment", label: "Employment dates complete", ready: Boolean(payload.employment?.hireDate && payload.employment?.startDate && payload.employment?.employmentType) },
    { key: "assignment", label: "Assignment complete", ready: Boolean(payload.assignment?.departmentId && payload.assignment?.positionId && payload.assignment?.effectiveFrom && payload.assignment?.reason) },
    { key: "manager", label: requireManager ? "Manager assigned" : "Manager not required for the first employee", ready: !requireManager || Boolean(payload.assignment?.primaryManagerId) },
    { key: "compensation", label: "Compensation complete", ready: Boolean(payload.compensation?.baseSalary && payload.compensation?.currency && payload.compensation?.effectiveFrom && payload.compensation?.reason) },
    { key: "payroll", label: "Payroll account complete", ready: Boolean(payload.payroll?.bankName && payload.payroll?.accountName && payload.payroll?.accountNumber && payload.payroll?.taxCountry) },
    { key: "access", label: "User access configured", ready: !payload.access?.createUser || Boolean(payload.access.email && payload.access.role) },
    { key: "onboarding", label: "Onboarding configured", ready: !payload.onboarding?.start || Boolean(payload.onboarding.templateId) },
  ];
  return { checks, score: Math.round(checks.filter(({ ready }) => ready).length / checks.length * 100), blocking: checks.filter(({ key, ready }) => !ready && ["personal", "employment", "assignment", "manager"].includes(key)) };
}

export function mergeProvisioningStep(payload: unknown, section: keyof ProvisioningPayload, values: Record<string, unknown>) {
  const current = provisioningPayloadSchema.parse(payload ?? {});
  return provisioningPayloadSchema.parse({ ...current, [section]: { ...(current[section] as object ?? {}), ...values } });
}
