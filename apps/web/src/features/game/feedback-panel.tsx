import { X } from 'lucide-react';
import { useEffect, useId, useRef } from 'react';

import type { AttemptTier } from './attempt-history';

export type AttemptDetail = {
  poiName: string;
  text: string;
  tier: AttemptTier;
};

type FeedbackPanelProps = {
  attempt: AttemptDetail | null;
  onOpenChange: (open: boolean) => void;
};

const tierStyles: Record<AttemptTier, { className: string; label: string }> = {
  cold: {
    className: 'border-cyan/60 bg-cyan/10 text-cyan',
    label: 'Cold',
  },
  warm: {
    className: 'border-brass/70 bg-brass/15 text-brass',
    label: 'Warm',
  },
  hot: {
    className: 'border-orange-300/80 bg-orange-300/15 text-orange-200',
    label: 'Hot',
  },
  solved: {
    className: 'border-emerald-300/70 bg-emerald-300/15 text-emerald-200',
    label: 'Case solved',
  },
};

export function FeedbackPanel({ attempt, onOpenChange }: FeedbackPanelProps) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    if (!attempt) {
      const previouslyFocused = previouslyFocusedRef.current;
      if (previouslyFocused?.isConnected) previouslyFocused.focus();
      return;
    }
    previouslyFocusedRef.current = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onOpenChange(false);
      if (event.key !== 'Tab') return;
      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [attempt, onOpenChange]);

  if (!attempt) return null;
  const tier = tierStyles[attempt.tier];

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-foreground/45 sm:items-center sm:justify-center sm:p-6">
      <button
        aria-hidden="true"
        className="absolute inset-0 cursor-default"
        onClick={() => onOpenChange(false)}
        tabIndex={-1}
        type="button"
      />
      <div
        aria-describedby={descriptionId}
        aria-labelledby={titleId}
        aria-modal="true"
        className="relative z-10 w-full max-w-lg overflow-hidden rounded-t-xl border border-rule bg-background shadow-2xl sm:rounded-xl"
        ref={dialogRef}
        role="dialog"
      >
        <div className="flex items-center justify-between border-b border-rule px-5 py-4">
          <p className="text-xs font-bold tracking-[0.16em] text-cyan uppercase">
            Attempt report
          </p>
          <button
            aria-label="Close report"
            className="grid size-11 place-items-center rounded-full text-cyan hover:bg-paper/10 hover:text-paper focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-paper"
            onClick={() => onOpenChange(false)}
            ref={closeRef}
            type="button"
          >
            <X aria-hidden="true" className="size-5" />
          </button>
        </div>
        <div className="space-y-5 px-5 py-6 sm:px-6">
          <div>
            <p
              className={`inline-flex border px-3 py-1 text-xs font-bold tracking-[0.14em] uppercase ${tier.className}`}
            >
              {tier.label}
            </p>
            <h2 className="mt-4 font-serif text-3xl text-paper" id={titleId}>
              {attempt.poiName}
            </h2>
          </div>
          <p
            className="text-base leading-relaxed text-paper"
            id={descriptionId}
          >
            {attempt.text}
          </p>
        </div>
      </div>
    </div>
  );
}
