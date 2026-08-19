import type { FiveRoundDailyCase } from '@whereabouts/case-content';
import {
  type FiveRoundProgress,
  getScoreBand,
  getTotalScore,
} from '@whereabouts/game-engine';

const tokenEmoji = {
  cold: '🔵',
  warm: '🟡',
  hot: '🟠',
  correct: '🟢',
} as const;

const shareDateFormatter = new Intl.DateTimeFormat('en-US', {
  day: 'numeric',
  month: 'long',
  timeZone: 'UTC',
  year: 'numeric',
});

type ShareNavigator = {
  /** Present on many browsers but intentionally unused: results are copied. */
  share?: (data: { text: string }) => Promise<void>;
  clipboard?: { writeText: (text: string) => Promise<void> };
};

export type ShareResult = 'copied';

export function buildShareText(
  caseData: FiveRoundDailyCase,
  progress: FiveRoundProgress,
  origin: string,
): string {
  if (
    progress.completedAt === undefined ||
    progress.guesses.length !== caseData.rounds.length ||
    progress.acknowledgedRoundCount !== caseData.rounds.length
  ) {
    throw new Error(
      'Only completed games with every round revealed and acknowledged can be shared',
    );
  }
  if (
    progress.caseDate !== caseData.publicationDate ||
    progress.caseRevision !== caseData.revision
  ) {
    throw new Error('Progress does not match this case revision');
  }
  if (
    progress.guesses.some(
      (guess, index) => caseData.rounds[index]?.id !== guess.roundId,
    )
  ) {
    throw new Error('Progress does not match the round order');
  }

  const normalizedOrigin = origin.replace(/\/+$/, '');
  return [
    'WHEREABOUTS',
    shareDateFormatter.format(
      new Date(`${caseData.publicationDate}T00:00:00Z`),
    ),
    progress.guesses
      .map((guess) => tokenEmoji[getScoreBand(guess.points)])
      .join(' '),
    `${getTotalScore(progress)} / 500`,
    normalizedOrigin,
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
