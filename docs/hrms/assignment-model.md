# Assignment model

Supervisor authority is an effective-dated `HrSupervisorAssignment`, never a global role. It records organization, supervisor employee, optional assigned employee or future team scope, type, status, effective dates, granted capabilities, assigning user, reason, and end metadata.

Access requires an ACTIVE assignment whose start is not in the future and whose end is absent or in the future. Revoked, suspended, ended, and expired assignments deny access immediately while history remains.

ADMIN may manage all assignments. HR_ADMIN may manage operational assignments. PAYROLL_ADMIN and EMPLOYEE cannot. Assignment mutations are transactional, append audit events, and never overwrite historical rows.
