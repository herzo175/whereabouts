export type AttemptTier = 'cold' | 'warm' | 'hot' | 'solved';

export type AttemptSummary = {
  poiName: string;
  tier: AttemptTier;
};

type AttemptHistoryProps = {
  attempts: AttemptSummary[];
  onSelectAttempt: (index: number) => void;
};

const tierLabels: Record<AttemptTier, string> = {
  cold: 'cold',
  warm: 'warm',
  hot: 'hot',
  solved: 'case solved',
};

const tierStyles: Record<AttemptTier, string> = {
  cold: 'border-cyan/70 bg-cyan shadow-[0_0_12px_oklch(0.72_0.045_218_/_0.25)]',
  warm: 'border-yellow-200/80 bg-brass shadow-[0_0_12px_oklch(0.75_0.12_79_/_0.25)]',
  hot: 'border-orange-200/80 bg-orange-400 shadow-[0_0_12px_oklch(0.72_0.16_45_/_0.28)]',
  solved:
    'border-emerald-200/80 bg-emerald-400 shadow-[0_0_12px_oklch(0.75_0.15_155_/_0.28)]',
};

const attemptSlots = [
  'attempt-1',
  'attempt-2',
  'attempt-3',
  'attempt-4',
  'attempt-5',
  'attempt-6',
] as const;

export function AttemptHistory({
  attempts,
  onSelectAttempt,
}: AttemptHistoryProps) {
  return (
    <fieldset className="mt-4 flex min-w-0 gap-1 border-0 p-0">
      <legend className="sr-only">Attempt history</legend>
      {attemptSlots.map((slotId, index) => {
        const attempt = attempts[index];
        if (!attempt) {
          return (
            <span
              aria-hidden="true"
              className="grid size-11 shrink-0 place-items-center"
              data-testid="empty-attempt"
              key={slotId}
            >
              <span className="size-3.5 rounded-full border border-rule bg-ink/60" />
            </span>
          );
        }

        return (
          <button
            aria-label={`Attempt ${index + 1}, ${tierLabels[attempt.tier]}, ${attempt.poiName}`}
            className="group grid size-11 shrink-0 place-items-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-paper focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            key={slotId}
            onClick={() => onSelectAttempt(index)}
            type="button"
          >
            <span
              aria-hidden="true"
              className={`size-5 rounded-full border-2 transition-transform group-hover:scale-110 ${tierStyles[attempt.tier]}`}
            />
          </button>
        );
      })}
    </fieldset>
  );
}
