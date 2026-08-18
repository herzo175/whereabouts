import { readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  type DailyCase,
  dailyCaseSchema,
  type ThemedDailyCase,
} from '@whereabouts/case-content';

import { loadLocalEnvironment } from './environment.js';
import { caseContentRoot } from './paths.js';
import {
  bufferDates,
  caseNumberForDate,
  missingBufferDates,
  nextRevision,
} from './publication-buffer.js';
import {
  type CaseManifest,
  type PreparedCase,
  publishBatch,
} from './publish-batch.js';
import { curateBoard } from './themed-case/board-curator.js';
import {
  hydrateBoardTargets,
  researchCandidates,
} from './themed-case/candidate-researcher.js';
import { critiqueCase } from './themed-case/case-critic.js';
import { repairCaseDraft, writeCaseDraft } from './themed-case/case-writer.js';
import { createWikimediaResearch } from './themed-case/live-research.js';
import { createOpenRouterModel } from './themed-case/model.js';
import {
  type OrchestrateThemedCaseInput,
  type OrchestratorStages,
  orchestrateThemedCase,
} from './themed-case/orchestrator.js';
import { planTheme } from './themed-case/theme-planner.js';
import { requireProductionUserAgent } from './wikipedia.js';

export type RangeArguments = {
  from: string;
  days: number;
  revision: number | undefined;
  missingOnly: boolean;
};

export type RangeHistory = {
  manifest: CaseManifest;
  cases: readonly DailyCase[];
};

export type GenerateRangeDependencies = {
  history?: RangeHistory | (() => Promise<RangeHistory>);
  listExistingCasePaths?: (date: string) => Promise<readonly string[]>;
  orchestrate?: (input: OrchestrateThemedCaseInput) => Promise<PreparedCase>;
  publishBatch?: typeof publishBatch;
  stages?: OrchestratorStages;
  requireUserAgent?: () => string;
};

function usage(): never {
  throw new Error(
    'Usage: content:generate-range -- --from YYYY-MM-DD --days N [--revision N] [--missing-only]',
  );
}

function valueAfter(arguments_: string[], name: string): string | undefined {
  const index = arguments_.indexOf(name);
  if (index === -1) return undefined;
  const value = arguments_[index + 1];
  if (!value || value.startsWith('--')) usage();
  return value;
}

export function parseRangeArguments(arguments_: string[]): RangeArguments {
  const from = valueAfter(arguments_, '--from');
  const daysText = valueAfter(arguments_, '--days');
  const revisionText = valueAfter(arguments_, '--revision');
  const missingOnly = arguments_.includes('--missing-only');
  const known = new Set(['--from', '--days', '--revision', '--missing-only']);
  if (
    arguments_.some(
      (argument) => argument.startsWith('--') && !known.has(argument),
    )
  )
    usage();
  if (!from || !/^\d{4}-\d{2}-\d{2}$/.test(from))
    throw new Error('from must be a canonical ISO date');
  if (!daysText) throw new Error('days must be a positive integer');
  const days = Number(daysText);
  const revision =
    revisionText === undefined ? undefined : Number(revisionText);
  if (!/^\d+$/.test(daysText) || !Number.isInteger(days) || days < 1)
    throw new Error('days must be a positive integer');
  if (
    revisionText !== undefined &&
    (!/^\d+$/.test(revisionText) ||
      revision === undefined ||
      !Number.isInteger(revision) ||
      revision < 1)
  )
    throw new Error('revision must be a positive integer');
  // bufferDates performs the full calendar validity check for the start date.
  bufferDates(from, 1);
  return { from, days, revision, missingOnly };
}

async function loadPublishedHistory(): Promise<RangeHistory> {
  const manifest = JSON.parse(
    await readFile(resolve(caseContentRoot, 'manifest.json'), 'utf8'),
  ) as CaseManifest;
  const cases: DailyCase[] = [];
  for (const entry of Object.values(manifest.cases ?? {})) {
    if (!entry.file) throw new Error('manifest case has no file');
    cases.push(
      dailyCaseSchema.parse(
        JSON.parse(
          await readFile(resolve(caseContentRoot, entry.file), 'utf8'),
        ),
      ),
    );
  }
  return { manifest, cases };
}

async function defaultListExistingCasePaths(
  date: string,
): Promise<readonly string[]> {
  const directory = resolve(caseContentRoot, 'cases', date);
  try {
    const entries = await readdir(directory, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
      .map((entry) => resolve(directory, entry.name));
  } catch (error) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'ENOENT'
    )
      return [];
    throw error;
  }
}

