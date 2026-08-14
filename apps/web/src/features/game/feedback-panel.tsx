import type { DailyCase } from '@whereabouts/case-content';

type FeedbackPanelProps = {
  feedback: DailyCase['contextualResponses'][number] | null;
};

const tierStyles = {
  cold: {
    className: 'border-cyan/60 bg-cyan/10 text-cyan',
    label: 'Cold relationship',
  },
  warm: {
    className: 'border-brass/70 bg-brass/15 text-paper',
    label: 'Warm relationship',
  },
  hot: {
    className: 'border-orange-300/80 bg-orange-300/15 text-orange-100',
    label: 'Hot relationship',
  },
} as const;

export function FeedbackPanel({ feedback }: FeedbackPanelProps) {
  if (!feedback) return null;

  const tier = tierStyles[feedback.tier];

  return (
    <output
      aria-live="polite"
      className={`border p-4 ${tier.className}`}
      data-relationship={feedback.tier}
    >
      <p className="text-xs font-bold tracking-[0.16em] uppercase">
        {tier.label}
      </p>
      <p className="mt-2 text-sm leading-relaxed text-paper">{feedback.text}</p>
    </output>
  );
}
