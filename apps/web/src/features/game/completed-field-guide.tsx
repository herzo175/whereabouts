import type { DailyRound, Poi } from '@whereabouts/case-content';
import { useState } from 'react';

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

function FieldGuideEntry({ poi, round }: { poi: Poi; round?: DailyRound }) {
  const wikipediaUrl = wikipediaArticleUrl(poi.wikipediaTitle);
  return (
    <li className="space-y-1 border-b border-foreground/10 py-3 last:border-b-0">
      <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="min-w-0 wrap-break-word font-serif text-lg text-paper">
          {poi.name}
        </span>
        <span className="text-sm text-paper/65">
          {poi.city}, {poi.country}
        </span>
        {wikipediaUrl ? (
          <a
            aria-label={`Wikipedia article for ${poi.name}`}
            className="min-h-11 py-2 text-sm text-cyan underline decoration-brass underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan"
            href={wikipediaUrl}
            rel="noreferrer"
            target="_blank"
          >
            Wikipedia
          </a>
        ) : null}
      </div>
      {round ? (
        <p className="text-xs leading-relaxed text-paper/65">
          {round.image.attribution}{' '}
          <a
            aria-label={`Photo license for ${poi.name}`}
            className="inline-flex min-h-11 items-center px-1 text-cyan underline decoration-brass underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan"
            href={round.image.licenseUrl}
            rel="noreferrer"
            target="_blank"
          >
            Photo license
          </a>
        </p>
      ) : null}
    </li>
  );
}

export function CompletedFieldGuide({
  candidates,
  answerIds,
  rounds,
}: CompletedFieldGuideProps) {
  const [isOpen, setIsOpen] = useState(false);
  const ordered = orderedCandidates(candidates, answerIds);
  const roundByPoiId = new Map(
    rounds.map((round) => [round.targetPoiId, round] as const),
  );

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
                poi={poi}
                round={roundByPoiId.get(poi.id)}
              />
            ))}
          </ul>
        ) : null}
      </details>
    </section>
  );
}
