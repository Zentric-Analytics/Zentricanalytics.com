export type VacancyAuthority = {
  id: string;
  isPrimaryAdmin: boolean;
  roles: readonly string[];
};

export function canApproveReviewedVacancy(creator: VacancyAuthority, approver: VacancyAuthority): boolean {
  const primary = (user: VacancyAuthority) => user.isPrimaryAdmin && user.roles.includes("ADMIN");
  if (primary(creator)) return approver.id === creator.id && primary(approver);
  if (creator.id === approver.id) return false;
  if (creator.roles.includes("ADMIN")) return primary(approver) || approver.roles.includes("HR_ADMIN");
  if (creator.roles.includes("HR_ADMIN")) return approver.roles.includes("ADMIN");
  return false;
}
