/// <reference types="vite/client" />

import manifest from '../content/manifest.json' with { type: 'json' };

import { type DailyCase, dailyCaseSchema } from './schema.js';

type ManifestEntry = {
  caseNumber: number;
  revision: number;
  file: string;
};

type CaseManifest = {
  schemaVersion: 2;
  cases: Record<string, ManifestEntry>;
};

type CaseModules = Record<string, unknown>;

type PublishedCaseIndex = { date: string; caseNumber: number };

const datePattern = /^\d{4}-\d{2}-\d{2}$/;

export class CaseContentError extends Error {
  override name = 'CaseContentError';
}

function fail(message: string): never {
  throw new CaseContentError(message);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function positiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
}

function isDate(value: string): boolean {
  if (!datePattern.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  );
}

function parseManifest(value: unknown): CaseManifest {
  if (!isRecord(value) || value.schemaVersion !== 2 || !isRecord(value.cases)) {
    fail('Case manifest must be a schema version 2 object with cases.');
  }

  const cases: Record<string, ManifestEntry> = {};
  for (const [date, entry] of Object.entries(value.cases)) {
    if (!isDate(date) || !isRecord(entry)) {
      fail('Case manifest contains an invalid case entry.');
    }
    if (
      !positiveInteger(entry.caseNumber) ||
      !positiveInteger(entry.revision) ||
      typeof entry.file !== 'string' ||
      !entry.file.startsWith('./cases/') ||
      !entry.file.endsWith('.json')
    ) {
      fail(`Case manifest entry for ${date} is invalid.`);
    }
    cases[date] = {
      caseNumber: entry.caseNumber,
      revision: entry.revision,
      file: entry.file,
    };
  }

  return { schemaVersion: 2, cases };
}

function normalizePath(path: string): string {
  return path.replaceAll('\\', '/').replace(/^\.\//, '');
}

function resolveModule(modules: CaseModules, file: string): unknown {
  const expected = normalizePath(`content/${file.slice(2)}`);
  const matches = Object.entries(modules).filter(([path]) =>
    normalizePath(path).endsWith(expected),
  );

  if (matches.length !== 1) {
    fail(`Published case artifact ${file} could not be resolved.`);
  }
  return matches[0][1];
}

function parseCaseArtifact(
  artifact: unknown,
  date: string,
  entry: ManifestEntry,
): DailyCase {
  let parsed: DailyCase;
  try {
    parsed = dailyCaseSchema.parse(artifact);
  } catch (error) {
    const detail = error instanceof Error ? `: ${error.message}` : '';
    fail(`Published case artifact for ${date} is invalid${detail}`);
  }

  if (
    parsed.publicationDate !== date ||
    parsed.revision !== entry.revision ||
    parsed.caseNumber !== entry.caseNumber
  ) {
    fail(
      `Published case artifact for ${date} does not match its manifest entry.`,
    );
  }
  return parsed;
}

export function createCaseLoader(manifestValue: unknown, modules: CaseModules) {
  const parsedManifest = parseManifest(manifestValue);
  const publishedCases = Object.entries(parsedManifest.cases)
    .map(([date, entry]) => ({ date, caseNumber: entry.caseNumber }))
    .sort((left, right) => right.date.localeCompare(left.date));

  return {
    loadPublishedCase(date: string): DailyCase | null {
      if (!isDate(date)) fail(`Invalid publication date: ${date}`);
      const entry = parsedManifest.cases[date];
      if (entry === undefined) return null;
      return parseCaseArtifact(resolveModule(modules, entry.file), date, entry);
    },
    listPublishedCases(): PublishedCaseIndex[] {
      return publishedCases.map((entry) => ({ ...entry }));
    },
  };
}

const caseModules = import.meta.glob('../content/cases/**/*.json', {
  eager: true,
  import: 'default',
}) as CaseModules;

const loader = createCaseLoader(manifest, caseModules);

export const loadPublishedCase = loader.loadPublishedCase;
export const listPublishedCases = loader.listPublishedCases;
