import { describe, expect, it, vi } from 'vitest';

import { attachWikipediaImages, selectPoisForDate } from './generate-range.js';

const catalog = Array.from({ length: 75 }, (_, index) => ({
  id: `poi-${String(index).padStart(2, '0')}`,
  name: `Place ${index}`,
  city: `City ${index}`,
  country: `Country ${index}`,
  latitude: index,
  longitude: index,
  wikipediaTitle: `Place ${index}`,
  region: `Region ${index % 10}`,
}));

describe('selectPoisForDate', () => {
  it('is reproducible for a shared daily case', () => {
    expect(selectPoisForDate(catalog, '2026-08-14')).toEqual(
      selectPoisForDate(catalog, '2026-08-14'),
    );
  });

  it('rotates targets without repeats during a catalog cycle', () => {
    const targets = Array.from({ length: catalog.length }, (_, offset) => {
      const date = new Date(Date.UTC(2026, 7, 14 + offset))
        .toISOString()
        .slice(0, 10);
      return selectPoisForDate(catalog, date)[0]?.id;
    });

    expect(new Set(targets).size).toBe(catalog.length);
  });

  it('does not reuse nearly the entire candidate set on adjacent days', () => {
    const today = selectPoisForDate(catalog, '2026-08-14');
    const tomorrow = selectPoisForDate(catalog, '2026-08-15');
    const todayIds = new Set(today.map((poi) => poi.id));
    const overlap = tomorrow.filter((poi) => todayIds.has(poi.id));

    expect(today).toHaveLength(25);
    expect(tomorrow).toHaveLength(25);
    expect(overlap.length).toBeLessThanOrEqual(12);
  });

  it('caps candidates from any one region', () => {
    const selected = selectPoisForDate(catalog, '2026-08-14');
    const regionCounts = new Map<string, number>();
    for (const poi of selected) {
      regionCounts.set(poi.region, (regionCounts.get(poi.region) ?? 0) + 1);
    }

    expect(Math.max(...regionCounts.values())).toBeLessThanOrEqual(3);
  });
});

describe('attachWikipediaImages', () => {
  it('enriches every candidate with its available attributed image', async () => {
    const selected = catalog.slice(0, 3);
    const fetchImage = vi.fn(async (title: string) =>
      title === 'Place 1'
        ? undefined
        : {
            url: `https://upload.wikimedia.org/${title}.jpg`,
            alt: title,
            attribution: 'Example contributor · CC BY-SA 4.0',
            licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
          },
    );

    const enriched = await attachWikipediaImages(selected, fetchImage);

    expect(fetchImage).toHaveBeenCalledTimes(3);
    expect(fetchImage).toHaveBeenNthCalledWith(1, 'Place 0');
    expect(fetchImage).toHaveBeenNthCalledWith(2, 'Place 1');
    expect(fetchImage).toHaveBeenNthCalledWith(3, 'Place 2');
    expect(enriched[0]?.image?.alt).toBe('Place 0');
    expect(enriched[1]?.image).toBeUndefined();
    expect(enriched[2]?.image?.alt).toBe('Place 2');
  });
});
