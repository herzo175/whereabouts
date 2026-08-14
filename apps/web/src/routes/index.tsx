import { createFileRoute } from '@tanstack/react-router';
import { formatLocalDate } from '@whereabouts/browser-state';
import { useEffect } from 'react';

export const Route = createFileRoute('/')({
  component: Home,
});

export function resolveToday(now: Date): string {
  return formatLocalDate(now);
}

function Home() {
  const navigate = Route.useNavigate();

  useEffect(() => {
    void navigate({
      params: { date: resolveToday(new Date()) },
      replace: true,
      to: '/$date',
    });
  }, [navigate]);

  return (
    <main
      aria-busy="true"
      className="grid min-h-screen place-items-center bg-background px-6 text-paper"
    >
      <output aria-live="polite">Opening today’s briefing…</output>
    </main>
  );
}
