import type { DailyTheme } from '@whereabouts/case-content';

export function ThemeBriefing({ theme }: { theme: DailyTheme }) {
  return (
    <section
      aria-labelledby="daily-theme"
      className="space-y-1 border-b border-rule pb-3 sm:space-y-2 sm:pb-5"
    >
      <p className="text-center text-[0.65rem] font-semibold tracking-[0.18em] text-cyan uppercase sm:text-left sm:text-xs">
        Today's theme
      </p>
      <h2
        id="daily-theme"
        className="text-center font-serif text-2xl leading-tight text-paper sm:text-left sm:text-3xl"
      >
        {theme.title}
      </h2>
      <p className="text-left text-sm leading-snug text-muted-foreground sm:text-base sm:leading-relaxed">
        {theme.introduction}
      </p>
    </section>
  );
}
