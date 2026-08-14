'use client';

import { loadProgress, saveProgress } from '@whereabouts/browser-state';
import type { DailyCase, Poi } from '@whereabouts/case-content';
import {
  applyGuess,
  createProgress,
  type GameProgress,
  getAttemptsRemaining,
  getLatestFeedback,
  getVisibleClues,
} from '@whereabouts/game-engine';
import { useEffect, useState } from 'react';

import { GlobePicker } from '../globe/globe-picker';
import { BriefingLayout } from './briefing-layout';
import { FeedbackPanel } from './feedback-panel';
import { PoiPicker } from './poi-picker';
import { ResultPanel } from './result-panel';

type GameScreenProps = {
  caseData: DailyCase;
  storage?: Storage;
  onShare?: (
    caseData: DailyCase,
    progress: GameProgress,
  ) => void | Promise<void>;
  onOpenArchive?: () => void;
  globeSupported?: boolean;
};

export function GameScreen({
  caseData,
  storage,
  onShare = () => undefined,
  onOpenArchive = () => undefined,
  globeSupported,
}: GameScreenProps) {
  const [progress, setProgress] = useState(() => createProgress(caseData));
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const nextProgress = storage
      ? loadProgress(caseData, storage)
      : loadProgress(caseData, window.localStorage);
    setProgress(nextProgress);
    setIsReady(true);
  }, [caseData, storage]);
  const visibleClues = getVisibleClues(caseData, progress);
  const latestFeedback = getLatestFeedback(caseData, progress);
  const guessedPoiIds = new Set(progress.guessedPoiIds);
  const isComplete = progress.outcome !== 'playing';

  const confirmGuess = (poi: Poi) => {
    if (isComplete || guessedPoiIds.has(poi.id)) return;

    const nextProgress = applyGuess(caseData, progress, poi.id);
    setProgress(nextProgress);
    if (storage) saveProgress(nextProgress, storage);
    else if (typeof window !== 'undefined')
      saveProgress(nextProgress, window.localStorage);
  };

  return (
    <BriefingLayout
      attemptsRemaining={getAttemptsRemaining(progress)}
      caseNumber={caseData.caseNumber}
      onOpenArchive={onOpenArchive}
      visibleClues={visibleClues}
    >
      <div className="space-y-5">
        <FeedbackPanel feedback={latestFeedback} />
        {!isReady ? (
          <output aria-live="polite" className="text-sm text-cyan">
            Opening case file…
          </output>
        ) : isComplete ? (
          <ResultPanel
            caseData={caseData}
            onShare={onShare}
            progress={progress}
          />
        ) : (
          <PoiPicker
            globe={(selectPoi) => (
              <GlobePicker
                disabledPoiIds={guessedPoiIds}
                onSelect={selectPoi}
                pois={caseData.pois}
                supported={globeSupported}
              />
            )}
            guessedPoiIds={guessedPoiIds}
            onGuess={confirmGuess}
            pois={caseData.pois}
          />
        )}
      </div>
    </BriefingLayout>
  );
}
