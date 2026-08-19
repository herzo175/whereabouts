import type { DailyRound, Poi } from '@whereabouts/case-content';
import { useState } from 'react';

import { PoiDossier } from './poi-dossier';

type CompletedFieldGuideProps = {
  candidates: Poi[];
  answerIds: string[];
  rounds: DailyRound[];
};

export function wikipediaArticleUrl(title?: string): string | undefined {
  const trimmedTitle = title?.trim();
  if (!trimmedTitle) return undefined;
  return `https://en.wikipedia.org/wiki/${encodeURIComponent(trimmedTitle.replace(/ /g, '_'))}`;
}

function orderedCandidates(candidates: Poi[], answerIds: string[]): Poi[] {
  const byId = new Map(
    candidates.map((candidate) => [candidate.id, candidate]),
  );
  const answers: Poi[] = [];
  const answerIdSet = new Set<string>();
  for (const id of answerIds) {
    const candidate = byId.get(id);
    if (candidate && !answerIdSet.has(id)) {
      answers.push(candidate);
      answerIdSet.add(id);
    }
  }
  const remainder = [...byId.values()]
    .filter((candidate) => !answerIdSet.has(candidate.id))
    .sort((a, b) => a.name.localeCompare(b.name));
  return [...answers, ...remainder];
}

function FieldGuideEntry({
  poi,
  onSelect,
}: {
  poi: Poi;
  onSelect: () => void;
}) {
  return (
    <li className="border-b border-foreground/10 last:border-b-0">
      <button
        aria-label={`Open ${poi.name} dossier`}
        className="flex min-h-11 w-full items-center justify-between gap-3 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan"
        onClick={onSelect}
        type="button"
      >
        <span className="min-w-0">
          <span className="block min-w-0 wrap-break-word font-serif text-lg text-paper">
            {poi.name}
          </span>
          <span className="block text-sm text-paper/65">
            {poi.city}, {poi.country}
          </span>
        </span>
        <span aria-hidden="true" className="shrink-0 text-sm text-cyan">
          View
        </span>
      </button>
    </li>
  );
}

export function CompletedFieldGuide({
  candidates,
  answerIds,
  rounds,
}: CompletedFieldGuideProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedPoi, setSelectedPoi] = useState<Poi | null>(null);
  const ordered = orderedCandidates(candidates, answerIds);
  const roundByPoiId = new Map(
    rounds.map((round) => [round.targetPoiId, round] as const),
  );
  const selectedRound = selectedPoi
    ? roundByPoiId.get(selectedPoi.id)
    : undefined;

  return (
    <section
      aria-labelledby="completed-field-guide-heading"
      className="border-t border-rule pt-4"
    >
      <details
        className="group"
        onToggle={(event) => setIsOpen(event.currentTarget.open)}
      >
        <summary
          className="cursor-pointer list-none rounded-sm py-3 pr-2 text-sm font-semibold tracking-[0.14em] text-brass uppercase marker:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan"
          id="completed-field-guide-heading"
        >
          Field guide ({ordered.length} candidate locations)
        </summary>
        {isOpen ? (
          <ul className="mt-2 divide-y-0" aria-label="Candidate locations">
            {ordered.map((poi) => (
              <FieldGuideEntry
                key={poi.id}
                onSelect={() => setSelectedPoi(poi)}
                poi={poi}
              />
            ))}
          </ul>
        ) : null}
      </details>
      <PoiDossier
        detail="full"
        imageOverride={selectedRound?.image}
        onOpenChange={(open) => {
          if (!open) setSelectedPoi(null);
        }}
        open={selectedPoi !== null}
        poi={selectedPoi}
        wikipediaUrl={wikipediaArticleUrl(selectedPoi?.wikipediaTitle)}
      />
    </section>
  );
}
