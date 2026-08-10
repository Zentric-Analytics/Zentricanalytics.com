export type HrProfileFieldPolicy = {
  employeeEditable?: boolean;
  employeeRequestOnly?: boolean;
  managerVisible?: boolean;
  hrOnly?: boolean;
  payrollSensitive?: boolean;
  securitySensitive?: boolean;
  immutable?: boolean;
  effectiveDated?: boolean;
  encrypted?: boolean;
  verificationRequired?: boolean;
};

export const HR_PROFILE_FIELD_POLICIES = {
  preferredName: { employeeEditable: true, managerVisible: true },
  phone: { employeeEditable: true },
  personalEmail: { employeeEditable: true, securitySensitive: true },
  preferredNotificationEmail: { employeeEditable: true, securitySensitive: true },
  address: { employeeRequestOnly: true, verificationRequired: true, effectiveDated: true },
  emergencyContacts: { employeeEditable: true },
  nextOfKin: { employeeEditable: true, hrOnly: true },
  legalName: { employeeRequestOnly: true, verificationRequired: true, effectiveDated: true },
  dateOfBirth: { employeeRequestOnly: true, hrOnly: true, verificationRequired: true },
  nationalIdentifier: { employeeRequestOnly: true, hrOnly: true, encrypted: true, verificationRequired: true },
  workAuthorization: { employeeRequestOnly: true, hrOnly: true, encrypted: true, verificationRequired: true },
  bankAccount: { employeeRequestOnly: true, payrollSensitive: true, encrypted: true, verificationRequired: true },
  taxProfile: { employeeRequestOnly: true, payrollSensitive: true, encrypted: true, verificationRequired: true },
  employeeNumber: { immutable: true, managerVisible: true },
  employmentStatus: { hrOnly: true, effectiveDated: true, managerVisible: true },
  workRelationship: { hrOnly: true, effectiveDated: true, managerVisible: true },
  assignment: { hrOnly: true, effectiveDated: true, managerVisible: true },
  probation: { employeeRequestOnly: false, hrOnly: true, effectiveDated: true, managerVisible: true },
} as const satisfies Record<string, HrProfileFieldPolicy>;

export type HrProfileFieldKey = keyof typeof HR_PROFILE_FIELD_POLICIES;

export function profileFieldPolicy(field: string): HrProfileFieldPolicy {
  const policy = HR_PROFILE_FIELD_POLICIES[field as HrProfileFieldKey];
  if (!policy) throw new Error(`Unsupported employee profile field: ${field}`);
  return policy;
}

export function assertEmployeeMayInitiateProfileChange(field: string, directEdit: boolean) {
  const policy = profileFieldPolicy(field);
  if (policy.immutable || (!policy.employeeEditable && !policy.employeeRequestOnly)) {
    throw new Error("This field cannot be changed through employee self-service.");
  }
  if (directEdit && !policy.employeeEditable) {
    throw new Error("This field requires a governed change request and independent review.");
  }
  return policy;
}

export function visibleProfileFieldsFor(viewer: "EMPLOYEE" | "MANAGER" | "HR" | "PAYROLL" | "AUDITOR") {
  return Object.entries(HR_PROFILE_FIELD_POLICIES)
    .filter(([, rawPolicy]) => {
      const policy: HrProfileFieldPolicy = rawPolicy;
      if (viewer === "HR") return true;
      if (viewer === "PAYROLL") return Boolean(policy.payrollSensitive || policy.managerVisible);
      if (viewer === "MANAGER") return Boolean(policy.managerVisible && !policy.hrOnly && !policy.payrollSensitive && !policy.securitySensitive);
      if (viewer === "AUDITOR") return !policy.encrypted;
      return !policy.hrOnly && !policy.payrollSensitive;
    })
    .map(([field]) => field);
}
