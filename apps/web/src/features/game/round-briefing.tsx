import type { DailyRound } from '@whereabouts/case-content';

type RoundBriefingProps = {
  round: DailyRound;
  roundNumber: number;
};

export function RoundBriefing({ round, roundNumber }: RoundBriefingProps) {
  return (
    <section
      aria-label={`Round ${roundNumber} briefing`}
      className="space-y-2 sm:space-y-4"
    >
      <p className="text-center text-xs font-semibold tracking-[0.18em] text-cyan uppercase">
        Round {roundNumber} / 5
      </p>
      <figure className="overflow-hidden rounded-lg border border-rule">
        <img
          alt={`Round ${roundNumber} target photograph`}
          className="h-36 w-full object-cover sm:h-64"
          fetchPriority="high"
          height={675}
          src={round.image.url}
          width={1200}
        />
      </figure>
      <article className="rounded-lg border border-rule bg-paper p-3 text-ink shadow-[4px_4px_0_oklch(0.18_0.024_224_/_0.35)] sm:px-7 sm:py-6 sm:shadow-[6px_6px_0_oklch(0.18_0.024_224_/_0.35)]">
        <p className="mb-2 text-xs font-extrabold tracking-[0.18em] text-ink uppercase sm:mb-5">
          Field clue
        </p>
        <p className="font-serif text-base leading-[1.4] tracking-[-0.012em] sm:text-2xl sm:leading-relaxed">
          {round.clue.text}
        </p>
      </article>
    </section>
  );
}
