# HR storage model

HR files use the `HrObjectStorage` boundary with upload, authenticated read, existence, metadata, and controlled deletion operations. The local adapter is development-only; application code refuses it when `NODE_ENV=production`. Production uses a private S3-compatible bucket (Amazon S3, Cloudflare R2, MinIO, or an equivalent service) with blocked public access and optional AES-256 server-side encryption.

Files never enter `public/` and object keys never establish authority. Downloads stream through authenticated HR routes, return `private, no-store`, `nosniff`, and sandbox headers, and apply record ownership plus permission checks before storage access.

Employee document uploads:

- accept only PDF, JPEG, and PNG;
- validate file signatures against the declared MIME type;
- enforce `UPLOAD_MAX_BYTES`;
- sanitize display filenames and generate opaque object keys;
- calculate SHA-256 checksums;
- verify stored object size;
- persist logical-document and immutable-version metadata;
- remain unavailable while scan status is `PENDING`, `QUARANTINED`, or `FAILED`;
- create immutable access logs and audit events for downloads.

Production must connect the scan-result action to an approved malware scanner during hardening. A human-authorized scan result is available for controlled staging validation; it is not a substitute for production malware scanning. Retention hold and archive metadata never delete stored records. Physical deletion requires a separately reviewed retention worker and is intentionally absent.

Required production configuration is documented in `.env.example` and `docs/hrms/deployment.md`.
