import type { Poi } from '@whereabouts/case-content';

const COMPACTION_MARKER = '\n[…source excerpt compacted…]\n';

export function compactSourceExtract(extract: string, limit: number): string {
  if (limit < 1) throw new Error('extract limit must be positive');
  if (extract.length <= limit) return extract;
  if (limit <= COMPACTION_MARKER.length) return extract.slice(0, limit);
  const available = limit - COMPACTION_MARKER.length;
  const headLength = Math.ceil(available * 0.75);
  return `${extract.slice(0, headLength)}${COMPACTION_MARKER}${extract.slice(-available + headLength)}`;
}

export function redactTargetMarkers(
  extract: string,
  poi: Pick<Poi, 'name' | 'city' | 'country'>,
): string {
  return [poi.name, poi.city, poi.country]
    .filter(Boolean)
    .reduce(
      (redacted, marker) => redacted.split(marker).join('[redacted]'),
      extract,
    );
}

export function prohibitedAnswerMarkers(
  poi: Pick<Poi, 'name' | 'city' | 'country'>,
): string[] {
  return [poi.name, poi.city, poi.country]
    .filter(Boolean)
    .map((value) => value.toLocaleLowerCase().replace(/[^\p{L}\p{N}]/gu, ''));
}

// Kept as a small compatibility alias for stage prompt builders.
export const compactExtract = compactSourceExtract;
