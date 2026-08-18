'use client';

import { loadProgress, saveProgress } from '@whereabouts/browser-state';
import type { FiveRoundDailyCase, Poi } from '@whereabouts/case-content';
import {
  acknowledgeRoundReveal,
  createFiveRoundProgress,
  type FiveRoundProgress,
  getCurrentRound,
  submitRoundGuess,
} from '@whereabouts/game-engine';
import { useEffect, useState } from 'react';

import { GlobePicker } from '../globe/globe-picker';
import { DailyScorePanel } from './daily-score-panel';
import { PoiPicker } from './poi-picker';
import { RoundBriefing } from './round-briefing';
import { RoundReveal } from './round-reveal';
import { ThemeBriefing } from './theme-briefing';

type FiveRoundGameScreenProps = {
  caseData: FiveRoundDailyCase;
  globeSupported?: boolean;
  onShare?: (
    caseData: FiveRoundDailyCase,
    progress: FiveRoundProgress,
  ) => void | Promise<void>;
  storage?: Storage;
};

function getStorage(storage: Storage | undefined): Storage | undefined {
  if (storage) return storage;
  return typeof window === 'undefined' ? undefined : window.localStorage;
}

const tierDotStyles = {
  correct: 'border-emerald-200 bg-emerald-400',
  hot: 'border-orange-200 bg-orange-400',
  warm: 'border-yellow-100 bg-yellow-300',
  cold: 'border-sky-200 bg-sky-400',
} as const;

function FiveRoundHeader({ progress }: { progress: FiveRoundProgress }) {
  return (
    <header className="space-y-5 border-b border-rule pb-6">
      <h1 className="font-serif text-4xl tracking-tight text-paper sm:text-5xl">
        Whereabouts
      </h1>
      <ol className="flex gap-4" aria-label="Daily round progress">
        {Array.from({ length: 5 }, (_, index) => {
          const guess = progress.guesses[index];
          return (
            <li key={`round-${index + 1}`}>
              <span
                aria-label={
                  guess
                    ? `Round ${index + 1}: ${guess.tier}, ${guess.points} points`
                    : `Round ${index + 1}: not played`
                }
                className={`block size-8 rounded-full border-2 ${guess ? tierDotStyles[guess.tier] : 'border-rule bg-transparent'}`}
                role="img"
              />
            </li>
          );
        })}
      </ol>
    </header>
  );
}

