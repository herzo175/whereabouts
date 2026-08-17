import { readFile } from 'node:fs/promises';
import {
  type DailyCase,
  dailyCaseSchema,
  type FiveRoundDailyCase,
} from '@whereabouts/case-content';
import { casePath, generationReviewPath } from './paths.js';
import { generationReviewSchema, type GenerationReview } from './generation-review.js';

export function reviewPacket(caseData: DailyCase, review?: GenerationReview): string {
  if (caseData.schemaVersion === 3) return themedReviewPacket(caseData, review);
  return fiveRoundReviewPacket(caseData);
}

function sourceLinker(caseData: DailyCase): (ids: string[]) => string {
  const sources = new Map(
    caseData.sources.map((source) => [source.id, source]),
  );
  return (ids) =>
    ids.map((id) => `[${id}](${sources.get(id)?.url ?? ''})`).join(', ');
}

function sourceList(caseData: DailyCase): string {
  return caseData.sources
    .map(
      (source) =>
        `- [${source.id}: ${source.title}](${source.url}) — retrieved ${source.retrievedAt}`,
    )
    .join('\n');
}

function fiveRoundReviewPacket(caseData: FiveRoundDailyCase): string {
  const pois = new Map(caseData.pois.map((poi) => [poi.id, poi]));
  const linked = sourceLinker(caseData);
  const rounds = caseData.rounds
    .map((round, index) => {
      const target = pois.get(round.targetPoiId);
      const results = round.results
        .map((result) => {
          const poi = pois.get(result.poiId);
          return `- **${result.tier} · ${poi?.name ?? result.poiId}**: ${result.text} (${linked(result.sourceIds)})`;
        })
        .join('\n');
      return `## Round ${index + 1}: ${target?.name ?? round.targetPoiId}\n\n${round.clue.text} (${linked(round.clue.sourceIds)})\n\nImage: [${round.image.attribution}](${round.image.url})\n\n${results}`;
    })
    .join('\n\n');
  return `# Whereabouts review: ${caseData.publicationDate}\n\n${rounds}\n\n## Sources\n\n${sourceList(caseData)}\n`;
}

function themedReviewPacket(caseData: Extract<DailyCase, { schemaVersion: 3 }>, review?: GenerationReview): string {
  const pois = new Map(caseData.pois.map((poi) => [poi.id, poi]));
  const linked = sourceLinker(caseData);
  const candidates = caseData.pois.map((poi) => `- **${poi.name}** (${poi.city}, ${poi.country}): ${poi.themeConnection.text} (${linked(poi.themeConnection.sourceIds)})`).join('\n');
  const rounds = caseData.rounds.map((round, index) => {
    const target = pois.get(round.targetPoiId);
    const results = round.results.map((result) => `- **${result.tier} · ${pois.get(result.poiId)?.name ?? result.poiId}**: ${result.text} (${linked(result.sourceIds)})`).join('\n');
    const verdict = review?.clueVerdicts.find((item) => item.roundId === round.id);
    return `## Round ${index + 1}: ${target?.name ?? round.targetPoiId}\n\n${round.clue.text} (${linked(round.clue.sourceIds)})\n\nClue verdict: ${verdict ? `${verdict.status} — ${verdict.explanation}` : 'not supplied'}\n\nImage: [${round.image.attribution}](${round.image.url}) — [license](${round.image.licenseUrl})\n\n${results}`;
  }).join('\n\n');
  const repairs = review?.repairs.map((repair) => `- **${repair.stage}**: ${repair.summary}`).join('\n') || '- None recorded';
  const finalPass = review && validateReviewForPacket(caseData, review) ? 'PASS' : 'PENDING / FAIL';
  return `# Whereabouts themed review: ${caseData.publicationDate}\n\n## Theme: ${caseData.theme.title}\n\n${caseData.theme.introduction}\n\n### Inclusion criteria\n\n${caseData.theme.inclusionCriteria}\n\n## Candidates\n\n${candidates}\n\n## Targets\n\n${caseData.rounds.map((round) => `- ${round.id}: ${round.targetPoiId}`).join('\n')}\n\n${rounds}\n\n## Repairs\n\n${repairs}\n\n## Final disposition\n\n${finalPass}\n\n## Sources\n\n${sourceList(caseData)}\n`;
}

function validateReviewForPacket(caseData: DailyCase, review: GenerationReview): boolean {
  return generationReviewSchema.safeParse(review).success && review.publicationDate === caseData.publicationDate && review.revision === caseData.revision && review.themeVerdicts.every((item) => item.status === 'pass') && review.clueVerdicts.every((item) => item.status === 'pass');
}

export async function readCaseForReview(
  date: string,
  revision = 1,
): Promise<DailyCase> {
  return dailyCaseSchema.parse(
    JSON.parse(await readFile(casePath(date, revision), 'utf8')),
  );
}

export async function readGenerationReviewForReview(date: string, revision = 1): Promise<GenerationReview | undefined> {
  try {
    return generationReviewSchema.parse(JSON.parse(await readFile(generationReviewPath(date, revision), 'utf8')));
  } catch { return undefined; }
}

if (
  process.argv[1] &&
  new URL(`file://${process.argv[1]}`).href === import.meta.url
) {
  const date = process.argv[process.argv.indexOf('--date') + 1];
  if (!date) {
    console.error('Usage: content:review -- --date YYYY-MM-DD [--revision N]');
    process.exitCode = 1;
  } else
    readCaseForReview(
      date,
      Number(process.argv[process.argv.indexOf('--revision') + 1] ?? 1),
    )
    .then(async (value) => process.stdout.write(reviewPacket(value, value.schemaVersion === 3 ? await readGenerationReviewForReview(date, Number(process.argv[process.argv.indexOf('--revision') + 1] ?? 1)) : undefined)))
      .catch((error: unknown) => {
        console.error(error instanceof Error ? error.message : error);
        process.exitCode = 1;
      });
}
