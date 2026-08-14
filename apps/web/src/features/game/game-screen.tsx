'use client';

import { loadProgress, saveProgress } from '@whereabouts/browser-state';
import type { DailyCase, Poi } from '@whereabouts/case-content';
import {
  applyGuess,
  createProgress,
  type GameProgress,
  getVisibleClues,
} from '@whereabouts/game-engine';
import { useEffect, useState } from 'react';

import { GlobePicker } from '../globe/globe-picker';
import { BriefingLayout } from './briefing-layout';
import { type AttemptDetail, FeedbackPanel } from './feedback-panel';
import { PoiPicker } from './poi-picker';
import { ResultPanel } from './result-panel';

type GameScreenProps = {
  caseData: DailyCase;
  storage?: Storage;
  onShare?: (
    caseData: DailyCase,
    progress: GameProgress,
  ) => void | Promise<void>;
  globeSupported?: boolean;
};

export function GameScreen({
  caseData,
  storage,
  onShare = () => undefined,
  globeSupported,
}: GameScreenProps) {
  const [progress, setProgress] = useState(() => createProgress(caseData));
  const [isReady, setIsReady] = useState(false);
  const [selectedAttemptIndex, setSelectedAttemptIndex] = useState<
    number | null
  >(null);

  useEffect(() => {
    const nextProgress = storage
      ? loadProgress(caseData, storage)
      : loadProgress(caseData, window.localStorage);
    setProgress(nextProgress);
    setSelectedAttemptIndex(null);
    setIsReady(true);
  }, [caseData, storage]);
  const visibleClues = getVisibleClues(caseData, progress);
  const guessedPoiIds = new Set(progress.guessedPoiIds);
  const isComplete = progress.outcome !== 'playing';
  const attempts = progress.guessedPoiIds.flatMap<AttemptDetail>((poiId) => {
    const poi = caseData.pois.find((candidate) => candidate.id === poiId);
    if (!poi) return [];
    if (poiId === caseData.target.poiId) {
      return [
        {
          poiName: poi.name,
          tier: 'solved',
          text: 'This is the location described by the case intelligence.',
        },
      ];
    }
    const response = caseData.contextualResponses.find(
      (candidate) => candidate.poiId === poiId,
    );
    return response
      ? [{ poiName: poi.name, tier: response.tier, text: response.text }]
      : [];
  });
  const selectedAttempt =
    selectedAttemptIndex === null
      ? null
      : (attempts[selectedAttemptIndex] ?? null);

  const confirmGuess = (poi: Poi) => {
    if (isComplete || guessedPoiIds.has(poi.id)) return;

    const nextProgress = applyGuess(caseData, progress, poi.id);
    setProgress(nextProgress);
    if (poi.id !== caseData.target.poiId) {
      setSelectedAttemptIndex(progress.guessedPoiIds.length);
    }
    if (storage) saveProgress(nextProgress, storage);
    else if (typeof window !== 'undefined')
      saveProgress(nextProgress, window.localStorage);
  };

  return (
    <BriefingLayout
      attempts={attempts}
      onSelectAttempt={setSelectedAttemptIndex}
      visibleClues={visibleClues}
    >
      <div className="space-y-5">
        <FeedbackPanel
          attempt={selectedAttempt}
          onOpenChange={(open) => {
            if (!open) setSelectedAttemptIndex(null);
          }}
        />
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
