import type { FiveRoundDailyCase } from '@whereabouts/case-content';
import type { FiveRoundProgress } from '@whereabouts/game-engine';
import { useState } from 'react';

import { ArchiveDrawer, type PublishedCase } from './archive-drawer';
import { BriefingUnavailable } from './briefing-unavailable';
import { FiveRoundGameScreen } from './five-round-game-screen';
import { buildShareText, type ShareResult, shareResult } from './share';

type ShareNavigator = Parameters<typeof shareResult>[1];
type ShareStatus = ShareResult | 'error' | undefined;

type ShareCurrentResultOptions = {
  caseData: FiveRoundDailyCase;
  date: string;
  navigatorValue: ShareNavigator;
  onStatus: (status: ShareResult) => void;
  origin: string;
  progress: FiveRoundProgress;
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
  caseData: FiveRoundDailyCase | null;
  date: string;
  publishedCases: PublishedCase[];
  today: string;
};

function shareStatusMessage(status: ShareStatus): string {
  switch (status) {
    case 'copied':
      return 'Result copied to clipboard.';
    case 'error':
      return 'Unable to copy the result.';
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

  const shareCase = async (
    activeCase: FiveRoundDailyCase,
    progress: FiveRoundProgress,
  ) => {
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
      throw new Error('Unable to copy the result.');
    }
  };

  return (
    <>
      {caseData ? (
        <FiveRoundGameScreen caseData={caseData} onShare={shareCase} />
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
