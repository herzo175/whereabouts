'use client';

import { loadProgress, saveProgress } from '@whereabouts/browser-state';
import type { FiveRoundDailyCase, Poi } from '@whereabouts/case-content';
import {
  acknowledgeRoundReveal,
  createFiveRoundProgress,
  type FiveRoundProgress,
  getCurrentRound,
  getScoreBand,
  submitRoundGuess,
} from '@whereabouts/game-engine';
import { useEffect, useState } from 'react';

import { GlobePicker } from '../globe/globe-picker';
import { CompletedFieldGuide } from './completed-field-guide';
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

function FiveRoundHeader({
  activeRoundIndex,
  onSelectRound,
  progress,
}: {
  activeRoundIndex: number | null;
  onSelectRound: (index: number) => void;
  progress: FiveRoundProgress;
}) {
  return (
    <header className="space-y-3 border-b border-rule pb-3 text-center sm:space-y-5 sm:pb-6">
      <h1 className="font-serif text-3xl tracking-tight text-paper sm:text-5xl">
        Whereabouts
      </h1>
      <ol
        className="flex justify-center gap-3 sm:gap-4"
        aria-label="Daily round progress"
      >
        {Array.from({ length: 5 }, (_, index) => {
          const guess = progress.guesses[index];
          const tier = guess ? getScoreBand(guess.points) : undefined;
          return (
            <li key={`round-${index + 1}`}>
              {guess && tier ? (
                <button
                  aria-current={activeRoundIndex === index ? 'step' : undefined}
                  aria-label={`View round ${index + 1} result: ${tier}, ${guess.points} points`}
                  className={`grid size-11 place-items-center rounded-full hover:bg-paper/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan ${activeRoundIndex === index ? 'bg-paper/10 ring-2 ring-cyan' : ''}`}
                  onClick={() => onSelectRound(index)}
                  type="button"
                >
                  <span
                    aria-hidden="true"
                    className={`block size-6 rounded-full border-2 sm:size-8 ${tierDotStyles[tier]}`}
                  />
                </button>
              ) : (
                <span
                  aria-label={`Round ${index + 1}: not played`}
                  className="grid size-11 place-items-center"
                  role="img"
                >
                  <span
                    aria-hidden="true"
                    className="block size-6 rounded-full border-2 border-rule bg-transparent sm:size-8"
                  />
                </span>
              )}
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
      <main className="grid min-h-screen place-items-center bg-background px-6 text-paper">
        <output aria-live="polite" className="text-sm text-cyan">
          Opening daily field file…
        </output>
      </main>
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
        <main className="min-h-screen bg-background px-4 py-3 text-paper sm:px-6 sm:py-8">
          <div className="mx-auto max-w-2xl space-y-3 sm:space-y-6">
            <FiveRoundHeader
              activeRoundIndex={viewedRevealIndex}
              onSelectRound={setViewedRevealIndex}
              progress={progress}
            />
            {caseData.schemaVersion === 4 ? (
              <ThemeBriefing theme={caseData.theme} />
            ) : null}
            <RoundReveal
              correctPoi={correctPoi}
              guessedPoi={guessedPoi}
              points={viewedGuess.points}
              round={revealedRound}
              roundNumber={viewedRevealIndex + 1}
            />
            <nav aria-label="Result history" className="flex w-full gap-3">
              {viewedRevealIndex > 0 ? (
                <button
                  aria-label={`Back to round ${viewedRevealIndex} result`}
                  className="min-h-12 flex-1 rounded-md border border-rule px-5 text-sm font-semibold text-paper hover:border-paper/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan"
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
                  className="min-h-12 flex-1 rounded-md border border-rule px-5 text-sm font-semibold text-paper hover:border-paper/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan"
                  onClick={() =>
                    setViewedRevealIndex((index) =>
                      index === null ? null : index + 1,
                    )
                  }
                  type="button"
                >
                  Forward
                </button>
              ) : null}
              {isLatestReveal && latestRevealIsPending ? (
                <button
                  className="min-h-12 flex-1 rounded-md bg-paper px-5 text-sm font-semibold text-ink hover:bg-paper/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan"
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
                  className="min-h-12 flex-1 rounded-md bg-paper px-5 text-sm font-semibold text-ink hover:bg-paper/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan"
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
      <main className="min-h-screen bg-background px-4 py-3 text-paper sm:px-6 sm:py-8">
        <div className="mx-auto max-w-2xl space-y-3 sm:space-y-6">
          <FiveRoundHeader
            activeRoundIndex={null}
            onSelectRound={setViewedRevealIndex}
            progress={progress}
          />
          {caseData.schemaVersion === 4 ? (
            <ThemeBriefing theme={caseData.theme} />
          ) : null}
          <DailyScorePanel
            caseData={caseData}
            onShare={onShare}
            progress={progress}
          />
          <button
            className="min-h-12 w-full rounded-md border border-rule px-5 text-sm font-semibold text-paper hover:border-paper/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan"
            onClick={openLatestReveal}
            type="button"
          >
            Back to previous result
          </button>
          <CompletedFieldGuide
            answerIds={caseData.rounds.map((round) => round.targetPoiId)}
            candidates={caseData.pois}
            rounds={caseData.rounds}
          />
        </div>
      </main>
    );
  }

  const roundNumber = progress.guesses.length + 1;
  return (
    <main className="min-h-screen bg-background px-4 py-3 text-paper sm:px-6 sm:py-8">
      <div className="mx-auto max-w-2xl space-y-3 sm:space-y-6">
        <FiveRoundHeader
          activeRoundIndex={null}
          onSelectRound={setViewedRevealIndex}
          progress={progress}
        />
        {caseData.schemaVersion === 4 ? (
          <ThemeBriefing theme={caseData.theme} />
        ) : null}
        <RoundBriefing round={currentRound} roundNumber={roundNumber} />
        <section
          aria-label="Choose a location"
          className="border-t border-rule pt-3 sm:pt-6"
        >
          <PoiPicker
            disabledPoiIds={revealedTargetIds}
            dossierDetail="identity"
            globe={(selectPoi, fallback) => (
              <GlobePicker
                disabledPoiIds={revealedTargetIds}
                fallback={fallback}
                onSelect={selectPoi}
                pois={caseData.pois}
                supported={globeSupported}
              />
            )}
            onGuess={submitGuess}
            pois={caseData.pois}
          />
          {progress.guesses.length > 0 ? (
            <nav aria-label="Round history" className="mt-4">
              <button
                className="min-h-12 w-full rounded-md border border-rule px-5 text-sm font-semibold text-paper hover:border-paper/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan"
                onClick={openLatestReveal}
                type="button"
              >
                Back to previous result
              </button>
            </nav>
          ) : null}
        </section>
      </div>
    </main>
  );
}
