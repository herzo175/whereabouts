import { describe, expect, it } from 'vitest';
import type { ThemePlan } from './contracts.js';
import { planTheme } from './theme-planner.js';

const theme: ThemePlan = {
  title: 'Canal-side customs houses',
  introduction:
    'A narrow tour of historic customs houses beside navigable canals worldwide.',
  inclusionCriteria:
    'Include surviving named customs houses beside canals with documented trade history.',
  exclusions: [
    'Exclude generic warehouses and buildings without a canal-side customs role.',
  ],
  searchQueries: [
    'historic canal customs house',
    'canal port customs house',
    'customs house waterway',
  ],
};

describe('planTheme', () => {
  it('includes prior themes and requirements in the model prompt', async () => {
    let prompt = '';
    const result = await planTheme({
      model: {
        generate: async ({ prompt: value }) => {
          prompt = value;
          return theme;
        },
      },
      recentThemes: Array.from({ length: 100 }, (_, index) => ({
        title: `Previous theme ${index}`,
        inclusionCriteria: `Previous criteria ${index}`,
      })),
    });
    expect(result).toEqual(theme);
    expect(prompt).toContain('Previous theme 10');
    expect(prompt).not.toContain('Previous theme 0');
    expect(prompt).toContain('Previous criteria 99');
    expect(prompt).toContain('at least 35 plausible locations');
    expect(prompt).toContain('well-known');
    expect(prompt).toContain('unambiguous');
    expect(prompt).toContain('3 to 12');
  });

  it('rejects an exact normalized title and criteria duplicate', async () => {
    await expect(
      planTheme({
        model: { generate: async () => theme },
        recentThemes: [
          {
            title: '  CANAL-SIDE CUSTOMS HOUSES ',
            inclusionCriteria: ` ${theme.inclusionCriteria.toUpperCase()} `,
          },
        ],
      }),
    ).rejects.toThrow(/duplicate/i);
  });
});
