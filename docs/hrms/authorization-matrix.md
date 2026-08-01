# HRMS authorization matrix

| Capability | ADMIN | HR_ADMIN | PAYROLL_ADMIN | EMPLOYEE | Assignment-derived supervisor |
| --- | --- | --- | --- | --- | --- |
| Users and roles | Full; privileged assignment restricted to ADMIN | Create/invite/update employees only; cannot grant privileged roles | None | Self only | None |
| Employee profile | All | All operational fields | Read needed payroll context | Owned profile | Scoped non-sensitive team data |
| Bank/compensation | Explicit payroll permissions | Denied | Explicit payroll permissions | Masked/owned outputs only | Denied |
| Leave | Configure/override/review | Configure/override/review | Denied unless explicit catalog permission | Own request/history | Review current assigned scope |
| Payroll | Full explicit permissions | Denied | Create/calculate/review/approve/export | Own locked payslips | Denied |
| Documents | All explicit permissions | Employee documents; sensitive category permission | No broad document administration | Own non-archived clean versions | Leave evidence only in current scope |
| Assets | Manage/assign/return | Manage/assign/return | Denied | Own custody/acknowledgement | No implicit asset access |
| Lifecycle/workflow | Create/assign/override | HR workflow operations | Assigned payroll tasks | Own assigned tasks | Current scoped assigned tasks |
| Reports/audit/settings | All | HR reports/audit; no settings or full bank | Payroll reports, separately authorized bank export | None | Scoped dashboard only |
| MFA reset | Emergency reset | Denied | Denied | Own MFA | Own MFA |

Every operation rehydrates active roles and permissions from the database. Role changes revoke sessions; deleted, ended, revoked, future, or expired supervisor assignments grant no scope. Direct assignment wins over team, which wins over department. All object reads and mutations require organization scope or owned-parent scope. UI visibility is not an authorization control.
