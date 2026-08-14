import type { DailyCase } from '@whereabouts/case-content';
import type { GameProgress } from '@whereabouts/game-engine';
import { useState } from 'react';

import { ArchiveDrawer, type PublishedCase } from './archive-drawer';
import { BriefingUnavailable } from './briefing-unavailable';
import { GameScreen } from './game-screen';
import { buildShareText, type ShareResult, shareResult } from './share';

type ShareNavigator = Parameters<typeof shareResult>[1];
type ShareStatus = ShareResult | 'error' | undefined;

type ShareCurrentResultOptions = {
  caseData: DailyCase;
  date: string;
  navigatorValue: ShareNavigator;
  onStatus: (status: ShareResult) => void;
  origin: string;
  progress: GameProgress;
};

export async function shareCurrentResult({
  caseData,
  date,
  navigatorValue,
  onStatus,
  origin,
  progress,
}: ShareCurrentResultOptions): Promise<void> {
  if (caseData.publicationDate !== date) {
    throw new Error('The case does not match the current route.');
  }

  const result = await shareResult(
    buildShareText(caseData, progress, origin),
    navigatorValue,
  );
  onStatus(result);
}

type AppShellProps = {
  caseData: DailyCase | null;
  date: string;
  publishedCases: PublishedCase[];
  today: string;
};

function shareStatusMessage(status: ShareStatus): string {
  switch (status) {
    case 'shared':
      return 'Result shared.';
    case 'copied':
      return 'Result copied to clipboard.';
    case 'cancelled':
      return 'Sharing cancelled.';
    case 'error':
      return 'Unable to share the result.';
    default:
      return '';
  }
}

export function AppShell({
  caseData,
  date,
  publishedCases,
  today,
}: AppShellProps) {
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [shareStatus, setShareStatus] = useState<ShareStatus>();

  const shareCase = async (activeCase: DailyCase, progress: GameProgress) => {
    try {
      await shareCurrentResult({
        caseData: activeCase,
        date,
        navigatorValue: navigator,
        onStatus: setShareStatus,
        origin: window.location.origin,
        progress,
      });
    } catch {
      setShareStatus('error');
    }
  };

  return (
    <>
      {caseData ? (
        <GameScreen
          caseData={caseData}
          onOpenArchive={() => setArchiveOpen(true)}
          onShare={shareCase}
        />
      ) : (
        <BriefingUnavailable
          date={date}
          onOpenArchive={() => setArchiveOpen(true)}
        />
      )}
      <ArchiveDrawer
        onOpenChange={setArchiveOpen}
        open={archiveOpen}
        publishedCases={publishedCases}
        today={today}
      />
      <p aria-live="polite" className="sr-only">
        {shareStatusMessage(shareStatus)}
      </p>
    </>
  );
}
