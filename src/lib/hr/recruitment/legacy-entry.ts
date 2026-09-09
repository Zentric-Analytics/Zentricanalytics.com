export type LegacySearchParams = Record<string, string | string[] | undefined>;

/** Retain filters and result messages, never a caller-provided destination. */
export function recruitmentEntryUrl(path: string, params: LegacySearchParams = {}) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) continue;
    for (const item of Array.isArray(value) ? value : [value]) query.append(key, item);
  }
  return `${path}${query.size ? `?${query}` : ''}`;
}