export function createLiveOrchestratorStages(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): OrchestratorStages {
  const model = createOpenRouterModel(environment);
  const criticModel = createOpenRouterModel({
    ...environment,
    WHEREABOUTS_MODEL:
      environment.WHEREABOUTS_CRITIC_MODEL?.trim() ||
      environment.WHEREABOUTS_MODEL,
  });
  const research = createWikimediaResearch();
  return {
    planTheme: (input) => planTheme({ model, ...input }),
    researchCandidates: (input) => researchCandidates({ model, ...input }),
    curateBoard: (input) => curateBoard({ model, ...input }),
    hydrateBoardTargets: (input) =>
      hydrateBoardTargets({
        board: input.board,
        research,
        excludedTargetIds: input.excludedTargetIds,
      }),
    writeCaseDraft: (input) => writeCaseDraft({ model, ...input }),
    repairCaseDraft: (input) => repairCaseDraft({ model, ...input }),
    critiqueCase: (input) => critiqueCase({ criticModel, ...input }),
  };
}

function latestCasesByDate(
  cases: readonly DailyCase[],
): Map<string, DailyCase> {
  const latest = new Map<string, DailyCase>();
  for (const caseData of [...cases].sort(
    (left, right) =>
      left.publicationDate.localeCompare(right.publicationDate) ||
      left.revision - right.revision,
  ))
    latest.set(caseData.publicationDate, caseData);
  return latest;
}

function rollingThemes(
  casesByDate: ReadonlyMap<string, DailyCase>,
  date: string,
): Array<{ title: string; inclusionCriteria: string }> {
  return [...casesByDate.entries()]
    .filter(([candidate]) => candidate <= date)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([, caseData]) => caseData)
    .filter(
      (caseData): caseData is ThemedDailyCase =>
        caseData.schemaVersion === 3 && 'theme' in caseData,
    )
    .slice(-90)
    .map(({ theme }) => ({
      title: theme.title,
      inclusionCriteria: theme.inclusionCriteria,
    }));
}

function rollingTargets(
  casesByDate: ReadonlyMap<string, DailyCase>,
  date: string,
): Set<string> {
  return new Set(
    [...casesByDate.entries()]
      .filter(([candidate]) => candidate <= date)
      .sort(([left], [right]) => right.localeCompare(left))
      .slice(0, 30)
      .flatMap(([, caseData]) =>
        caseData.rounds.map((round) => round.targetPoiId),
      ),
  );
}

async function resolveHistory(
  dependency: GenerateRangeDependencies['history'],
): Promise<RangeHistory> {
  if (!dependency) return loadPublishedHistory();
  return typeof dependency === 'function' ? dependency() : dependency;
}

export async function generateRange(
  arguments_: string[],
  dependencies: GenerateRangeDependencies = {},
): Promise<void> {
  const options = parseRangeArguments(arguments_);
  if (dependencies.requireUserAgent) dependencies.requireUserAgent();
  else if (
    !dependencies.history &&
    !dependencies.orchestrate &&
    !dependencies.stages
  )
    requireProductionUserAgent();
  const history = await resolveHistory(dependencies.history);
  const dates = options.missingOnly
    ? missingBufferDates(
        bufferDates(options.from, options.days),
        history.manifest.cases,
      )
    : bufferDates(options.from, options.days);
  if (!dates.length) return;

  const listExistingCasePaths =
    dependencies.listExistingCasePaths ?? defaultListExistingCasePaths;
  const plans: Array<{ date: string; revision: number }> = [];
  for (const date of dates) {
    const manifestEntry = history.manifest.cases[date];
    const existingPaths = [
      ...(await listExistingCasePaths(date)),
      ...(manifestEntry?.file ? [manifestEntry.file] : []),
    ];
    const highestExistingRevision = Math.max(
      manifestEntry?.revision ?? 0,
      nextRevision(date, existingPaths) - 1,
    );
    if (
      options.revision !== undefined &&
      options.revision <= highestExistingRevision
    )
      throw new Error(
        `revision ${options.revision} for ${date} must be greater than existing revision ${highestExistingRevision}`,
      );
    plans.push({
      date,
      revision: options.revision ?? highestExistingRevision + 1,
    });
  }

  const casesByDate = latestCasesByDate(history.cases);
  const prepared: PreparedCase[] = [];
  const orchestrator = dependencies.orchestrate ?? orchestrateThemedCase;
  const stages =
    dependencies.stages ??
    (dependencies.orchestrate
      ? ({} as OrchestratorStages)
      : createLiveOrchestratorStages());
  for (const { date, revision } of plans) {
    const result = await orchestrator({
      date,
      revision,
      caseNumber: caseNumberForDate(date),
      recentThemes: rollingThemes(casesByDate, date),
      excludedTargetIds: rollingTargets(casesByDate, date),
      stages,
    });
    prepared.push(result);
    casesByDate.set(date, result.caseData);
    console.info(
      `Prepared themed case ${date} (${prepared.length}/${plans.length})`,
    );
  }

  const generatedDates = new Set(
    prepared.map((item) => item.caseData.publicationDate),
  );
  const existingCases = history.cases.filter(
    (caseData) => !generatedDates.has(caseData.publicationDate),
  );
  await (dependencies.publishBatch ?? publishBatch)({
    prepared,
    manifest: history.manifest,
    existingCases,
  });
}

if (
  process.argv[1] &&
  new URL(`file://${process.argv[1]}`).href === import.meta.url
) {
  loadLocalEnvironment();
  generateRange(process.argv.slice(2)).catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
