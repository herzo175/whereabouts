import { readFile } from 'node:fs/promises';
import {
  type DailyCase,
  dailyCaseSchema,
  type FiveRoundDailyCase,
} from '@whereabouts/case-content';
import { casePath } from './paths.js';

export function reviewPacket(caseData: DailyCase): string {
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

export async function readCaseForReview(
  date: string,
  revision = 1,
): Promise<DailyCase> {
  return dailyCaseSchema.parse(
    JSON.parse(await readFile(casePath(date, revision), 'utf8')),
  );
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
      .then((value) => process.stdout.write(reviewPacket(value)))
      .catch((error: unknown) => {
        console.error(error instanceof Error ? error.message : error);
        process.exitCode = 1;
      });
}
