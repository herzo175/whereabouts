import { X } from 'lucide-react';
import { useEffect, useId, useRef } from 'react';

export type PublishedCase = {
  date: string;
  caseNumber: number;
};

type ArchiveDrawerProps = {
  publishedCases: PublishedCase[];
  today: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function ArchiveDrawer({
  publishedCases,
  today,
  open,
  onOpenChange,
}: ArchiveDrawerProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);
  const titleId = useId();

  useEffect(() => {
    if (open) {
      previouslyFocusedRef.current =
        document.activeElement as HTMLElement | null;
      closeButtonRef.current?.focus();
      return;
    }

    const previouslyFocused = previouslyFocusedRef.current;
    if (previouslyFocused?.isConnected) previouslyFocused.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onOpenChange(false);
        return;
      }
      if (event.key !== 'Tab') return;

      const focusableElements =
        dialogRef.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        );
      if (!focusableElements?.length) return;

      const first = focusableElements[0];
      const last = focusableElements[focusableElements.length - 1];
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
  }, [onOpenChange, open]);

  if (!open) return null;

  const cases = [...publishedCases].sort((a, b) =>
    b.date.localeCompare(a.date),
  );
  const close = () => {
    onOpenChange(false);
    previouslyFocusedRef.current?.focus();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-foreground/45 sm:items-center sm:justify-center sm:p-6">
      <div
        aria-hidden="true"
        className="absolute inset-0 cursor-default"
        onClick={close}
      />
      <div
        aria-labelledby={titleId}
        aria-modal="true"
        className="relative z-10 w-full max-w-lg rounded-t-xl border border-foreground/15 bg-background shadow-2xl sm:rounded-xl"
        ref={dialogRef}
        role="dialog"
      >
        <div className="flex items-center justify-between border-b border-foreground/10 px-5 py-4">
          <h2 className="text-lg font-semibold" id={titleId}>
            Case archive
          </h2>
          <button
            aria-label="Close archive"
            className="grid size-11 place-items-center rounded-md text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/30"
            onClick={close}
            ref={closeButtonRef}
            type="button"
          >
            <X aria-hidden="true" className="size-5" />
          </button>
        </div>
        <ul className="divide-y divide-foreground/10 px-5 py-2">
          {cases.map((publishedCase) => (
            <li key={publishedCase.date}>
              <a
                className="flex min-h-14 items-center justify-between gap-4 rounded-md px-2 py-3 font-medium hover:bg-foreground/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/30"
                href={`/${publishedCase.date}`}
              >
                <span>
                  Case {String(publishedCase.caseNumber).padStart(3, '0')}
                </span>
                {publishedCase.date === today ? (
                  <span className="text-sm text-muted-foreground">Today</span>
                ) : (
                  <time
                    className="text-sm text-muted-foreground"
                    dateTime={publishedCase.date}
                  >
                    {publishedCase.date}
                  </time>
                )}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
