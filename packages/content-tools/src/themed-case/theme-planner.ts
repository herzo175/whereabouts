import { type ThemePlan, themePlanSchema } from './contracts.js';
import type { StructuredModel } from './model.js';

const normalize = (value: string) =>
  value.trim().toLocaleLowerCase().replace(/\s+/g, ' ');

export async function planTheme(input: {
  model: StructuredModel;
  recentThemes: Array<{ title: string; inclusionCriteria: string }>;
}): Promise<ThemePlan> {
  const previous = input.recentThemes.slice(-90);
  const prompt = [
    'Design one narrow, player-readable geography theme for a daily location game.',
    'It must have hard inclusion criteria and hard exclusion rules, 3 to 12 live discovery queries, and at least 35 plausible locations.',
    'The theme must be materially novel compared with every previous theme below. Do not suggest multiple themes.',
    'Previous themes (title — inclusion criteria):',
    ...previous.map((theme) => `- ${theme.title} — ${theme.inclusionCriteria}`),
    'Return only the structured theme plan.',
  ].join('\n');
  const parsed = themePlanSchema.parse(
    await input.model.generate({
      schema: themePlanSchema,
      prompt,
      stage: 'theme planning',
    }),
  );
  const key = `${normalize(parsed.title)}\n${normalize(parsed.inclusionCriteria)}`;
  const duplicate = previous.some(
    (theme) =>
      `${normalize(theme.title)}\n${normalize(theme.inclusionCriteria)}` ===
      key,
  );
  if (duplicate) throw new Error(`Duplicate theme rejected: ${parsed.title}`);
  return parsed;
}
