import { readdir, readFile, stat } from 'node:fs/promises';
import { relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { dailyCaseSchema } from '@whereabouts/case-content';
import { caseContentRoot, casePath } from './paths.js';
import {
  type ValidationIssue,
  validateCaseForPublication,
  validateCollection,
} from './validate-case.js';

type ManifestEntry = { caseNumber: number; revision: number; file: string };

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

function canonicalDate(value: string): boolean {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(Date.parse(`${value}T00:00:00Z`))
  );
}

async function json(path: string): Promise<unknown> {
  return JSON.parse(await readFile(path, 'utf8'));
}

async function artifactPaths(): Promise<string[]> {
  const casesRoot = resolve(caseContentRoot, 'cases');
  const dates = await readdir(casesRoot, { withFileTypes: true }).catch(
    () => [],
  );
  const files: string[] = [];
  for (const date of dates) {
    if (!date.isDirectory()) continue;
    const revisions = await readdir(resolve(casesRoot, date.name), {
      withFileTypes: true,
    });
    for (const revision of revisions) {
      if (revision.isFile() && /^v[1-9]\d*\.json$/.test(revision.name)) {
        files.push(resolve(casesRoot, date.name, revision.name));
      }
    }
  }
  return files;
}

export async function validateAll(
  publicationCeiling = todayUtc(),
): Promise<ValidationIssue[]> {
  const issues: ValidationIssue[] = [];
  if (!canonicalDate(publicationCeiling))
    return [
      { path: 'publicationCeiling', message: 'must be a canonical ISO date' },
    ];
  let manifest: { cases?: Record<string, ManifestEntry> };
  try {
    manifest = (await json(
      resolve(caseContentRoot, 'manifest.json'),
    )) as typeof manifest;
  } catch {
    return [{ path: 'manifest.json', message: 'cannot be read as JSON' }];
  }
  if (!manifest.cases || typeof manifest.cases !== 'object') {
    return [{ path: 'manifest.cases', message: 'must be an object' }];
  }
  const cases: unknown[] = [];
  const referenced = new Set<string>();
  for (const [date, entry] of Object.entries(manifest.cases)) {
    if (!canonicalDate(date) || !entry || typeof entry !== 'object') {
      issues.push({
        path: `manifest.cases.${date}`,
        message: 'has an invalid entry',
      });
      continue;
    }
    let file: string;
    try {
      file = casePath(date, entry.revision);
    } catch {
      issues.push({
        path: `manifest.cases.${date}`,
        message: 'has an invalid revision or date',
      });
      continue;
    }
    const declared = resolve(caseContentRoot, entry.file);
    if (declared !== file)
      issues.push({
        path: `manifest.cases.${date}.file`,
        message: 'does not match the canonical case artifact path',
      });
    referenced.add(file);
    try {
      await stat(file);
    } catch {
      issues.push({
        path: `manifest.cases.${date}.file`,
        message: 'references a missing case artifact',
      });
      continue;
    }
    let value: unknown;
    try {
      value = await json(file);
    } catch {
      issues.push({
        path: relative(caseContentRoot, file),
        message: 'cannot be read as JSON',
      });
      continue;
    }
    cases.push(value);
    try {
      const parsed = dailyCaseSchema.parse(value);
      if (
        parsed.publicationDate !== date ||
        parsed.caseNumber !== entry.caseNumber ||
        parsed.revision !== entry.revision
      ) {
        issues.push({
          path: relative(caseContentRoot, file),
          message: 'does not match its manifest date, case number, or revision',
        });
      }
    } catch {
      // validateCaseForPublication below reports the schema problem without throwing.
    }
    issues.push(
      ...validateCaseForPublication(value).map((issue) => ({
        ...issue,
        path: `${relative(caseContentRoot, file)}:${issue.path}`,
      })),
    );
  }
  issues.push(...validateCollection(cases, publicationCeiling));
  for (const file of await artifactPaths()) {
    if (referenced.has(file)) continue;
    const date =
      relative(resolve(caseContentRoot, 'cases'), file).split('/')[0] || '';
    if (date <= publicationCeiling)
      issues.push({
        path: relative(caseContentRoot, file),
        message: 'is an unreferenced published case artifact',
      });
  }
  return issues;
}

async function main(): Promise<void> {
  const issues = await validateAll(
    process.env.PUBLICATION_CEILING || todayUtc(),
  );
  for (const issue of issues) console.error(`${issue.path}: ${issue.message}`);
  if (issues.length > 0) process.exitCode = 1;
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) void main();
