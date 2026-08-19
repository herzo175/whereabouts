import { render, screen } from '@testing-library/react';
import type { Poi } from '@whereabouts/case-content';
import { describe, expect, it, vi } from 'vitest';

import { PoiDossier } from './poi-dossier';

const poi: Poi = {
  id: 'target-place',
  name: 'Target Place',
  city: 'Target City',
  country: 'Exampleland',
  latitude: 1,
  longitude: 2,
  wikipediaTitle: 'Target Place',
  blurb:
    'A documented location with enough historical context for a complete dossier.',
};

const image: NonNullable<Poi['image']> = {
  url: 'https://example.test/round.jpg',
  alt: 'Round evidence photograph',
  attribution: 'Example photographer · CC BY 4.0',
  licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
};

describe('PoiDossier', () => {
  it('shows all available sources in a full dossier', () => {
    render(
      <PoiDossier
        detail="full"
        imageOverride={image}
        onOpenChange={vi.fn()}
        open
        poi={poi}
        wikipediaUrl="https://en.wikipedia.org/wiki/Target_Place"
      />,
    );

    expect(screen.getByRole('img', { name: image.alt })).toHaveAttribute(
      'src',
      image.url,
    );
    expect(screen.getByRole('img', { name: image.alt })).toHaveAttribute(
      'width',
      '1200',
    );
    const dialog = screen.getByRole('dialog', { name: poi.name });
    expect(dialog).toHaveClass('flex', 'max-h-[100svh]');
    expect(dialog.querySelector('.overflow-y-auto')).not.toBeNull();
    expect(screen.getByText(poi.blurb ?? '')).toBeVisible();
    expect(
      screen.getByRole('link', { name: /target place on wikipedia/i }),
    ).toHaveAttribute('href', 'https://en.wikipedia.org/wiki/Target_Place');
    expect(screen.getByText(image.attribution)).toBeVisible();
    expect(
      screen.getByRole('link', { name: /target place photo license/i }),
    ).toHaveAttribute('href', image.licenseUrl);
  });

  it('keeps source material hidden in an identity-only dossier', () => {
    render(
      <PoiDossier
        detail="identity"
        imageOverride={image}
        onOpenChange={vi.fn()}
        open
        poi={poi}
        wikipediaUrl="https://en.wikipedia.org/wiki/Target_Place"
      />,
    );

    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.queryByText(poi.blurb ?? '')).toBeNull();
    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.queryByText(image.attribution)).toBeNull();
  });

  it('shows a quiet image fallback when optional sources are absent', () => {
    render(
      <PoiDossier
        detail="full"
        onOpenChange={vi.fn()}
        open
        poi={{ ...poi, blurb: undefined, image: undefined }}
      />,
    );

    expect(
      screen.getByRole('img', { name: 'Archival image unavailable' }),
    ).toBeVisible();
    expect(screen.queryByRole('link')).toBeNull();
  });
});
