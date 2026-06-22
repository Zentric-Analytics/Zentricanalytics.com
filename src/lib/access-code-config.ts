export function numericEnv(name: string, fallback: number) {
  const value = Number(process.env[name]);
  return Number.isSafeInteger(value) && value > 0 ? value : fallback;
}

export const accessCodeRateLimitConfig = {
  requestLimit: () => numericEnv('ACCESS_CODE_REQUEST_LIMIT', 5),
  verifyLimit: () => numericEnv('ACCESS_CODE_VERIFY_LIMIT', 5),
  windowMs: () => numericEnv('RATE_LIMIT_WINDOW_MS', 15 * 60 * 1000),
};
