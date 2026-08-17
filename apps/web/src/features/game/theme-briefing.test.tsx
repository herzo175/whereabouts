import { render, screen } from '@testing-library/react';
import { makeThemedCase } from '@whereabouts/case-content/testing';
import { describe, expect, it } from 'vitest';

import { ThemeBriefing } from './theme-briefing';

describe('ThemeBriefing', () => {
  it("labels and presents today's theme accessibly", () => {
    const { theme } = makeThemedCase();
    render(<ThemeBriefing theme={theme} />);
    expect(screen.getByText("Today's theme")).toBeVisible();
    expect(screen.getByRole('heading', { name: theme.title })).toBeVisible();
    expect(screen.getByText(theme.introduction)).toBeVisible();
    expect(screen.getByRole('region', { name: theme.title })).toBeVisible();
  });
});
