import { Archive } from 'lucide-react';

type CaseHeaderProps = {
  caseNumber: number;
  attemptsRemaining: number;
  onOpenArchive: () => void;
};

export function CaseHeader({
  caseNumber,
  attemptsRemaining,
  onOpenArchive,
}: CaseHeaderProps) {
  return (
    <header className="border-b border-rule pb-5">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <p className="text-[0.68rem] font-bold tracking-[0.24em] text-brass uppercase">
            Field intelligence / active case
          </p>
          <h1 className="font-serif text-4xl leading-none tracking-[-0.035em] text-paper sm:text-5xl">
            Whereabouts
          </h1>
        </div>
        <button
          aria-label="Open case archive"
          className="inline-flex min-h-11 shrink-0 items-center gap-2 border border-rule bg-ink/40 px-3 text-xs font-bold tracking-[0.12em] text-cyan uppercase transition-colors hover:border-brass hover:text-paper focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          onClick={onOpenArchive}
          type="button"
        >
          <Archive aria-hidden="true" className="size-4" />
          Archive
        </button>
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs font-bold tracking-[0.16em] text-cyan uppercase">
        <p>Case {caseNumber}</p>
        <p className="border-l border-rule pl-5 normal-case tracking-normal">
          {attemptsRemaining} attempts remaining
        </p>
      </div>
    </header>
  );
}
