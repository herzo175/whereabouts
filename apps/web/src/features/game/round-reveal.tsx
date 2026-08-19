import type { DailyRound, Poi } from '@whereabouts/case-content';
import { getScoreBand } from '@whereabouts/game-engine';

type RoundRevealProps = {
  correctPoi: Poi;
  guessedPoi: Poi;
  points: number;
  round: DailyRound;
  roundNumber: number;
};

function FullDossier({ poi, label }: { poi: Poi; label: string }) {
  const themeConnection =
    'themeConnection' in poi &&
    typeof poi.themeConnection === 'object' &&
    poi.themeConnection !== null &&
    'text' in poi.themeConnection &&
    typeof poi.themeConnection.text === 'string'
      ? (poi.themeConnection as { text: string })
      : undefined;
  return (
    <article className="overflow-hidden rounded-lg border border-foreground/15 bg-background">
      {poi.image ? (
        <figure>
          <img
            alt={poi.image.alt}
            className="h-40 w-full object-cover"
            src={poi.image.url}
          />
        </figure>
      ) : (
        <div
          aria-label={`Image unavailable for ${poi.name}`}
          className="grid h-32 place-items-center bg-[linear-gradient(135deg,rgba(29,78,70,0.95),rgba(13,25,36,1)_52%,rgba(135,104,44,0.72))] text-xs tracking-wide text-paper/70 uppercase"
          role="img"
        >
          Archival image unavailable
        </div>
      )}
      <div className="space-y-2 p-4">
        <p className="text-xs font-semibold tracking-[0.16em] text-muted-foreground uppercase">
          {label}
        </p>
        <h3 className="text-xl font-semibold">{poi.name}</h3>
        <p className="text-sm text-muted-foreground">
          {poi.city}, {poi.country}
        </p>
        {poi.blurb ? (
          <p className="text-sm leading-relaxed">{poi.blurb}</p>
        ) : null}
        {themeConnection ? (
          <section
            aria-label="Why it fits today's theme"
            className="space-y-1 border-t border-foreground/10 pt-3"
          >
            <h4 className="text-xs font-semibold tracking-[0.16em] text-cyan uppercase">
              Why it fits today's theme
            </h4>
            <p className="text-sm leading-relaxed">{themeConnection.text}</p>
          </section>
        ) : null}
      </div>
    </article>
  );
}

export function RoundReveal({
  correctPoi,
  guessedPoi,
  points,
  round,
  roundNumber,
}: RoundRevealProps) {
  const result = round.results.find(
    (candidate) => candidate.poiId === guessedPoi.id,
  );
  const tier = getScoreBand(points);
  const formattedTier = tier[0].toUpperCase() + tier.slice(1);

  return (
    <section aria-label={`Round ${roundNumber} reveal`} className="space-y-5">
      <header className="space-y-2 border-b border-rule pb-5 text-center sm:text-left">
        <p className="text-xs font-semibold tracking-[0.18em] text-cyan uppercase">
          Round {roundNumber} / 5
        </p>
        <h2 className="font-serif text-3xl text-paper">
          Round {roundNumber} revealed
        </h2>
        <p className="text-sm font-semibold tracking-wide text-brass uppercase">
          {formattedTier} · {points} points
        </p>
      </header>
      {result ? (
        <article className="rounded-lg border border-brass/40 bg-brass/10 p-4">
          <p className="text-xs font-semibold tracking-[0.16em] text-brass uppercase">
            Authored relationship
          </p>
          <p className="mt-2 leading-relaxed text-paper">{result.text}</p>
        </article>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <FullDossier label="Your location" poi={guessedPoi} />
        <FullDossier label="Correct location" poi={correctPoi} />
      </div>
    </section>
  );
}
