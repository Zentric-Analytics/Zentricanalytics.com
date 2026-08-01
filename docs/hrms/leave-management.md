# Leave Management (Milestone 3)

Leave Management is policy-driven, effective-dated, and ledger-backed. It does not store a single mutable “remaining days” value.

## Policy model

Administrators create leave types and versioned policies. A new policy version closes the prior version; existing requests retain the exact policy used when submitted. Policies configure entitlement, unit, accrual frequency/amount, maximum balance, carry-over and expiry, notice, consecutive limits, probation, negative balances, approval, payment, and attachment requirements.

Employee policy assignments are effective-dated. Assigning an annual policy initializes the year balance and an idempotent opening ledger entry.

## Balance invariants

Available balance is:

`opening + accrued + carriedOver + adjusted - reserved - used - expired`

Every opening, accrual, carry-over, adjustment, reservation, release, approval, restoration, and expiry has an immutable `HrLeaveLedger` row with a unique idempotency key. Balance aggregates are updated in the same serializable transaction.

Monthly and quarterly accrual runs, year carry-over, and carry-over expiry are safe to retry. Policy maximum balances cap scheduled accruals.

## Request workflow

1. The employee selects an assigned leave type, dates, reason, and optional/required evidence.
2. The server calculates organization working days and excludes configured public holidays.
3. Policy notice, probation, consecutive, overlap, and balance rules are validated.
4. The amount is reserved while the request is pending.
5. The active direct supervisor receives the review task. HR users with organization-wide permission can also review.
6. Approval converts reserved units to used units. Rejection or withdrawal releases the reservation.
7. Authorized cancellation restores approved units.

All transitions are audited and decision notifications use the HR outbox.

## Private attachments

PDF, JPEG, and PNG attachments are limited to 10 MB, checksum-recorded, and stored outside the database. Production uses the S3-compatible provider through `@aws-sdk/client-s3`; local storage is refused in production. Downloads require self, assignment-scoped supervisor, organization leave, or employee-document permission and return `private, no-store`.

Configure `OBJECT_STORAGE_PROVIDER`, endpoint, region, bucket, access key, secret, path-style mode, and optional `OBJECT_STORAGE_SERVER_SIDE_ENCRYPTION=AES256`. Never expose the bucket publicly.

## Deployment

Migration `20260730010000_hrms_leave_management` is additive. Back up PostgreSQL, apply migrations, run `yarn hr:preflight`, configure private storage before testing attachments, and smoke-test employee submission, supervisor approval/rejection, HR override, balance restoration, notifications, and calendar visibility.
