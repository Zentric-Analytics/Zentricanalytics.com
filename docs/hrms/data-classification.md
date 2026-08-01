# HRMS data classification

| Class | Examples | Storage | Display/export | Logging/notification |
| --- | --- | --- | --- | --- |
| Restricted credentials | Passwords, session/invitation/reset tokens, MFA secrets, provider keys | Password/token hashes; MFA and temporary delivery envelopes encrypted; secrets only in manager | Never displayed except pending MFA enrollment to the owner; never exported | Never logged or placed in notification bodies |
| Restricted financial/identity | Full bank, salary, tax/pension/government identifiers, identity documents | Decimal financial records; encrypted identifiers; private scanned objects | Only explicit payroll/sensitive permissions; bank schedule separately authorized | Audit keys redacted; emails contain references only |
| Confidential HR | Personal contacts, addresses, emergency contacts, leave reasons, employment/lifecycle records | Tenant-owned relational data/private objects | Owner or explicit HR/scoped supervisor permission with minimized fields | Safe metadata only |
| Internal operational | Department, position, asset tag, workflow state, report counts | Tenant-owned relational data | Permission/scoped views | Structured audit permitted without private content |
| Public | Public company/career content | Existing public models | Public routes | Normal operational logging |

Exports are server-generated, tenant-scoped, formula-safe, no-store, and audited. Private documents never use public permanent URLs. Test fixtures and documentation use synthetic values only.
