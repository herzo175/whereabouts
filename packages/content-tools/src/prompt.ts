import type { Poi } from '@whereabouts/case-content';
import type { WikipediaExtract } from './wikipedia.js';

export const PROMPT_VERSION = 1;

export function buildCasePrompt(
  pois: Poi[],
  extracts: WikipediaExtract[],
): string {
  const sourceRows = pois.map((poi, index) => ({
    sourceId: `source-${String(index + 1).padStart(2, '0')}`,
    poi: { id: poi.id, name: poi.name, city: poi.city, country: poi.country },
    extract: extracts[index]?.extract ?? '',
  }));
  return `You write a Whereabouts geography case from the supplied catalog records and extracts only.\n\nReturn exactly six clues, ordered from coldest to most specific, exactly 24 contextual responses (one for every non-target POI), and a reveal. Cold means weak or distant thematic/geographic connection; warm means meaningful partial connection; hot means strongly related but not identifying. Use concise spy-briefing prose. Before the reveal, never state or spell the target POI name, destination, city, or country. Each sourceIds field may contain only the supplied source IDs. Do not invent facts.\n\nCATALOG AND SOURCES:\n${JSON.stringify(sourceRows)}\n\nThe target is the first catalog record. The draft must use its ID only where a target or POI ID is required.`;
}
