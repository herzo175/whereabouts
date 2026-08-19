import { Compass } from 'lucide-react';

type BriefingUnavailableProps = {
  date: string;
};

export function BriefingUnavailable({ date }: BriefingUnavailableProps) {
  return (
    <main className="min-h-screen bg-background px-4 py-5 text-paper sm:px-6 sm:py-8">
      <section className="mx-auto max-w-2xl border border-rule bg-ink/45 p-6 shadow-[6px_6px_0_oklch(0.18_0.024_224_/_0.5)] sm:p-8">
        <p className="text-[0.68rem] font-bold tracking-[0.24em] text-brass uppercase">
          Field intelligence
        </p>
        <h1 className="mt-3 font-serif text-4xl leading-none tracking-[-0.035em] text-paper sm:text-5xl">
          Briefing unavailable
        </h1>
        <p className="mt-5 max-w-xl text-base leading-relaxed text-cyan">
          No published case is on file for <time dateTime={date}>{date}</time>.
        </p>
        <div className="mt-7 flex flex-wrap gap-3">
          <a
            className="inline-flex min-h-11 items-center gap-2 border border-brass bg-brass px-4 text-xs font-bold tracking-[0.12em] text-ink uppercase hover:bg-paper focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            href="/"
          >
            <Compass aria-hidden="true" className="size-4" />
            Today’s case
          </a>
        </div>
      </section>
    </main>
  );
}
