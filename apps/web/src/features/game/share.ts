import type { DailyCase } from '@whereabouts/case-content';
import { type GameProgress, getShareTokens } from '@whereabouts/game-engine';

const tokenEmoji = {
  cold: '🔵',
  warm: '🟡',
  hot: '🟠',
  solved: '🟢',
} as const;

type ShareNavigator = {
  /** Present on many browsers but intentionally unused: results are copied. */
  share?: (data: { text: string }) => Promise<void>;
  clipboard?: { writeText: (text: string) => Promise<void> };
};

export type ShareResult = 'copied';

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
    `WHEREABOUTS ${score}`,
    tokens.map((token) => tokenEmoji[token]).join(' '),
    `${normalizedOrigin}/${caseData.publicationDate}`,
  ].join('\n');
}

export async function shareResult(
  text: string,
  navigatorValue: ShareNavigator,
): Promise<ShareResult> {
  if (navigatorValue.clipboard) {
    await navigatorValue.clipboard.writeText(text);
    return 'copied';
  }

  throw new Error('Unable to copy this result');
}
