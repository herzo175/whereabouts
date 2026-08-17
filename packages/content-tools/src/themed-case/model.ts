import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { generateText, Output } from 'ai';
import type { z } from 'zod';

export interface StructuredModel {
  generate<T>({
    schema,
    prompt,
    stage,
  }: {
    schema: z.ZodType<T>;
    prompt: string;
    stage: string;
  }): Promise<T>;
}
export function createOpenRouterModel(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): StructuredModel {
  const apiKey = environment.OPENROUTER_API_KEY?.trim();
  if (!apiKey) throw new Error('OPENROUTER_API_KEY is required');
  const model = environment.WHEREABOUTS_MODEL?.trim() || 'openai/gpt-5.6-luna';
  const client = createOpenRouter({ apiKey, appName: 'Whereabouts' });
  return {
    generate: async <T>({
      schema,
      prompt,
      stage,
    }: {
      schema: z.ZodType<T>;
      prompt: string;
      stage: string;
    }): Promise<T> => {
      try {
        const result = await generateText({
          model: client.chat(model),
          abortSignal: AbortSignal.timeout(180_000),
          maxRetries: 0,
          output: Output.object({ schema }),
          prompt,
        });
        return result.output as T;
      } catch (error) {
        throw new Error(
          `[${stage}] structured generation failed: ${error instanceof Error ? error.message : String(error)}`,
          { cause: error },
        );
      }
    },
  };
}
