import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const workflowUrl = new URL(
  '../../../.github/workflows/generate-cases.yml',
  import.meta.url,
);

describe('generate cases workflow', () => {
  it('runs one daily schedule without a runner wall-clock guard', async () => {
    const workflow = await readFile(workflowUrl, 'utf8');

    expect(workflow).toContain("- cron: '0 5 * * *'");
    expect(workflow).not.toContain("cron: '0 4,5 * * *'");
    expect(workflow).not.toContain('Check for midnight Eastern');
    expect(workflow).not.toContain('steps.schedule.outputs.run');
  });

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

  it('merges the generated pull request without requiring repository auto-merge', async () => {
    const workflow = await readFile(workflowUrl, 'utf8');
    const publicationStep = workflow.slice(
      workflow.indexOf(
        'name: Commit and publish generated buffer pull request',
      ),
    );

    expect(publicationStep).toContain('gh pr merge --squash "$PR_URL"');
    expect(publicationStep).not.toContain('gh pr merge --auto');
  });
});
