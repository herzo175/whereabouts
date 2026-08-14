import type { DailyCase } from '@whereabouts/case-content';
import type { GameProgress } from '@whereabouts/game-engine';

type ResultPanelProps = {
  caseData: DailyCase;
  progress: GameProgress;
  onShare: (
    caseData: DailyCase,
    progress: GameProgress,
  ) => void | Promise<void>;
};

export function ResultPanel({ caseData, progress, onShare }: ResultPanelProps) {
  if (progress.outcome === 'playing') return null;

  const target = caseData.pois.find((poi) => poi.id === caseData.target.poiId);
  const sources = caseData.reveal.sourceIds.flatMap((sourceId) => {
    const source = caseData.sources.find(
      (candidate) => candidate.id === sourceId,
    );
    return source ? [source] : [];
  });

  return (
    <section
      aria-labelledby="case-result-title"
      className="space-y-5 border border-brass/60 bg-ink/70 p-5 shadow-[6px_6px_0_oklch(0.18_0.024_224_/_0.5)] sm:p-7"
    >
      <div className="space-y-2">
        <h2
          className="font-serif text-3xl leading-tight text-paper"
          id="case-result-title"
        >
          {progress.outcome === 'won' ? 'Case closed' : 'Trail lost'}
        </h2>
        <h3 className="text-xs font-bold tracking-[0.18em] text-brass uppercase">
          {caseData.target.destinationName}
        </h3>
      </div>

      {target?.image ? (
        <figure className="overflow-hidden border border-rule">
          <img
            alt={target.image.alt}
            className="h-52 w-full object-cover"
            src={target.image.url}
          />
          <figcaption className="bg-background px-3 py-2 text-xs text-muted-foreground">
            {target.image.attribution}{' '}
            <a
              className="underline decoration-brass underline-offset-2 hover:text-paper focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass"
              href={target.image.licenseUrl}
              rel="noreferrer"
              target="_blank"
            >
              License
            </a>
          </figcaption>
        </figure>
      ) : null}

      <p className="text-base leading-relaxed text-paper">
        {caseData.reveal.summary}
      </p>

      <div className="space-y-3 border-t border-rule pt-4">
        <h3 className="text-xs font-bold tracking-[0.16em] text-cyan uppercase">
          Sources
        </h3>
        <ul className="space-y-2 text-sm">
          {sources.map((source) => (
            <li key={source.id}>
              <a
                className="text-cyan underline decoration-brass underline-offset-2 hover:text-paper focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass"
                href={source.url}
                rel="noreferrer"
                target="_blank"
              >
                {source.title}
              </a>
            </li>
          ))}
        </ul>
      </div>

      <button
        className="min-h-12 w-full border border-brass bg-brass px-5 text-sm font-bold tracking-[0.12em] text-ink uppercase hover:bg-paper focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:w-auto"
        onClick={() => void onShare(caseData, progress)}
        type="button"
      >
        Share result
      </button>
    </section>
  );
}
