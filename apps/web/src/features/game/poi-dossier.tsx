import type { Poi } from '@whereabouts/case-content';
import { X } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';

type PoiDossierProps = {
  poi: Poi | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
};

export function PoiDossier({
  poi,
  open,
  onOpenChange,
  onConfirm,
}: PoiDossierProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    if (open) {
      previouslyFocusedRef.current =
        document.activeElement as HTMLElement | null;
      setIsSubmitting(false);
      confirmRef.current?.focus();
      return;
    }

    const previouslyFocused = previouslyFocusedRef.current;
    if (previouslyFocused?.isConnected) previouslyFocused.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onOpenChange(false);
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

  if (!open || !poi) return null;

  const submit = () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    onConfirm();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-foreground/45 p-0 sm:items-center sm:justify-center sm:p-6">
      <button
        aria-label="Close dossier"
        className="absolute inset-0 cursor-default"
        onClick={() => onOpenChange(false)}
        type="button"
      />
      <div
        aria-describedby={descriptionId}
        aria-labelledby={titleId}
        aria-modal="true"
        className="relative z-10 w-full max-w-lg overflow-hidden rounded-t-xl border border-foreground/15 bg-background shadow-2xl sm:rounded-xl"
        ref={dialogRef}
        role="dialog"
      >
        <div className="flex items-center justify-between border-b border-foreground/10 px-5 py-4">
          <p className="text-xs font-semibold tracking-[0.18em] text-muted-foreground uppercase">
            Location dossier
          </p>
          <button
            aria-label="Close dossier"
            className="grid size-11 place-items-center rounded-md text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/30"
            onClick={() => onOpenChange(false)}
            type="button"
          >
            <X aria-hidden="true" className="size-5" />
          </button>
        </div>

        {poi.image ? (
          <img
            alt={poi.image.alt}
            className="h-44 w-full object-cover"
            src={poi.image.url}
          />
        ) : (
          <div
            aria-label="Archival image unavailable"
            className="h-28 bg-[linear-gradient(135deg,rgba(29,78,70,0.95),rgba(13,25,36,1)_52%,rgba(135,104,44,0.72))]"
            role="img"
          />
        )}

        <div className="space-y-2 px-5 py-5">
          <h2 className="text-2xl font-semibold tracking-tight" id={titleId}>
            {poi.name}
          </h2>
          <p className="text-base text-muted-foreground" id={descriptionId}>
            {poi.city}, {poi.country}
          </p>
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-foreground/10 p-4 sm:flex-row sm:justify-end">
          <button
            className="min-h-12 rounded-md px-5 text-sm font-medium text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/30"
            onClick={() => onOpenChange(false)}
            type="button"
          >
            Cancel
          </button>
          <button
            className="min-h-12 rounded-md bg-foreground px-5 text-sm font-semibold text-background hover:bg-foreground/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isSubmitting}
            onClick={submit}
            ref={confirmRef}
            type="button"
          >
            Submit this lead
          </button>
        </div>
      </div>
    </div>
  );
}
