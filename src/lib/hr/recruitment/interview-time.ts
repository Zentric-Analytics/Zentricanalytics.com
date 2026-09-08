/** Interpret datetime-local values in the selected zone, never the server zone. */
export function interviewLocalTime(value: string, timeZone: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value);
  if (!match) throw new Error('Enter a valid local interview date and time.');
  const [year, month, day, hour, minute, second] = match.slice(1).map(v => Number(v ?? 0));
  const wall = new Date(0);
  wall.setUTCFullYear(year, month - 1, day);
  wall.setUTCHours(hour, minute, second, 0);
  if (year < 1900 || wall.getUTCFullYear() !== year || wall.getUTCMonth() !== month - 1 ||
      wall.getUTCDate() !== day || wall.getUTCHours() !== hour ||
      wall.getUTCMinutes() !== minute || wall.getUTCSeconds() !== second) {
    throw new Error('Enter a valid local interview date and time.');
  }
  let formatter: Intl.DateTimeFormat;
  try {
    formatter = new Intl.DateTimeFormat('en-CA', { timeZone, hourCycle: 'h23',
      year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch { throw new Error('Select a valid interview time zone.'); }
  const localStamp = (instant: number) => {
    const parts = Object.fromEntries(formatter.formatToParts(instant).map(p => [p.type, p.value]));
    return Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day),
      Number(parts.hour), Number(parts.minute), Number(parts.second));
  };
  // Collect offsets on both sides of nearby clock changes. Round-trip every
  // candidate: gaps and repeated local times must not be silently guessed.
  const offsets = new Set<number>();
  for (let hours = -36; hours <= 36; hours += 6) {
    const instant = wall.getTime() + hours * 3_600_000;
    offsets.add(localStamp(instant) - instant);
  }
  const matches = [...offsets].map(offset => wall.getTime() - offset)
    .filter(instant => localStamp(instant) === wall.getTime());
  if (matches.length === 0) throw new Error('This local time does not exist because the clocks change. Choose another time.');
  if (matches.length !== 1) throw new Error('This local time occurs twice because the clocks change. Choose an unambiguous time.');
  return new Date(matches[0]);
}

export function interviewLocalRange(startsAt: string, endsAt: string, timeZone: string) {
  const start = interviewLocalTime(startsAt, timeZone);
  const end = interviewLocalTime(endsAt, timeZone);
  if (end <= start) throw new Error('Interview must end after it starts.');
  return { startsAt: start, endsAt: end };
}

export function formatInterviewTime(value: Date, timeZone: string) {
  const options: Intl.DateTimeFormatOptions = { dateStyle: 'full', timeStyle: 'short', timeZone };
  try { return `${new Intl.DateTimeFormat('en-US', options).format(value)} (${timeZone})`; }
  catch { return `${new Intl.DateTimeFormat('en-US', { ...options, timeZone: 'UTC' }).format(value)} (UTC)`; }
}
