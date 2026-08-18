import type { DailyTheme } from '@whereabouts/case-content';

export function ThemeBriefing({ theme }: { theme: DailyTheme }) {
  return (
    <section
      aria-labelledby="daily-theme"
      className="space-y-2 border-b border-rule pb-5"
    >
      <p className="text-xs font-semibold tracking-[0.18em] text-cyan uppercase">
        Today's theme
      </p>
      <h2 id="daily-theme" className="font-serif text-3xl text-paper">
        {theme.title}
      </h2>
      <p className="leading-relaxed text-muted-foreground">
        {theme.introduction}
      </p>
    </section>
  );
}
