import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ArchiveDrawer } from './archive-drawer';

const publishedCases = [
  { date: '2026-08-12', caseNumber: 10 },
  { date: '2026-08-14', caseNumber: 12 },
  { date: '2026-08-13', caseNumber: 11 },
];

describe('ArchiveDrawer', () => {
  it('shows only supplied published cases newest first without target names', () => {
    render(
      <ArchiveDrawer
        data-published-cases={publishedCases}
        onOpenChange={vi.fn()}
        open
        publishedCases={publishedCases}
        today="2026-08-14"
      />,
    );

    const links = screen.getAllByRole('link');
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      '/2026-08-14',
      '/2026-08-13',
      '/2026-08-12',
    ]);
    expect(screen.getByText('Today')).toBeDefined();
    expect(screen.getByText(/case 012/i)).toBeDefined();
    expect(screen.queryByText(/target|city|country/i)).toBeNull();
  });

  it('closes with its control and returns focus to the opener', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    const { rerender } = render(
      <>
        <button type="button">Open archive</button>
        <ArchiveDrawer
          onOpenChange={onOpenChange}
          open={false}
          publishedCases={publishedCases}
          today="2026-08-14"
        />
      </>,
    );
    const opener = screen.getByRole('button', { name: /open archive/i });
    opener.focus();
    rerender(
      <>
        <button type="button">Open archive</button>
        <ArchiveDrawer
          onOpenChange={onOpenChange}
          open
          publishedCases={publishedCases}
          today="2026-08-14"
        />
      </>,
    );

    await user.click(screen.getByRole('button', { name: /close archive/i }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(document.activeElement).toBe(opener);
  });
});
