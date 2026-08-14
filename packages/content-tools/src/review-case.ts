import { readFile } from 'node:fs/promises';
import { type DailyCase, dailyCaseSchema } from '@whereabouts/case-content';
import { casePath } from './paths.js';

export function reviewPacket(caseData: DailyCase): string {
  const target = caseData.pois.find((poi) => poi.id === caseData.target.poiId);
  const sources = new Map(
    caseData.sources.map((source) => [source.id, source]),
  );
  const linked = (ids: string[]) =>
    ids.map((id) => `[${id}](${sources.get(id)?.url ?? ''})`).join(', ');
  return `# Whereabouts review: ${caseData.publicationDate}\n\n## Spoiler\n\n**${target?.name ?? caseData.target.poiId}** — ${caseData.target.destinationName}\n\n## Clues\n\n${caseData.clues.map((clue, index) => `${index + 1}. ${clue.text} (${linked(clue.sourceIds)})`).join('\n')}\n\n## Contextual responses\n\n${caseData.contextualResponses.map((response) => `- **${response.tier} · ${response.poiId}**: ${response.text} (${linked(response.sourceIds)})`).join('\n')}\n\n## Reveal\n\n${caseData.reveal.title}\n\n${caseData.reveal.summary}\n\n${caseData.reveal.clueExplanation}\n\nSources: ${linked(caseData.reveal.sourceIds)}\n\n## Sources\n\n${caseData.sources.map((source) => `- [${source.id}: ${source.title}](${source.url}) — retrieved ${source.retrievedAt}`).join('\n')}\n`;
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
