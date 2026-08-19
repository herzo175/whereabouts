import { render, screen } from '@testing-library/react';
import { makeFiveRoundCase } from '@whereabouts/case-content/testing';
import { describe, expect, it } from 'vitest';

import { ThemeBriefing } from './theme-briefing';

describe('ThemeBriefing', () => {
  it("labels and presents today's theme accessibly", () => {
    const { theme } = makeFiveRoundCase();
    render(<ThemeBriefing theme={theme} />);
    expect(screen.getByText("Today's theme")).toBeVisible();
    expect(screen.getByRole('heading', { name: theme.title })).toBeVisible();
    expect(screen.getByText(theme.introduction)).toBeVisible();
    expect(screen.getByRole('region', { name: theme.title })).toBeVisible();
    expect(screen.getByText("Today's theme")).toHaveClass(
      'text-center',
      'sm:text-left',
    );
    expect(screen.getByRole('heading', { name: theme.title })).toHaveClass(
      'text-center',
      'sm:text-left',
    );
    expect(screen.getByText(theme.introduction)).toHaveClass('text-left');
  });
});
