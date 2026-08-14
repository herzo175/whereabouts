import type { DailyCase } from '@whereabouts/case-content';

type ClueCardProps = {
  clue: DailyCase['clues'][number];
  number: number;
};

export function ClueCard({ clue, number }: ClueCardProps) {
  return (
    <article className="border border-rule bg-paper px-5 py-6 text-ink shadow-[6px_6px_0_oklch(0.18_0.024_224_/_0.35)] sm:px-7">
      <p className="mb-5 flex items-center gap-3 text-[0.68rem] font-extrabold tracking-[0.21em] text-ink/65 uppercase before:h-px before:w-7 before:bg-brass before:content-['']">
        Clue {number}
      </p>
      <p className="font-serif text-xl leading-relaxed tracking-[-0.012em] sm:text-2xl">
        {clue.text}
      </p>
    </article>
  );
}
