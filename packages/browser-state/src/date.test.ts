import { describe, expect, it } from 'vitest';

import { formatLocalDate, parseCaseDate } from './date.js';

describe('formatLocalDate', () => {
  it('formats local calendar components without converting to UTC', () => {
    expect(formatLocalDate(new Date(2026, 7, 4, 23, 59))).toBe('2026-08-04');
  });

  it('pads single-digit local months and days', () => {
    expect(formatLocalDate(new Date(2026, 0, 2))).toBe('2026-01-02');
  });
});

describe('parseCaseDate', () => {
  it('returns canonical valid calendar dates', () => {
    expect(parseCaseDate('2026-08-04')).toBe('2026-08-04');
    expect(parseCaseDate('2028-02-29')).toBe('2028-02-29');
  });

  it('rejects noncanonical date strings', () => {
    expect(parseCaseDate('2026-8-04')).toBeNull();
    expect(parseCaseDate('2026-08-4')).toBeNull();
    expect(parseCaseDate('2026/08/04')).toBeNull();
    expect(parseCaseDate('2026-08-04 ')).toBeNull();
    expect(parseCaseDate('026-08-04')).toBeNull();
  });

  it('rejects impossible calendar dates', () => {
    expect(parseCaseDate('2026-02-29')).toBeNull();
    expect(parseCaseDate('2026-04-31')).toBeNull();
    expect(parseCaseDate('2026-00-01')).toBeNull();
    expect(parseCaseDate('2026-13-01')).toBeNull();
  });

  it('round-trips years below 100 without Date constructor coercion', () => {
    expect(parseCaseDate('0099-12-31')).toBe('0099-12-31');
    expect(parseCaseDate('0000-02-29')).toBe('0000-02-29');
    expect(parseCaseDate('0100-02-29')).toBeNull();
  });
});
