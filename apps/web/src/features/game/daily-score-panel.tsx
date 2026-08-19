import type { FiveRoundDailyCase } from '@whereabouts/case-content';
import {
  type FiveRoundProgress,
  getScoreBand,
  getTotalScore,
} from '@whereabouts/game-engine';
import { useState } from 'react';
import { wikipediaArticleUrl } from './completed-field-guide';
import { PoiDossier } from './poi-dossier';
import { buildShareText } from './share';

type DailyScorePanelProps = {
  caseData: FiveRoundDailyCase;
  onShare: (
    caseData: FiveRoundDailyCase,
    progress: FiveRoundProgress,
  ) => void | Promise<void>;
  progress: FiveRoundProgress;
};

const tierStyles = {
  correct: 'border-emerald-300 bg-emerald-400/20 text-emerald-200',
  hot: 'border-orange-300 bg-orange-400/20 text-orange-200',
  warm: 'border-yellow-300 bg-yellow-400/20 text-yellow-100',
  cold: 'border-sky-300 bg-sky-400/20 text-sky-200',
} as const;

export function DailyScorePanel({
  caseData,
  onShare,
  progress,
}: DailyScorePanelProps) {
  const [copyState, setCopyState] = useState<
    'idle' | 'copying' | 'copied' | 'error'
  >('idle');
  const [selectedGuessIndex, setSelectedGuessIndex] = useState<number | null>(
    null,
  );
  const selectedGuess =
    selectedGuessIndex === null
      ? undefined
      : progress.guesses[selectedGuessIndex];
  const selectedPoi = selectedGuess
    ? caseData.pois.find((poi) => poi.id === selectedGuess.poiId)
    : undefined;
  const selectedRound = selectedGuess
    ? caseData.rounds.find((round) => round.id === selectedGuess.roundId)
    : undefined;

  const copyResult = async () => {
    setCopyState('copying');
    try {
      await onShare(caseData, progress);
      setCopyState('copied');
    } catch {
      setCopyState('error');
    }
  };

  return (
    <section aria-labelledby="daily-score-title" className="space-y-6">
      <header className="space-y-2 border-b border-rule pb-5 text-center">
        <p className="text-xs font-semibold tracking-[0.18em] text-cyan uppercase">
          All five rounds complete
        </p>
        <h2 className="font-serif text-4xl" id="daily-score-title">
          Daily score
        </h2>
        <p className="text-2xl font-semibold text-brass">
          {getTotalScore(progress)} / 500
        </p>
      </header>

      <ol
        className="grid grid-cols-2 gap-x-3 gap-y-4 sm:grid-cols-5 sm:gap-2"
        aria-label="Round results"
      >
        {progress.guesses.map((guess, index) => {
          const place = caseData.pois.find((poi) => poi.id === guess.poiId);
          const tier = getScoreBand(guess.points);
          return (
            <li key={guess.roundId}>
              <button
                aria-label={`Open round ${index + 1} location dossier: ${place?.name ?? 'Unknown place'}`}
                className="group grid h-full w-full grid-rows-[auto_auto_1fr_auto] gap-2 rounded-md py-1 text-center hover:bg-paper/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan disabled:cursor-not-allowed"
                disabled={!place}
                onClick={() => setSelectedGuessIndex(index)}
                type="button"
              >
                <span
                  aria-hidden="true"
                  className={`mx-auto grid size-11 place-items-center rounded-full border transition-transform group-hover:scale-105 ${tierStyles[tier]}`}
                >
                  {guess.points}
                </span>
                <span className="block text-xs text-muted-foreground">
                  Round {index + 1}
                </span>
                <span className="block text-xs leading-tight font-semibold text-paper">
                  {place?.name ?? 'Unknown place'}
                </span>
                <span className="block text-xs font-semibold capitalize">
                  {tier}
                </span>
              </button>
            </li>
          );
        })}
      </ol>

      <PoiDossier
        imageOverride={
          selectedPoi &&
          selectedRound &&
          selectedPoi.id === selectedRound.targetPoiId
            ? selectedRound.image
            : undefined
        }
        onOpenChange={(open) => {
          if (!open) setSelectedGuessIndex(null);
        }}
        open={selectedPoi !== undefined}
        poi={selectedPoi ?? null}
        wikipediaUrl={wikipediaArticleUrl(selectedPoi?.wikipediaTitle)}
      />

      <button
        className="min-h-12 w-full rounded-md border border-brass bg-brass px-5 text-sm font-bold tracking-[0.12em] text-ink uppercase hover:bg-paper focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass"
        disabled={copyState === 'copying'}
        onClick={() => void copyResult()}
        type="button"
      >
        {copyState === 'copied'
          ? 'Copied'
          : copyState === 'error'
            ? 'Copy failed'
            : copyState === 'copying'
              ? 'Copying…'
              : 'Copy result'}
      </button>
      {copyState === 'error' ? (
        <label className="block space-y-2 text-sm text-muted-foreground">
          Copy this result manually
          <textarea
            className="min-h-32 w-full resize-y rounded-md border border-rule bg-ink p-3 font-mono text-sm text-paper"
            onFocus={(event) => event.currentTarget.select()}
            readOnly
            value={buildShareText(
              caseData,
              progress,
              typeof window === 'undefined' ? '' : window.location.origin,
            )}
          />
        </label>
      ) : null}
    </section>
  );
}
