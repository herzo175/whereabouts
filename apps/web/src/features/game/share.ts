import type { DailyCase } from '@whereabouts/case-content';
import { type GameProgress, getShareTokens } from '@whereabouts/game-engine';

const tokenEmoji = {
  cold: '🔵',
  warm: '🟡',
  hot: '🟠',
  solved: '🟢',
} as const;

type ShareNavigator = {
  share?: (data: { text: string }) => Promise<void>;
  clipboard?: { writeText: (text: string) => Promise<void> };
};

export type ShareResult = 'shared' | 'copied' | 'cancelled';

export function buildShareText(
  caseData: DailyCase,
  progress: GameProgress,
  origin: string,
): string {
  if (progress.outcome === 'playing') {
    throw new Error('Only completed cases can be shared');
  }

  const tokens = getShareTokens(caseData, progress);
  const score = progress.outcome === 'won' ? `${tokens.length}/6` : 'X/6';
  const normalizedOrigin = origin.replace(/\/+$/, '');

  return [
    `WHEREABOUTS ${String(caseData.caseNumber).padStart(3, '0')}  ${score}`,
    tokens.map((token) => tokenEmoji[token]).join(' '),
    `${normalizedOrigin}/${caseData.publicationDate}`,
  ].join('\n');
}

function isCancellation(error: unknown): boolean {
  return (
    (error instanceof DOMException
      ? error.name
      : typeof error === 'object' && error !== null && 'name' in error
        ? error.name
        : undefined) === 'AbortError'
  );
}

export async function shareResult(
  text: string,
  navigatorValue: ShareNavigator,
): Promise<ShareResult> {
  if (navigatorValue.share) {
    try {
      await navigatorValue.share({ text });
      return 'shared';
    } catch (error) {
      if (isCancellation(error)) return 'cancelled';
    }
  }

  if (navigatorValue.clipboard) {
    await navigatorValue.clipboard.writeText(text);
    return 'copied';
  }

  throw new Error('Unable to share or copy this result');
}
