import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

describe('production security headers', () => {
  it('applies safe baseline headers to every route', () => {
    const config = readFileSync('next.config.mjs', 'utf8');

    expect(config).toContain("source: '/:path*'");
    expect(config).toContain("{ key: 'X-Content-Type-Options', value: 'nosniff' }");
    expect(config).toContain("{ key: 'X-Frame-Options', value: 'DENY' }");
    expect(config).toContain("{ key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' }");
    expect(config).toContain("value: 'camera=(), microphone=(), geolocation=()'");
  });
});
