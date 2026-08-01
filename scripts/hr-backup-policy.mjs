export function minimumPitrRetentionDays(appEnv) {
  return String(appEnv ?? "").trim().toLowerCase() === "staging" ? 7 : 30;
}
