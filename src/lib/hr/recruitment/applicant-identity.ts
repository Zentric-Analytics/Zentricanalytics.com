export function applicantIdentityFilter(input: {
  organizationId: string;
  normalizedEmail: string;
}) {
  return {
    organizationId: input.organizationId,
    normalizedEmail: input.normalizedEmail.trim().toLowerCase(),
  };
}
