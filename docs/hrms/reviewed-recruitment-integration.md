# Reviewed recruitment integration

Owner: product owner and repository maintainers. Reviewed: 2026-09-05.
Evidence scope: local code and owner decisions; deployment and database migration remain ENVIRONMENT_PENDING.

## Reviewed direction

DOCUMENTED_POLICY: The owner approved consolidating recruitment administration into HRMS, while retaining the eight applicant stages and their records. The assigned hiring team owns candidate review and interviews. No creator approval is required before interviews. The vacancy creator or a selected vacancy-specific delegate approves the candidate and exact offer before issue. A creator may participate in the team and approve. A rejection is internal to the team, which communicates the applicant outcome.

DOCUMENTED_POLICY: Delegation requires a reason and specific active team members. Any selected delegate may approve; the creator manually ends delegation. Responsible HR is one named eligible person. After offer acceptance, the signed agreement and role schedule require either the team or creator/delegate approval before HR receives the handover. Named HR reviews stages six through eight.

DOCUMENTED_POLICY: After final HR approval, authorized HR sends company-mailbox setup details from the linked employee record to the verified personal application address. The system supplies instructions and an editable validated Reply-To destination. The employee confirms access by sending from the company mailbox to HR. HR then sends the HRMS invitation to that company mailbox. Account setup may precede the employment start date; employment activation remains separate. The owner accepted temporary-password email delivery for now; credentials must not be retained in record history.

## Implementation pointers

- VERIFIED_IMPLEMENTATION: `src/lib/hr/recruitment/stage-access.ts`, `src/app/hr/recruitment/`, and `src/app/admin/applications/actions.ts` consolidate authorization and existing stage forms. Old admin login redirects to HRMS. Legacy unscoped records remain restricted rather than silently assigned to an organization.
- VERIFIED_IMPLEMENTATION: `vacancy-authority.ts`, `vacancies.ts`, and `delegation.ts` implement vacancy role rules, creator publication, named HR, and scoped delegates. The additive migration is `prisma/migrations/20260906000000_reviewed_recruitment_ownership/migration.sql`.
- VERIFIED_IMPLEMENTATION: `offers.ts` binds approval to an exact version and connects acceptance to the agreement stage before handover. `handover.ts` uses the current named HR person. `workflow.ts` protects completed stages from replay regression.
- VERIFIED_IMPLEMENTATION: `stage-notifications.ts` routes submitted candidate information/screening to the active team, agreements to the team and creator, and onboarding/acknowledgements to named HR. Notices are queued in the submission transaction and exclude form contents.
- VERIFIED_IMPLEMENTATION: `mailbox-welcome.ts`, `employee-access.ts`, and the recruitment access actions use the linked application/employee/account identity. The mailbox secret is delivery-only; metadata history omits it. The actual invitation is sent to the company login address.
- VERIFIED_IMPLEMENTATION: Employee profile links to original application and documents and exposes permission-scoped event metadata. History is linked, not copied into an unrelated account. A bounded recent-event view is not a claim of exhaustive retention or migration verification.

## Release limits

VERIFIED_IMPLEMENTATION (2026-09-07, local): `stage-status.ts` synchronizes approvals of stages one through three with recruitment progress in the approval transaction, with version checks and reference-only history. Stage three refuses pending interview/assessment work. A scoped, explicit pre-offer reconciliation action checks contiguous approval evidence and the displayed record version; it refuses existing offers, terminal/held progress, and inconsistent stage positions. Pre-offer interviews can be scheduled from shortlisted, interview-pending, or final-review progress; scheduling returns progress to interview-scheduled and cannot bypass an existing offer. `hrms-stage-status-sync.test.ts` and `hrms-interview-eligibility.test.ts` cover these rules. This is not evidence of deployment or a completed fresh browser test.

VERIFIED_IMPLEMENTATION (2026-09-07, local regression evidence): final Stage 8 approval now calls `reviewed-completion.ts` in its serializable transaction. Matching signed identity/payroll submissions and explicit final checklist decisions can populate pending requirements using reference-only provenance through `stage-evidence.ts`. Right-to-work is not inferred from a candidate declaration; unresolved requirements, exact HR document reviews, conflicting identities/lifecycles, and cancelled handovers block completion. The completed eight-stage journey becomes the linked completed HR lifecycle rather than starting duplicate tasks or another applicant email. Existing completed applications have named-HR repair actions. Activation remains separate and evaluates the conversion-linked lifecycle. Live validation of this correction remains pending.

ENVIRONMENT_PENDING: No shared database was migrated and no deployment is established by these code changes. Existing vacancies need a valid named HR person before publication or handover. Unmapped historical records require deliberate organization/vacancy assignment; the migration does not guess ownership or delete records.

UNRESOLVED: Live mail delivery, private-document access, historical-data completeness, database concurrency, and the full authenticated browser journey require environment validation. Manual mailbox confirmation does not independently verify Microsoft password change or MFA. Older generated matrices describe pre-review behavior until regenerated and reconciled; use the source pointers above for this change set.
