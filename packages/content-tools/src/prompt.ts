import type { Poi } from '@whereabouts/case-content';
import type { WikipediaExtract } from './wikipedia.js';

export const PROMPT_VERSION = 8;

function compactExtract(extract: string, limit: number): string {
  if (extract.length <= limit) return extract;
  const headLength = Math.floor(limit * 0.75);
  const tailLength = limit - headLength;
  return `${extract.slice(0, headLength)}\n[…source excerpt compacted…]\n${extract.slice(-tailLength)}`;
}

function redactTargetMarkers(extract: string, poi: Poi): string {
  return [poi.name, poi.city, poi.country]
    .filter(Boolean)
    .reduce(
      (redacted, marker) => redacted.split(marker).join('[redacted]'),
      extract,
    );
}

export function buildCasePrompt(
  pois: Poi[],
  extracts: WikipediaExtract[],
): string {
  const sourceRows = pois.map((poi, index) => {
    const isTarget = index < 5;
    return {
      sourceId: `source-${String(index + 1).padStart(2, '0')}`,
      poi: isTarget
        ? { id: poi.id }
        : { id: poi.id, name: poi.name, city: poi.city, country: poi.country },
      extract: compactExtract(
        isTarget
          ? redactTargetMarkers(extracts[index]?.extract ?? '', poi)
          : (extracts[index]?.extract ?? ''),
        isTarget ? 12_000 : 3_500,
      ),
    };
  });
  return `You are the case writer for Whereabouts, a difficult daily geography deduction game. The player sees all 25 candidate POIs on a shared board. Write only from the supplied catalog records and extracts. Do not invent facts.

Return exactly five rounds as JSON. The first five catalog records are the five distinct targets, in order: record 1 is round 1's target through record 5 is round 5's target. For each round return only { clue: { text, sourceIds }, results: [{ poiId, similarityScore, text, sourceIds }] }. The system adds round IDs, target IDs, images, and final tiers; do not return them.

CLUES
Each round needs one concrete, useful clue: a specific sourced historical, cultural, functional, geographic, or architectural fact that gives a careful player a real reason to choose among the board. It must be independently useful in one shot, not a vague mood or a multi-step clue ladder. Do not name, spell, translate, initial, coordinate, or otherwise reveal that round's target POI name, city, or country. Geographic labels are answer markers: never state the target's country, city, state, province, region, island, or a demonym, even as incidental context such as "in [place]" or "[place]'s". Before returning, scan every clue against its target catalog record and rewrite any clue containing one of those labels. Avoid a fact so uniquely identifying that it trivially answers the round. Cite the target's source ID in each clue.

RESULTS
For every round return exactly 25 results, one for every board POI ID exactly once. Each result needs a numeric similarityScore from 0–100: 100 is most similar and 0 is least similar. Score the known round target 100. Every other result must explain a concrete factual relationship between the guessed POI and the round target; do not merely say they differ or are elsewhere. The system deterministically buckets the 24 non-target results by descending score into 4 hot, 8 warm, and 12 cold results; ties break by POI ID. Do not output a tier.

Use source IDs for both the guessed POI and the target in every non-correct result so the relationship is grounded on both sides. Use only supplied source IDs, and ensure every factual statement is supported by its sourceIds. Before returning, check each round has the target marked correct once, all 25 IDs exactly once, and no clue leaks its target POI name, city, or country.

CATALOG AND SOURCES:
${JSON.stringify(sourceRows)}`;
}