export function FiveRoundGameScreen({
  caseData,
  globeSupported,
  onShare = () => undefined,
  storage,
}: FiveRoundGameScreenProps) {
  const [progress, setProgress] = useState<FiveRoundProgress>(() =>
    createFiveRoundProgress(caseData),
  );
  const [isReady, setIsReady] = useState(false);
  const [viewedRevealIndex, setViewedRevealIndex] = useState<number | null>(
    null,
  );

  useEffect(() => {
    const activeStorage = getStorage(storage);
    const nextProgress = activeStorage
      ? loadProgress(caseData, activeStorage)
      : createFiveRoundProgress(caseData);
    setProgress(nextProgress);
    setViewedRevealIndex(
      nextProgress.guesses.length > nextProgress.acknowledgedRoundCount
        ? nextProgress.guesses.length - 1
        : null,
    );
    setIsReady(true);
  }, [caseData, storage]);

  const currentRound = getCurrentRound(caseData, progress);
  const viewedGuess =
    viewedRevealIndex === null
      ? undefined
      : progress.guesses[viewedRevealIndex];
  const revealedRound = viewedGuess
    ? (caseData.rounds.find((round) => round.id === viewedGuess.roundId) ??
      null)
    : null;
  const revealedTargetIds = new Set(
    progress.guesses.flatMap((guess) => {
      const round = caseData.rounds.find(
        (candidate) => candidate.id === guess.roundId,
      );
      return round ? [round.targetPoiId] : [];
    }),
  );

  const submitGuess = (poi: Poi) => {
    if (!currentRound || viewedRevealIndex !== null) return;
    const nextProgress = submitRoundGuess(caseData, progress, poi.id);
    setProgress(nextProgress);
    const activeStorage = getStorage(storage);
    if (activeStorage) saveProgress(nextProgress, activeStorage);
    setViewedRevealIndex(nextProgress.guesses.length - 1);
  };

  const acknowledgeReveal = () => {
    const nextProgress = acknowledgeRoundReveal(progress);
    setProgress(nextProgress);
    const activeStorage = getStorage(storage);
    if (activeStorage) saveProgress(nextProgress, activeStorage);
    setViewedRevealIndex(null);
  };

  const openLatestReveal = () =>
    setViewedRevealIndex(progress.guesses.length - 1);

  if (!isReady) {
    return (
      <output aria-live="polite" className="text-sm text-cyan">
        Opening daily field file…
      </output>
    );
  }

  if (revealedRound && viewedGuess && viewedRevealIndex !== null) {
    const guessedPoi = caseData.pois.find(
      (poi) => poi.id === viewedGuess.poiId,
    );
    const correctPoi = caseData.pois.find(
      (poi) => poi.id === revealedRound.targetPoiId,
    );
    if (guessedPoi && correctPoi) {
      const isFinalRound = progress.guesses.length === caseData.rounds.length;
      const isLatestReveal = viewedRevealIndex === progress.guesses.length - 1;
      const latestRevealIsPending =
        progress.guesses.length > progress.acknowledgedRoundCount;
      return (
        <main className="min-h-screen bg-background px-4 py-5 text-paper sm:px-6 sm:py-8">
          <div className="mx-auto max-w-2xl space-y-6">
            <FiveRoundHeader progress={progress} />
            {caseData.schemaVersion === 3 ? (
              <ThemeBriefing theme={caseData.theme} />
            ) : null}
            <RoundReveal
              correctPoi={correctPoi}
              guessedPoi={guessedPoi}
              points={viewedGuess.points}
              round={revealedRound}
              roundNumber={viewedRevealIndex + 1}
              tier={viewedGuess.tier}
            />
            <nav aria-label="Result history" className="flex gap-3">
              {viewedRevealIndex > 0 ? (
                <button
                  aria-label={`Back to round ${viewedRevealIndex} result`}
                  className="min-h-12 rounded-md border border-rule px-5 text-sm font-semibold text-paper hover:border-paper/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan"
                  onClick={() =>
                    setViewedRevealIndex((index) =>
                      index === null ? null : index - 1,
                    )
                  }
                  type="button"
                >
                  Back
                </button>
              ) : null}
              {!isLatestReveal ? (
                <button
                  aria-label={`Forward to round ${viewedRevealIndex + 2} result`}
                  className="min-h-12 rounded-md bg-paper px-5 text-sm font-semibold text-ink hover:bg-paper/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan"
                  onClick={() =>
                    setViewedRevealIndex((index) =>
                      index === null ? null : index + 1,
                    )
                  }
                  type="button"
                >
                  Forward
                </button>
              ) : latestRevealIsPending ? (
                <button
                  className="min-h-12 rounded-md bg-paper px-5 text-sm font-semibold text-ink hover:bg-paper/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan"
                  onClick={acknowledgeReveal}
                  type="button"
                >
                  {isFinalRound ? 'View daily summary' : 'Next round'}
                </button>
              ) : (
                <button
                  aria-label={
                    currentRound
                      ? `Return to round ${progress.guesses.length + 1}`
                      : 'Return to daily summary'
                  }
                  className="min-h-12 rounded-md bg-paper px-5 text-sm font-semibold text-ink hover:bg-paper/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan"
                  onClick={() => setViewedRevealIndex(null)}
                  type="button"
                >
                  {currentRound
                    ? 'Return to current round'
                    : 'Return to summary'}
                </button>
              )}
            </nav>
          </div>
        </main>
      );
    }
  }

  if (!currentRound) {
    return (
      <main className="min-h-screen bg-background px-4 py-5 text-paper sm:px-6 sm:py-8">
        <div className="mx-auto max-w-2xl space-y-6">
          <FiveRoundHeader progress={progress} />
          {caseData.schemaVersion === 3 ? (
            <ThemeBriefing theme={caseData.theme} />
          ) : null}
          <DailyScorePanel
            caseData={caseData}
            onShare={onShare}
            progress={progress}
          />
          <button
            className="min-h-12 rounded-md border border-rule px-5 text-sm font-semibold text-paper hover:border-paper/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan"
            onClick={openLatestReveal}
            type="button"
          >
            Back to previous result
          </button>
          <section
            aria-labelledby="explore-case-locations"
            className="space-y-4 border-t border-rule pt-6"
          >
            <h2
              className="font-serif text-3xl text-paper"
              id="explore-case-locations"
            >
              Explore locations
            </h2>
            <PoiPicker
              globe={(selectPoi) => (
                <GlobePicker
                  disabledPoiIds={new Set<string>()}
                  onSelect={selectPoi}
                  pois={caseData.pois}
                  supported={globeSupported}
                />
              )}
              mode="browse"
              pois={caseData.pois}
            />
          </section>
        </div>
      </main>
    );
  }

  const roundNumber = progress.guesses.length + 1;
  return (
    <main className="min-h-screen bg-background px-4 py-5 text-paper sm:px-6 sm:py-8">
      <div className="mx-auto max-w-2xl space-y-6">
        <FiveRoundHeader progress={progress} />
        {caseData.schemaVersion === 3 ? (
          <ThemeBriefing theme={caseData.theme} />
        ) : null}
        <RoundBriefing round={currentRound} roundNumber={roundNumber} />
        {progress.guesses.length > 0 ? (
          <button
            className="min-h-12 rounded-md border border-rule px-5 text-sm font-semibold text-paper hover:border-paper/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan"
            onClick={openLatestReveal}
            type="button"
          >
            Back to previous result
          </button>
        ) : null}
        <section
          aria-label="Choose a location"
          className="border-t border-rule pt-6"
        >
          <PoiPicker
            disabledPoiIds={revealedTargetIds}
            dossierDetail="identity"
            globe={(selectPoi) => (
              <GlobePicker
                disabledPoiIds={revealedTargetIds}
                onSelect={selectPoi}
                pois={caseData.pois}
                supported={globeSupported}
              />
            )}
            onGuess={submitGuess}
            pois={caseData.pois}
          />
        </section>
      </div>
    </main>
  );
}
