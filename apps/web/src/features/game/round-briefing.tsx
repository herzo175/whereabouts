import type { DailyRound } from '@whereabouts/case-content';

type RoundBriefingProps = {
  round: DailyRound;
  roundNumber: number;
};

export function RoundBriefing({ round, roundNumber }: RoundBriefingProps) {
  return (
    <section aria-label={`Round ${roundNumber} briefing`} className="space-y-4">
      <p className="text-xs font-semibold tracking-[0.18em] text-cyan uppercase">
        Round {roundNumber} / 5
      </p>
      <figure className="overflow-hidden rounded-lg border border-rule">
        <img
          alt={`Round ${roundNumber} target photograph`}
          className="h-64 w-full object-cover"
          src={round.image.url}
        />
        <figcaption className="bg-ink px-3 py-2 text-xs text-muted-foreground">
          {round.image.attribution}{' '}
          <a
            className="text-cyan underline decoration-brass underline-offset-2"
            href={round.image.licenseUrl}
            rel="noreferrer"
            target="_blank"
          >
            License
          </a>
        </figcaption>
      </figure>
      <article className="border border-rule bg-paper px-5 py-6 text-ink shadow-[6px_6px_0_oklch(0.18_0.024_224_/_0.35)] sm:px-7">
        <p className="mb-5 text-[0.68rem] font-extrabold tracking-[0.21em] text-ink/65 uppercase">
          Field clue
        </p>
        <p className="font-serif text-xl leading-relaxed tracking-[-0.012em] sm:text-2xl">
          {round.clue.text}
        </p>
      </article>
    </section>
  );
}
