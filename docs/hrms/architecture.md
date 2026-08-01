# HRMS architecture

## Repository baseline

The site is a Next.js 15 App Router application using React 19, strict TypeScript, Prisma/PostgreSQL, Zod, Vitest, Resend-compatible email delivery, `pdf-lib`, and private recruitment uploads. Recruitment owns `Applicant`, `JobApplication`, stages, offers, agreements, access codes, documents, notifications, audit logs, and the legacy environment-backed admin session. HRMS is a separate domain under `src/lib/hr` and `/hr`; recruitment models and authentication remain intact during migration.

Baseline on 2026-07-29: install, lint, Prisma format/validate, and production build passed. The pre-existing suite had 162 passing tests and one brittle source-order assertion failure in `tests/hiring.test.ts`. The repository initially had no lockfile although Render required one, Next 15.3.4 was reported vulnerable, and `next.config.mjs` declared `headers()` twice.

## Boundaries

- UI: `/hr/login`, `/hr/admin`, `/hr/employee`, and `/hr/supervisor`, each with separate navigation.
- Identity: database-backed HR users, hashed credentials/tokens/sessions, no public registration.
- Authorization: permissions are evaluated server-side; supervisor capability derives only from active assignments.
- Services: focused modules for auth, permissions, audit, notifications, and storage.
- Data: HR tables are organization-scoped and do not overload recruitment records.

Milestone 1 supplies secure identity, authorization, audit/outbox/storage foundations, portal shells, user administration, and assignment schema. Business modules follow the milestones in `milestones.md`.
