import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const workflowUrl = new URL(
  '../../../.github/workflows/generate-cases.yml',
  import.meta.url,
);

describe('generate cases workflow', () => {
  it('generates a new revision for manual dispatches and only fills missing scheduled dates', async () => {
    const workflow = await readFile(workflowUrl, 'utf8');
    const generationStep = workflow.slice(
      workflow.indexOf('name: Generate requested case or maintain buffer'),
      workflow.indexOf('name: Format generated case content'),
    );

    expect(generationStep).toMatch(
      /if \[ "\$\{\{ github\.event_name \}\}" = "workflow_dispatch" \]; then/,
    );
    expect(generationStep).toMatch(
      /pnpm content:generate-range -- "\$\{ARGS\[@\]\}"/,
    );
    expect(generationStep).toMatch(
      /pnpm content:prepare-buffer -- "\$\{ARGS\[@\]\}"/,
    );
  });
});
