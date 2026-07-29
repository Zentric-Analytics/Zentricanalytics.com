# Documents and assets

Milestone 5 adds private employee document lifecycle and asset custody without modifying recruitment uploads.

## Documents

`HrEmployeeDocument` is the logical record; `HrEmployeeDocumentVersion` is an immutable stored-file version. Metadata includes employee, category, original and safe filenames, MIME type, size, provider/key, checksum, version, restriction, retention, scan, archive, uploader, and timestamps. Sensitive categories are always restricted even if a form attempts to clear the flag.

Employees can upload and read only their own active records. Standard staff access requires `document.read_employee`; restricted records require `document.read_sensitive`. Downloads require a `CLEAN` scan, use authenticated streaming, and append both `HrDocumentAccessLog` and `HrAuditEvent`. Archiving preserves every object and version. Expiry reminders use reference-only outbox payloads.

## Assets

`HrAsset` tracks tag, type, name, manufacturer/model, serial, purchase metadata, condition, and lifecycle status. `HrAssetAssignment` preserves custody, issue condition, employee acknowledgement, expected return, actual return, return condition, notes, and actors. A database partial unique index permits only one active assignment per asset.

Assignments and returns run in serializable transactions and update current inventory status atomically. Damaged/unusable returns move to repair; reported loss closes custody as lost. Employees see and acknowledge only their own assignments. Supervisors receive no direct asset mutation authority; a future workflow task must explicitly delegate any confirmation.

Allowed inventory state transitions prevent disposed, retired, assigned, or lost assets from silently returning to service. Assignment history is protected from deletion and core-field edits by database triggers.

## Deployment

Apply `20260730030000_hrms_documents_assets`, configure durable private object storage, run `yarn hr:preflight`, and validate upload → scan → download plus assign → acknowledge → return in staging. Do not enable production document uploads until a real malware scanner and retention policy are configured.
