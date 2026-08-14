import { createFileRoute, notFound } from '@tanstack/react-router';
import { formatLocalDate, parseCaseDate } from '@whereabouts/browser-state';
import { useEffect, useState } from 'react';

import {
  getPublishedCase,
  getPublishedCaseIndex,
} from '../features/cases/case-functions';
import { AppShell } from '../features/game/app-shell';

function parseCanonicalDate(value: string): string {
  const date = parseCaseDate(value);
  if (date === null) throw notFound();
  return date;
}

export const Route = createFileRoute('/$date')({
  params: {
    parse: (params) => ({ date: parseCanonicalDate(params.date) }),
  },
  loader: async ({ params }) => {
    const [caseData, publishedCases] = await Promise.all([
      getPublishedCase({ data: { date: params.date } }),
      getPublishedCaseIndex(),
    ]);

    return { caseData, publishedCases };
  },
  notFoundComponent: InvalidDate,
  component: CaseRoute,
});

function InvalidDate() {
  return (
    <main className="grid min-h-screen place-items-center bg-background px-6 text-paper">
      <section className="max-w-md space-y-3 border border-rule bg-ink/70 p-6">
        <p className="text-xs font-bold tracking-[0.18em] text-brass uppercase">
          Invalid case file
        </p>
        <h1 className="font-serif text-3xl">Briefing not found</h1>
        <a className="inline-block text-cyan underline" href="/">
          Open today’s briefing
        </a>
      </section>
    </main>
  );
}

function CaseRoute() {
  const { caseData, publishedCases } = Route.useLoaderData();
  const { date } = Route.useParams();
  const [today, setToday] = useState('');

  useEffect(() => {
    setToday(formatLocalDate(new Date()));
  }, []);

  return (
    <AppShell
      caseData={caseData}
      date={date}
      publishedCases={publishedCases}
      today={today}
    />
  );
}
