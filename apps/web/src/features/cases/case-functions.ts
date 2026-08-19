import { createServerFn } from '@tanstack/react-start';
import { parseCaseDate } from '@whereabouts/browser-state';

function validateCaseDate(data: unknown): { date: string } {
  if (
    typeof data !== 'object' ||
    data === null ||
    !('date' in data) ||
    typeof data.date !== 'string'
  ) {
    throw new Error('A canonical case date is required.');
  }

  const date = parseCaseDate(data.date);
  if (date === null) {
    throw new Error('Case dates must be real dates in YYYY-MM-DD format.');
  }

  return { date };
}

export const getPublishedCase = createServerFn({ method: 'GET' })
  .validator(validateCaseDate)
  .handler(async ({ data }) => {
    const { loadPublishedCase } = await import(
      '@whereabouts/case-content/server'
    );
    return loadPublishedCase(data.date);
  });
