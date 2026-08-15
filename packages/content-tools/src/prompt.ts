import type { Poi } from '@whereabouts/case-content';
import type { WikipediaExtract } from './wikipedia.js';

export const PROMPT_VERSION = 4;

function compactExtract(extract: string, limit: number): string {
  if (extract.length <= limit) return extract;
  const headLength = Math.floor(limit * 0.75);
  const tailLength = limit - headLength;
  return `${extract.slice(0, headLength)}\n[…source excerpt compacted…]\n${extract.slice(-tailLength)}`;
}

export function buildCasePrompt(
  pois: Poi[],
  extracts: WikipediaExtract[],
): string {
  const sourceRows = pois.map((poi, index) => ({
    sourceId: `source-${String(index + 1).padStart(2, '0')}`,
    poi: { id: poi.id, name: poi.name, city: poi.city, country: poi.country },
    extract: compactExtract(
      extracts[index]?.extract ?? '',
      index === 0 ? 30_000 : 3_500,
    ),
  }));
  return `You are the case writer for Whereabouts, a difficult daily geography deduction game. The player sees all 25 candidate POIs before reading the first clue. Write only from the supplied catalog records and extracts.

Return exactly six clues, exactly 24 contextual responses (one for every non-target POI), and a reveal. Use concise intelligence-briefing prose. Every factual statement must be supported by its sourceIds, and each sourceIds field may contain only supplied source IDs. Do not invent facts.

DIFFICULTY CONTRACT
Before writing, silently compare the target with all 24 distractors. For each clue, estimate how many candidates a careful but non-expert player could still reasonably defend. Do not output that analysis or the candidate count.

- Clue 1: incredibly vague but not impossible. It must be true, useful in hindsight, and plausibly fit at least 8 of the 25 candidates. Use one broad theme about historical role, changing use, cultural exchange, engineering purpose, landscape, or public meaning. Do not use proper nouns, named people, named empires, exact century, year, dynasty, religion, language, demonym, continent, country, city, region, architectural style, signature architectural feature, superlative, or unique geographic configuration. Do not mention continents, borders, straits, rivers, seas, coastlines, or cardinal directions. Do not combine individually broad facts when their combination fingerprints the answer.
- Clue 2: 6–10 plausible candidates. Add one different broad dimension, but retain all Clue 1 restrictions on names, dates, signature features, and unique geography.
- Clue 3: 5–8 plausible candidates. Introduce a sourced historical relationship, broad era, or functional transition. One proper noun or broad geographic fact is allowed only if it does not identify the target by itself.
- Clue 4: 4–7 plausible candidates. Add a still non-unique historical or cultural connection. Do not use a named person, exact event, unique artifact, or the target's most famous identifying phrase or feature.
- Clue 5: 3–5 plausible candidates. Add a useful relationship or feature that narrows a shortlist without proving the answer. Avoid a famous individual, singular incident, quotation, or one-of-a-kind object.
- Clue 6: 2–4 plausible candidates. Offer a final confirmation context, never a single decisive fact. At least two candidates must remain reasonably defensible from the six clues alone; the player should need their earlier guess feedback to separate them. Still omit the target POI, destination, city, and country names.

Read the six clues together before returning them. Rewrite any early clue whose combination of geography, era, function, and architecture makes a famous answer obvious. Each clue must add new information rather than paraphrasing an earlier clue.

CONTEXTUAL RESPONSES
For every non-target POI, explain a factual relationship between the guessed POI and the target. Cold means weak or distant connection, warm means meaningful partial connection, and hot means strong shared history, function, culture, geography, or design. A response must teach the player why the relationship has that tier, not merely say that the guess is elsewhere or has a different identity. Cite sources for both sides whenever the comparison makes claims about both.

REVEAL
Write a concise factual summary of the answer. For clueExplanation, walk through all six clues in order and explain the specific fact each clue encoded and how that fact narrowed the candidate field. Name the decisive historical, geographic, functional, or architectural connection behind each clue. Do not use generic filler such as "each clue narrows the field," and do not discuss only the final clue.

SPOILER RULES
Before the reveal, never state or spell the target POI name, destination name, city, or country. Do not hide those names through initials, wordplay, translations, coordinates, or near-identical aliases. The reveal may name the answer. The target is the first catalog record; use its ID only where a target or POI ID is required.

CATALOG AND SOURCES:
${JSON.stringify(sourceRows)}`;
}
