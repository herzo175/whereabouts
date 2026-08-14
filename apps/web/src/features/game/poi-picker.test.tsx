import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Poi } from '@whereabouts/case-content';
import { describe, expect, it, vi } from 'vitest';

import { PoiPicker } from './poi-picker';

const pois: Poi[] = [
  {
    id: 'sagrada-familia',
    name: 'Sagrada Família',
    city: 'Barcelona',
    country: 'Spain',
    latitude: 41.4036,
    longitude: 2.1744,
    wikipediaTitle: 'Sagrada_Família',
  },
  {
    id: 'table-mountain',
    name: 'Table Mountain',
    city: 'Cape Town',
    country: 'South Africa',
    latitude: -33.9628,
    longitude: 18.4098,
    wikipediaTitle: 'Table_Mountain',
  },
];

describe('PoiPicker', () => {
  it.each([
    ['name', 'sagrada', 'Sagrada Família'],
    ['city', 'cape town', 'Table Mountain'],
    ['country', 'south africa', 'Table Mountain'],
  ])('searches POIs by %s', async (_field, query, expected) => {
    const user = userEvent.setup();
    render(<PoiPicker pois={pois} onGuess={vi.fn()} />);

    await user.type(
      screen.getByRole('searchbox', { name: /search locations/i }),
      query,
    );

    expect(
      screen.getByRole('button', { name: new RegExp(expected, 'i') }),
    ).toBeDefined();
    expect(
      screen.queryByRole('button', {
        name: new RegExp(
          expected === 'Sagrada Família' ? 'table mountain' : 'sagrada família',
          'i',
        ),
      }),
    ).toBeNull();
  });

  it('opens a dossier when a POI is selected', async () => {
    const user = userEvent.setup();
    render(<PoiPicker pois={pois} onGuess={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: /sagrada família/i }));

    expect(
      screen.getByRole('dialog', { name: /sagrada família/i }),
    ).toBeDefined();
    expect(
      screen.getByRole('button', { name: /submit this lead/i }),
    ).toBeDefined();
  });

  it('cancels without guessing and restores focus to the selected POI', async () => {
    const user = userEvent.setup();
    const onGuess = vi.fn();
    render(<PoiPicker pois={pois} onGuess={onGuess} />);

    const poiButton = screen.getByRole('button', { name: /sagrada família/i });
    await user.click(poiButton);
    await user.click(screen.getByRole('button', { name: /cancel/i }));

    expect(onGuess).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(poiButton);
  });

  it('submits a selected POI exactly once', async () => {
    const user = userEvent.setup();
    const onGuess = vi.fn();
    render(<PoiPicker pois={pois} onGuess={onGuess} />);

    await user.click(screen.getByRole('button', { name: /sagrada família/i }));
    const submit = screen.getByRole('button', { name: /submit this lead/i });
    await user.dblClick(submit);

    expect(onGuess).toHaveBeenCalledTimes(1);
    expect(onGuess).toHaveBeenCalledWith(pois[0]);
  });

  it('marks guessed POIs as eliminated and prevents selection', async () => {
    const user = userEvent.setup();
    render(
      <PoiPicker
        pois={pois}
        guessedPoiIds={new Set(['sagrada-familia'])}
        onGuess={vi.fn()}
      />,
    );

    const eliminatedPoi = screen.getByRole('button', {
      name: /sagrada família/i,
    });
    expect((eliminatedPoi as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(/already eliminated/i)).toBeDefined();
    await user.click(eliminatedPoi);
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
