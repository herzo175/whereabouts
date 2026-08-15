import { describe, expect, it, vi } from 'vitest';

import {
  attachWikipediaImages,
  ensureImageBackedPois,
  generateWithRetries,
  selectPoisForDate,
  targetExclusionsForDate,
} from './generate-range.js';

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

  it('selects five explicit targets without reusing a target from the prior 30 dates', () => {
    const history = new Map(
      Array.from({ length: 30 }, (_, index) => [
        `2026-07-${String(index + 1).padStart(2, '0')}`,
        [`poi-${String(index).padStart(2, '0')}`],
      ]),
    );
    const excluded = targetExclusionsForDate(history, '2026-08-14');
    const selected = selectPoisForDate(catalog, '2026-08-14', excluded);

    expect(selected.slice(0, 5)).toHaveLength(5);
    expect(new Set(selected.slice(0, 5).map((poi) => poi.id)).size).toBe(5);
    expect(selected.slice(0, 5).some((poi) => excluded.has(poi.id))).toBe(
      false,
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

  it('deterministically replaces candidates without images from the larger catalog', async () => {
    const selected = catalog.slice(0, 5);
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

    const sourced = await ensureImageBackedPois(
      selected,
      catalog,
      '2026-08-14',
      fetchImage,
    );

    expect(sourced).toHaveLength(5);
    expect(sourced.every((poi) => poi.image)).toBe(true);
    expect(sourced.some((poi) => poi.id === 'poi-01')).toBe(false);
    await expect(
      ensureImageBackedPois(selected, catalog, '2026-08-14', fetchImage),
    ).resolves.toEqual(sourced);
  });

  it('never promotes an excluded prior target when replacing an image-less target', async () => {
    const selected = catalog.slice(0, 25);
    const excluded = new Set(['poi-25', 'poi-26', 'poi-27']);
    const fetchImage = vi.fn(async (title: string) =>
      title === 'Place 0'
        ? undefined
        : {
            url: `https://upload.wikimedia.org/${title}.jpg`,
            alt: title,
            attribution: 'Example contributor · CC BY-SA 4.0',
            licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
          },
    );

    const sourced = await ensureImageBackedPois(
      selected,
      catalog,
      '2026-08-14',
      fetchImage,
      excluded,
    );

    expect(sourced).toHaveLength(25);
    expect(sourced.slice(0, 5).every((poi) => poi.image)).toBe(true);
    expect(sourced.slice(0, 5).some((poi) => excluded.has(poi.id))).toBe(false);
  });
});

describe('generateWithRetries', () => {
  it('retries a full generation after publication validation failures', async () => {
    const generate = vi.fn(async () => {
      if (generate.mock.calls.length < 3)
        throw new Error('publication validation failed: invalid tier spread');
      return 'published draft';
    });

    await expect(generateWithRetries(generate)).resolves.toBe(
      'published draft',
    );
    expect(generate).toHaveBeenCalledTimes(3);
  });

  it('fails deterministic setup errors without retrying', async () => {
    const generate = vi.fn(async () => {
      throw new Error('generation requires images for all 25 POIs');
    });

    await expect(generateWithRetries(generate)).rejects.toThrow(
      'generation requires images for all 25 POIs',
    );
    expect(generate).toHaveBeenCalledTimes(1);
  });
});
