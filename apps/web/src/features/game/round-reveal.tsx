import type { DailyRound, Poi } from '@whereabouts/case-content';
import { getScoreBand } from '@whereabouts/game-engine';
import type { CSSProperties } from 'react';

type RoundRevealProps = {
  correctPoi: Poi;
  guessedPoi: Poi;
  points: number;
  round: DailyRound;
  roundNumber: number;
};

const dossierStyles = {
  correct: {
    card: 'border-emerald-300/50 bg-emerald-400/10',
    label: 'text-emerald-200',
  },
  guess: {
    card: 'border-brass/40 bg-brass/10',
    label: 'text-brass',
  },
} as const;

const confettiPieces = [
  { delay: 0, drift: '1rem', emoji: '🌍', id: 'globe-left', left: 7 },
  { delay: 70, drift: '-1.5rem', emoji: '✨', id: 'sparkle-left', left: 19 },
  { delay: 25, drift: '1rem', emoji: '📍', id: 'pin-left', left: 32 },
  { delay: 110, drift: '-1rem', emoji: '🧭', id: 'compass-left', left: 44 },
  { delay: 45, drift: '1rem', emoji: '✨', id: 'sparkle-right', left: 57 },
  { delay: 120, drift: '-1.25rem', emoji: '🌍', id: 'globe-right', left: 69 },
  { delay: 15, drift: '1rem', emoji: '🧭', id: 'compass-right', left: 82 },
  { delay: 85, drift: '-1rem', emoji: '📍', id: 'pin-right', left: 93 },
];

function CorrectConfetti() {
  return (
    <div
      aria-hidden="true"
      className="result-confetti pointer-events-none fixed inset-x-0 top-0 z-50 h-48 overflow-hidden motion-reduce:hidden"
      data-testid="correct-confetti"
    >
      {confettiPieces.map((piece) => {
        const style = {
          '--confetti-drift': piece.drift,
          animationDelay: `${piece.delay}ms`,
          left: `${piece.left}%`,
        } as CSSProperties;

        return (
          <span key={piece.id} style={style}>
            {piece.emoji}
          </span>
        );
      })}
    </div>
  );
}

function FullDossier({
  poi,
  label,
  showThemeConnection = false,
  variant,
  wide = false,
}: {
  poi: Poi;
  label: string;
  showThemeConnection?: boolean;
  variant: keyof typeof dossierStyles;
  wide?: boolean;
}) {
  const themeConnection =
    'themeConnection' in poi &&
    typeof poi.themeConnection === 'object' &&
    poi.themeConnection !== null &&
    'text' in poi.themeConnection &&
    typeof poi.themeConnection.text === 'string'
      ? (poi.themeConnection as { text: string })
      : undefined;
  const styles = dossierStyles[variant];

  return (
    <article
      aria-label={`${label}: ${poi.name}`}
      className={`overflow-hidden rounded-lg border ${styles.card} ${wide ? 'sm:grid sm:grid-cols-[minmax(14rem,2fr)_3fr]' : ''}`}
    >
      {poi.image ? (
        <figure className={wide ? 'sm:h-full' : undefined}>
          <img
            alt={poi.image.alt}
            className={`h-40 w-full object-cover ${wide ? 'sm:h-full sm:min-h-64' : ''}`}
            decoding="async"
            height={675}
            src={poi.image.url}
            width={1200}
          />
        </figure>
      ) : (
        <div
          aria-label={`Image unavailable for ${poi.name}`}
          className={`archival-image-fallback grid h-32 place-items-center text-xs tracking-wide text-paper/70 uppercase ${wide ? 'sm:h-full sm:min-h-64' : ''}`}
          role="img"
        >
          Archival image unavailable
        </div>
      )}
      <div className="space-y-2 p-4">
        <p
          className={`text-xs font-semibold tracking-[0.16em] uppercase ${styles.label}`}
        >
          {label}
        </p>
        <h3 className="text-xl font-semibold">{poi.name}</h3>
        <p className="text-sm text-muted-foreground">
          {poi.city}, {poi.country}
        </p>
        {poi.blurb ? (
          <p className="text-sm leading-relaxed">{poi.blurb}</p>
        ) : null}
        {showThemeConnection && themeConnection ? (
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
  const guessedCorrectly = guessedPoi.id === correctPoi.id;

  return (
    <section aria-label={`Round ${roundNumber} reveal`} className="space-y-5">
      {guessedCorrectly ? <CorrectConfetti /> : null}
      <header className="space-y-2 border-b border-rule pb-5 text-center">
        <p className="text-xs font-semibold tracking-[0.18em] text-cyan uppercase">
          Round {roundNumber} / 5
        </p>
        <h2
          className={`font-serif text-3xl ${guessedCorrectly ? 'text-emerald-200' : 'text-brass'}`}
        >
          {guessedCorrectly ? (
            <>
              <span aria-hidden="true">🎉 </span>
              Correct!
            </>
          ) : (
            'Not quite'
          )}
        </h2>
        <p className="text-sm text-paper">
          {guessedCorrectly
            ? `You found ${correctPoi.name}.`
            : `The correct location was ${correctPoi.name}.`}
        </p>
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
      <div className={`grid gap-4 ${guessedCorrectly ? '' : 'sm:grid-cols-2'}`}>
        <FullDossier
          label="Correct location"
          poi={correctPoi}
          showThemeConnection
          variant="correct"
          wide={guessedCorrectly}
        />
        {guessedCorrectly ? null : (
          <FullDossier label="Your location" poi={guessedPoi} variant="guess" />
        )}
      </div>
    </section>
  );
}
