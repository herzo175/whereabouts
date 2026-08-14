import { type DailyCase, dailyCaseSchema } from '@whereabouts/case-content';

export type ValidationIssue = { path: string; message: string };

const leakMessage =
  'Pre-reveal text leaks target POI, destination, city, or country';

function normalize(value: string): string {
  return value.toLocaleLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
}

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

function parseCase(value: unknown): DailyCase | undefined {
  try {
    return dailyCaseSchema.parse(value);
  } catch {
    return undefined;
  }
}

export function validateCaseForPublication(value: unknown): ValidationIssue[] {
  const dailyCase = parseCase(value);
  if (!dailyCase)
    return [
      {
        path: 'schema',
        message: 'Case does not satisfy the daily case schema',
      },
    ];

  const target = dailyCase.pois.find(
    (poi) => poi.id === dailyCase.target.poiId,
  );
  if (!target)
    return [{ path: 'target.poiId', message: 'Target POI could not be found' }];
  const prohibited = new Set(
    [target.name, dailyCase.target.destinationName, target.city, target.country]
      .map(normalize)
      .filter(Boolean),
  );
  const issues: ValidationIssue[] = [];
  const preReveal = [
    ...dailyCase.clues.map((clue, index) => ({
      path: `clues[${index}].text`,
      text: clue.text,
    })),
    ...dailyCase.contextualResponses.map((response, index) => ({
      path: `contextualResponses[${index}].text`,
      text: response.text,
    })),
  ];
  for (const item of preReveal) {
    const text = normalize(item.text);
    if ([...prohibited].some((term) => text.includes(term))) {
      issues.push({ path: item.path, message: leakMessage });
    }
  }

  const coordinates = new Map<string, number>();
  for (const [index, poi] of dailyCase.pois.entries()) {
    const key = `${poi.latitude.toFixed(4)},${poi.longitude.toFixed(4)}`;
    if (coordinates.has(key)) {
      issues.push({
        path: `pois[${index}]`,
        message: 'POI coordinates duplicate another POI at four decimal places',
      });
    } else coordinates.set(key, index);
  }
  return issues;
}

export function validateCollection(
  values: unknown[],
  publicationCeiling: string,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!canonicalDate(publicationCeiling)) {
    return [
      {
        path: 'publicationCeiling',
        message: 'Publication ceiling must be a canonical ISO date',
      },
    ];
  }
  const parsed = values.map((value, index) => ({
    value: parseCase(value),
    index,
  }));
  for (const { value, index } of parsed) {
    if (!value) {
      issues.push({
        path: `cases[${index}]`,
        message: 'Case does not satisfy the daily case schema',
      });
      continue;
    }
    if (!canonicalDate(value.publicationDate)) {
      issues.push({
        path: `cases[${index}].publicationDate`,
        message: 'Publication date must be a canonical ISO date',
      });
    }
    if (value.publicationDate > publicationCeiling) {
      issues.push({
        path: `cases[${index}].publicationDate`,
        message: 'Case publication date is after the publication ceiling',
      });
    }
  }
  const valid = parsed.filter(
    (entry): entry is { value: DailyCase; index: number } =>
      entry.value !== undefined,
  );
  const dates = new Map<string, number>();
  const numbers = new Map<number, number>();
  const revisions = new Map<string, number>();
  for (const { value, index } of valid) {
    if (dates.has(value.publicationDate))
      issues.push({
        path: `cases[${index}].publicationDate`,
        message: 'Duplicate publication date',
      });
    else dates.set(value.publicationDate, index);
    if (numbers.has(value.caseNumber))
      issues.push({
        path: `cases[${index}].caseNumber`,
        message: 'Duplicate case number',
      });
    else numbers.set(value.caseNumber, index);
    const revisionKey = `${value.publicationDate}:${value.revision}`;
    if (revisions.has(revisionKey))
      issues.push({
        path: `cases[${index}].revision`,
        message: 'Duplicate revision for publication date',
      });
    else revisions.set(revisionKey, index);
  }
  const published = valid
    .filter((entry) => entry.value.publicationDate <= publicationCeiling)
    .sort(
      (a, b) =>
        a.value.publicationDate.localeCompare(b.value.publicationDate) ||
        a.value.revision - b.value.revision,
    );
  for (const entry of published) {
    const { value, index } = entry;
    const previous = published.slice(
      Math.max(0, published.indexOf(entry) - 30),
      published.indexOf(entry),
    );
    if (
      previous.some(
        ({ value: prior }) => prior.target.poiId === value.target.poiId,
      )
    ) {
      issues.push({
        path: `cases[${index}].target.poiId`,
        message: 'Target POI was used within the previous 30 published cases',
      });
    }
    const window = [...previous, entry];
    if (window.length < 30) continue;
    const targetId = value.target.poiId;
    for (const poi of value.pois) {
      if (poi.id === targetId) continue;
      const count = window.filter(
        ({ value: candidate }) =>
          candidate.target.poiId !== poi.id &&
          candidate.pois.some((candidatePoi) => candidatePoi.id === poi.id),
      ).length;
      if (count / window.length > 0.4) {
        issues.push({
          path: `cases[${index}].pois`,
          message:
            'Distractor appears in more than 40% of the rolling 30-case window',
        });
        break;
      }
    }
  }
  return issues;
}
