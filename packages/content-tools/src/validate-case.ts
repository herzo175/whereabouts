import { type DailyCase, dailyCaseSchema } from '@whereabouts/case-content';
import {
  candidateSpacingViolations,
  MIN_CANDIDATE_DISTANCE_KM,
} from './candidate-spacing.js';

export type ValidationIssue = { path: string; message: string };

const leakMessage =
  'Pre-reveal text leaks target POI, destination, city, or country';

function normalize(value: string): string {
  return value.toLocaleLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
}

function leaksIdentity(text: string, identity: string): boolean {
  const term = normalize(identity);
  if (!term) return false;
  if (term.length >= 4) return normalize(text).includes(term);
  return (text.toLocaleLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [])
    .map(normalize)
    .includes(term);
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

function targetIds(dailyCase: DailyCase): string[] {
  return dailyCase.rounds.map((round) => round.targetPoiId);
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

  const issues: ValidationIssue[] = [];
  const rounds = dailyCase.rounds.map((round, roundIndex) => ({
    targetPoiId: round.targetPoiId,
    preReveal: [
      { path: `rounds[${roundIndex}].clue.text`, text: round.clue.text },
    ],
  }));
  for (const round of rounds) {
    const target = dailyCase.pois.find((poi) => poi.id === round.targetPoiId);
    if (!target) {
      issues.push({
        path: 'target.poiId',
        message: 'Target POI could not be found',
      });
      continue;
    }
    const prohibited = [target.name, target.city, target.country];
    for (const item of round.preReveal) {
      if (prohibited.some((term) => leaksIdentity(item.text, term))) {
        issues.push({ path: item.path, message: leakMessage });
      }
    }
  }

  for (const [roundIndex, round] of dailyCase.rounds.entries()) {
    const incorrectPoints = round.results
      .filter((result) => result.poiId !== round.targetPoiId)
      .map((result) => result.points);
    const spansEveryBand =
      incorrectPoints.some((points) => points >= 75) &&
      incorrectPoints.some((points) => points >= 40 && points < 75) &&
      incorrectPoints.some((points) => points < 40);
    if (!spansEveryBand || new Set(incorrectPoints).size < 8) {
      issues.push({
        path: `rounds[${roundIndex}].results`,
        message:
          'Round scores must span hot, warm, and cold bands with meaningful variation',
      });
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
  for (const violation of candidateSpacingViolations(dailyCase.pois))
    issues.push({
      path: 'pois',
      message: `Candidate POIs ${violation.firstId} and ${violation.secondId} are ${violation.distanceKm.toFixed(2)} km apart; minimum is ${MIN_CANDIDATE_DISTANCE_KM} km`,
    });
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
      previous.some(({ value: prior }) =>
        targetIds(prior).some((targetId) =>
          targetIds(value).includes(targetId),
        ),
      )
    ) {
      issues.push({
        path: `cases[${index}].rounds`,
        message: 'Target POI was used within the previous 30 published cases',
      });
    }
    const window = [...previous, entry];
    if (window.length < 30) continue;
    const targetIdsForCase = new Set(targetIds(value));
    for (const poi of value.pois) {
      if (targetIdsForCase.has(poi.id)) continue;
      const count = window.filter(
        ({ value: candidate }) =>
          !targetIds(candidate).includes(poi.id) &&
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
