# Notification model

Critical transactions create an `HrEmailOutbox` row in the same Prisma transaction as the domain change. Delivery is asynchronous and idempotent. Jobs track status, attempts, next attempt, safe payload, provider response, and delivery time; every attempt has a child record.

Payloads contain references and non-sensitive template data only. Passwords, raw tokens, salary, bank numbers, and identity documents are forbidden. `POST /api/internal/hr/outbox` claims jobs with optimistic concurrency, recovers stale claims, records immutable attempts, retries with bounded exponential backoff, abandons after five attempts, and sends a generic portal notification that never expands protected payload data. It requires `EMAIL_WORKER_SECRET`.
