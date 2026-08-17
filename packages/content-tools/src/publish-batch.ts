import { mkdir, writeFile as nodeWriteFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import {
  type DailyCase,
  dailyCaseSchema,
  type ThemedDailyCase,
} from '@whereabouts/case-content';
import {
  type GenerationReview,
  generationReviewSchema,
  validateGenerationReview,
} from './generation-review.js';
import {
  caseContentRoot,
  casePath,
  generationReviewPath,
  reviewMarkdownPath,
} from './paths.js';
import {
  caseNumberForDate,
  isCanonicalDate,
  type ManifestEntry,
  pathExists,
} from './publication-buffer.js';
import {
  validateCaseForPublication,
  validateCollection,
} from './validate-case.js';

export type CaseManifest = {
  schemaVersion: 2;
  cases: Record<string, ManifestEntry>;
};

export type PreparedCase = {
  caseData: ThemedDailyCase;
  generationReview: GenerationReview;
  markdownReview: string;
};

type WriteFile = (path: string, data: string) => Promise<void>;

function positive(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
}

function parseManifest(value: CaseManifest): CaseManifest {
  if (
    !value ||
    value.schemaVersion !== 2 ||
    !value.cases ||
    typeof value.cases !== 'object'
  )
    throw new Error('manifest must be a schema version 2 object');
  const cases: Record<string, ManifestEntry> = {};
  for (const [date, entry] of Object.entries(value.cases)) {
    if (
      !isCanonicalDate(date) ||
      !entry ||
      !positive(entry.caseNumber) ||
      !positive(entry.revision) ||
      entry.caseNumber !== caseNumberForDate(date)
    )
      throw new Error(`manifest entry for ${date} is invalid`);
    const expected = `./cases/${date}/v${entry.revision}.json`;
    if (entry.file !== expected)
      throw new Error(`manifest file for ${date} is invalid`);
    cases[date] = { ...entry };
  }
  return { schemaVersion: 2, cases };
}

export async function publishBatch({
  prepared,
  manifest,
  existingCases = [],
  writeFile = async (path, data) => {
    await mkdir(dirname(path), { recursive: true });
    await nodeWriteFile(path, data, 'utf8');
  },
  exists = pathExists,
}: {
  prepared: readonly PreparedCase[];
  manifest: CaseManifest;
  existingCases?: readonly DailyCase[];
  writeFile?: WriteFile;
  exists?: (path: string) => Promise<boolean>;
}): Promise<CaseManifest> {
  const parsedManifest = parseManifest(manifest);
  const seenDates = new Set<string>();
  const parsed: Array<
    PreparedCase & {
      date: string;
      revision: number;
      casePath: string;
      reviewPath: string;
      markdownPath: string;
    }
  > = [];
  for (const item of prepared) {
    const caseData = dailyCaseSchema.parse(item.caseData) as ThemedDailyCase;
    const review = generationReviewSchema.parse(item.generationReview);
    const date = caseData.publicationDate;
    if (!isCanonicalDate(date))
      throw new Error('case publication date must be canonical');
    if (caseData.caseNumber !== caseNumberForDate(date))
      throw new Error(
        `case number does not match publication date for ${date}`,
      );
    if (seenDates.has(date))
      throw new Error(`duplicate publication date: ${date}`);
    seenDates.add(date);
    if (validateCaseForPublication(caseData).length)
      throw new Error(`publication validation failed for ${date}`);
    const reviewIssues = validateGenerationReview(caseData, review);
    if (reviewIssues.length)
      throw new Error(`generation review validation failed for ${date}`);
    if (
      typeof item.markdownReview !== 'string' ||
      item.markdownReview.length === 0
    )
      throw new Error(`review markdown is empty for ${date}`);
    const revision = caseData.revision;
    const paths = {
      casePath: casePath(date, revision),
      reviewPath: generationReviewPath(date, revision),
      markdownPath: reviewMarkdownPath(date, revision),
    };
    parsed.push({
      ...item,
      caseData,
      generationReview: review,
      date,
      revision,
      ...paths,
    });
  }
  if (parsed.length) {
    const cases = [...existingCases, ...parsed.map((item) => item.caseData)];
    const ceiling = cases
      .map((item) => item.publicationDate)
      .sort()
      .at(-1) as string;
    const collectionIssues = validateCollection(cases, ceiling);
    if (collectionIssues.length)
      throw new Error('publication collection validation failed');
  }
  const assembled: CaseManifest = {
    schemaVersion: 2,
    cases: { ...parsedManifest.cases },
  };
  for (const item of parsed) {
    const entry = {
      caseNumber: item.caseData.caseNumber,
      revision: item.revision,
      file: `./cases/${item.date}/v${item.revision}.json`,
    };
    const existing = assembled.cases[item.date];
    if (existing && existing.revision === entry.revision)
      throw new Error(`manifest already contains revision for ${item.date}`);
    assembled.cases[item.date] = entry;
  }
  parseManifest(assembled);
  for (const item of parsed) {
    for (const path of [item.casePath, item.reviewPath, item.markdownPath])
      if (await exists(path))
        throw new Error(`destination already exists: ${path}`);
  }
  for (const item of parsed) {
    await writeFile(
      item.casePath,
      `${JSON.stringify(item.caseData, null, 2)}\n`,
    );
    await writeFile(
      item.reviewPath,
      `${JSON.stringify(item.generationReview, null, 2)}\n`,
    );
    await writeFile(
      item.markdownPath,
      item.markdownReview.endsWith('\n')
        ? item.markdownReview
        : `${item.markdownReview}\n`,
    );
  }
  if (parsed.length) {
    const index = [
      '# Generated case review batch',
      '',
      'All semantic verdicts passed for every prepared case in this batch.',
      '',
      ...parsed.map(
        (item) =>
          `- [${item.date} revision ${item.revision}](./${item.date}/v${item.revision}.md)`,
      ),
      '',
    ].join('\n');
    await writeFile(resolve(caseContentRoot, 'reviews/index.md'), index);
  }
  await writeFile(
    resolve(caseContentRoot, 'manifest.json'),
    `${JSON.stringify(assembled, null, 2)}\n`,
  );
  return assembled;
}
