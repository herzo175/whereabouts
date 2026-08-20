import { createFileRoute } from '@tanstack/react-router';
import { formatLocalDate } from '@whereabouts/browser-state';
import type { FiveRoundDailyCase } from '@whereabouts/case-content';
import { useEffect, useState } from 'react';

import { getPublishedCase } from '../features/cases/case-functions';
import { AppShell } from '../features/game/app-shell';

export const Route = createFileRoute('/')({
  component: Home,
});

export function resolveToday(now: Date): string {
  return formatLocalDate(now);
}

export async function loadTodayCase<T>(
  now: Date,
  loadCase: (date: string) => Promise<T>,
): Promise<{ caseData: T; date: string }> {
  const date = resolveToday(now);
  return { caseData: await loadCase(date), date };
}

function Home() {
  const [today, setToday] = useState<{
    caseData: FiveRoundDailyCase | null;
    date: string;
  } | null>(null);

  useEffect(() => {
    const now = new Date();
    let cancelled = false;

    void loadTodayCase(now, (date) => getPublishedCase({ data: { date } }))
      .then((result) => {
        if (!cancelled) setToday(result);
      })
      .catch(() => {
        if (!cancelled) {
          setToday({ caseData: null, date: resolveToday(now) });
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (today) return <AppShell caseData={today.caseData} date={today.date} />;

  return (
    <main
      aria-busy="true"
      className="grid min-h-screen place-items-center bg-background px-6 text-paper"
    >
      <output aria-live="polite">Opening today’s briefing…</output>
    </main>
  );
}
