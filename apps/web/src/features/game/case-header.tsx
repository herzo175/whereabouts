import { AttemptHistory, type AttemptSummary } from './attempt-history';

type CaseHeaderProps = {
  attempts: AttemptSummary[];
  onSelectAttempt: (index: number) => void;
};

export function CaseHeader({ attempts, onSelectAttempt }: CaseHeaderProps) {
  return (
    <header className="border-b border-rule pb-5">
      <h1 className="font-serif text-4xl leading-none tracking-[-0.035em] text-paper sm:text-5xl">
        Whereabouts
      </h1>
      <AttemptHistory attempts={attempts} onSelectAttempt={onSelectAttempt} />
    </header>
  );
}
