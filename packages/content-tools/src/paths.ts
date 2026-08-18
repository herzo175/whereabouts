import { fileURLToPath } from 'node:url';

export const caseContentRoot = fileURLToPath(
  new URL('../../case-content/content/', import.meta.url),
);

function canonicalDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

export function casePath(date: string, revision: number): string {
  if (!canonicalDate(date))
    throw new Error('date must be a canonical ISO date');
  if (!Number.isInteger(revision) || revision <= 0)
    throw new Error('revision must be a positive integer');
  const path = fileURLToPath(
    new URL(
      `cases/${date}/v${revision}.json`,
      new URL('../../case-content/content/', import.meta.url),
    ),
  );
  if (!path.startsWith(caseContentRoot))
    throw new Error('case path escapes content root');
  return path;
}

function contentPath(
  date: string,
  revision: number,
  directory: string,
  extension: string,
): string {
  if (!canonicalDate(date))
    throw new Error('date must be a canonical ISO date');
  if (!Number.isInteger(revision) || revision <= 0)
    throw new Error('revision must be a positive integer');
  const path = fileURLToPath(
    new URL(
      `${directory}/${date}/v${revision}.${extension}`,
      new URL('../../case-content/content/', import.meta.url),
    ),
  );
  if (!path.startsWith(caseContentRoot))
    throw new Error('content path escapes content root');
  return path;
}

export const generationReviewPath = (date: string, revision: number): string =>
  contentPath(date, revision, 'reviews', 'json');
export const reviewMarkdownPath = (date: string, revision: number): string =>
  contentPath(date, revision, 'reviews', 'md');
