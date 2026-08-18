import { access } from 'node:fs/promises';

export type ManifestEntry = {
  caseNumber: number;
  revision: number;
  file: string;
};

const DAY = 86_400_000;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;

export function isCanonicalDate(value: string): boolean {
  if (!datePattern.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  );
}

function assertDate(value: string): void {
  if (!isCanonicalDate(value))
    throw new Error('date must be a canonical ISO date');
}

export function bufferDates(from: string, days = 10): string[] {
  assertDate(from);
  if (!Number.isInteger(days) || days <= 0)
    throw new Error('days must be a positive integer');
  const start = Date.parse(`${from}T00:00:00Z`);
  return Array.from({ length: days }, (_, offset) =>
    new Date(start + offset * DAY).toISOString().slice(0, 10),
  );
}

export function missingBufferDates(
  window: readonly string[],
  published: ReadonlySet<string> | Readonly<Record<string, unknown>>,
): string[] {
  const isPublished = (date: string) =>
    published instanceof Set ? published.has(date) : date in published;
  return window.filter((date) => {
    assertDate(date);
    return !isPublished(date);
  });
}

export function caseNumberForDate(date: string): number {
  assertDate(date);
  return Math.floor(Date.parse(`${date}T00:00:00Z`) / DAY);
}

export function nextRevision(
  date: string,
  existingPaths: Iterable<string>,
): number {
  assertDate(date);
  let maximum = 0;
  let sawUnversioned = false;
  for (const path of existingPaths) {
    if (!path.includes(date)) continue;
    const match = /(?:^|[/\\])v(\d+)\.(?:json|md)$/.exec(path);
    if (!match) {
      sawUnversioned = true;
      continue;
    }
    maximum = Math.max(maximum, Number(match[1]));
  }
  if (sawUnversioned) throw new Error('existing path has no valid revision');
  return maximum + 1;
}

export async function pathExists(
  path: string,
  check: (path: string) => Promise<void> = access,
): Promise<boolean> {
  try {
    await check(path);
    return true;
  } catch (error) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'ENOENT'
    )
      return false;
    throw error;
  }
}
