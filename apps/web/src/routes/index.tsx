import { createFileRoute } from '@tanstack/react-router';

import { createGameEngine } from '@whereabouts/game-engine';

export const Route = createFileRoute('/')({
  component: Home,
});

function Home() {
  const engine = createGameEngine();

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl items-center px-6">
      <section className="space-y-4">
        <p className="text-sm font-medium tracking-[0.2em] text-muted-foreground uppercase">
          Geography mystery game
        </p>
        <h1 className="text-5xl font-semibold tracking-tight">Whereabouts</h1>
        <p className="max-w-xl text-lg text-muted-foreground">
          Follow the clues, make your case, and find the answer.
        </p>
        <p className="text-sm text-muted-foreground">
          Game engine: {engine.status}
        </p>
      </section>
    </main>
  );
}
