import type { DailyCase } from '@whereabouts/case-content';
import {
  type GameProgress,
  getAttemptsRemaining,
  getVisibleClues,
} from '@whereabouts/game-engine';
import type { ReactNode } from 'react';

import { CaseHeader } from './case-header';
import { ClueCard } from './clue-card';

type Clue = DailyCase['clues'][number];

type BriefingLayoutProps = {
  children: ReactNode;
  onOpenArchive: () => void;
} & (
  | {
      caseData: DailyCase;
      progress: GameProgress;
    }
  | {
      caseNumber: number;
      visibleClues: Clue[];
      attemptsRemaining: number;
    }
);

export function BriefingLayout(props: BriefingLayoutProps) {
  const briefing =
    'caseData' in props
      ? {
          attemptsRemaining: getAttemptsRemaining(props.progress),
          caseNumber: props.caseData.caseNumber,
          visibleClues: getVisibleClues(props.caseData, props.progress),
        }
      : props;

  return (
    <main className="min-h-screen bg-background px-4 py-5 text-paper sm:px-6 sm:py-8">
      <div className="mx-auto max-w-2xl">
        <CaseHeader
          attemptsRemaining={briefing.attemptsRemaining}
          caseNumber={briefing.caseNumber}
          onOpenArchive={props.onOpenArchive}
        />
        <section className="space-y-4 py-6" aria-label="Case intelligence">
          {briefing.visibleClues.map((clue) => (
            <ClueCard clue={clue} key={clue.id} />
          ))}
        </section>
        <section
          aria-label="Choose a location"
          className="border-t border-rule pt-6"
        >
          {props.children}
        </section>
      </div>
    </main>
  );
}
