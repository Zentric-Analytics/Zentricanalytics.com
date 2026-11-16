// Both runners support this small callback-only API. Keep execution selection,
// test bodies and assertions identical; avoid an incompatible overload union.
const api = process.env.VITEST ? await import('vitest') : await import('node:test');
export const describe = api.describe;
export const it = api.it;
