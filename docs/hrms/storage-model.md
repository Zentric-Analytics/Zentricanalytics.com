# Storage model

HR storage uses a provider interface with local development and S3-compatible implementations. Local storage is rejected for production HR documents. Object keys are generated, normalized, private, and never accepted as authorization proof.

Production requires a private bucket, encryption at rest, blocked public access, short-lived signed downloads, MIME/signature validation, size limits, access logs, retention rules, and malware quarantine before release. Milestone 1 provides configuration and adapter boundaries; document persistence arrives in Milestone 6.
