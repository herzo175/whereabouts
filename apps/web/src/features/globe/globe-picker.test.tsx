import { render, screen } from '@testing-library/react';
import type { Poi } from '@whereabouts/case-content';
import { describe, expect, it, vi } from 'vitest';

import { PoiPicker } from '../game/poi-picker';
import { GlobePicker } from './globe-picker';

vi.mock('./globe-canvas', () => ({
  GlobeCanvas: () => <div data-testid="globe-canvas" />,
}));

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
];

describe('GlobePicker', () => {
  it('loads the interactive globe automatically', async () => {
    render(
      <GlobePicker
        disabledPoiIds={new Set()}
        onSelect={vi.fn()}
        pois={pois}
        supported
      />,
    );

    expect(await screen.findByTestId('globe-canvas')).toBeInTheDocument();
  });

  it('announces fallback while preserving the location search control', () => {
    render(
      <GlobePicker
        disabledPoiIds={new Set()}
        onSelect={vi.fn()}
        pois={pois}
        supported={false}
      />,
    );

    expect(screen.getByRole('status')).toHaveTextContent(
      'Globe unavailable; use location list',
    );
  });

  it('keeps the searchable location list available in the picker fallback', () => {
    render(<PoiPicker onGuess={vi.fn()} pois={pois} />);

    expect(
      screen.getByRole('searchbox', { name: /search locations/i }),
    ).toBeInTheDocument();
  });
});
