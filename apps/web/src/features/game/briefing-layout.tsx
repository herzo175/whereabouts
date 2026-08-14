import type { DailyCase } from '@whereabouts/case-content';
import type { ReactNode } from 'react';

import type { AttemptSummary } from './attempt-history';
import { CaseHeader } from './case-header';
import { ClueCard } from './clue-card';

type Clue = DailyCase['clues'][number];

type BriefingLayoutProps = {
  attempts: AttemptSummary[];
  children: ReactNode;
  onSelectAttempt: (index: number) => void;
  visibleClues: Clue[];
};

export function BriefingLayout(props: BriefingLayoutProps) {
  return (
    <main className="min-h-screen bg-background px-4 py-5 text-paper sm:px-6 sm:py-8">
      <div className="mx-auto max-w-2xl">
        <CaseHeader
          attempts={props.attempts}
          onSelectAttempt={props.onSelectAttempt}
        />
        <section className="space-y-4 py-6" aria-label="Case intelligence">
          {props.visibleClues.map((clue, index) => (
            <ClueCard clue={clue} key={clue.id} number={index + 1} />
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
