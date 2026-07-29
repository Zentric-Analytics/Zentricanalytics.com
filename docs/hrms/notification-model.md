# Notification model

Critical transactions create an `HrEmailOutbox` row in the same Prisma transaction as the domain change. Delivery is asynchronous and idempotent. Jobs track status, attempts, next attempt, safe payload, provider response, and delivery time; every attempt has a child record.

Payloads contain references and non-sensitive template data only. Passwords, raw tokens, salary, bank numbers, and identity documents are forbidden. A secured worker endpoint is a deployment prerequisite before production delivery is enabled.
