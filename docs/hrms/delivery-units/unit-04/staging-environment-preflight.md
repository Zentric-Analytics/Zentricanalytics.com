# Unit 4 staging environment preflight

Verified: 2026-08-09

- Local worktree: `C:\Users\worki\Documents\Codex\2026-07-31\don-t-stop-here-this-fix\work\unit3-validation`
- Remote: `https://github.com/Zentric-Analytics/Zentricanalytics.com.git`
- Branch: `feature/hrms-unit-04-workforce-operations`
- Render workspace: `Staging Workspace`
- Render project/environment: `Zentric Analytics-Staging / Staging`
- Web service: `Zentricanalytics.com-Staging` (`srv-d8s6ovvavr4c73fctksg`)
- Application host: `staging.zentricanalytics.com`
- PostgreSQL: `zentric_analytics_staging` on `dpg-d8s9itj6sc1c73c6vsl0-a`
- Object storage: `s3-compatible`, bucket classified by the running service as staging-scoped
- Email behavior: Resend provider configured in staging
- Email worker, organization worker, and document scanner secrets: present; values were not displayed

The running-service preflight returned `APP_ENV=staging`. No production URL, production database, production secret, or production configuration was inspected or changed. Unit 4 migration application remains pending.
