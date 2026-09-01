import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const workflowUrl = new URL(
  '../../../.github/workflows/generate-cases.yml',
  import.meta.url,
);
const qualityWorkflowUrl = new URL(
  '../../../.github/workflows/quality.yml',
  import.meta.url,
);
const deployWorkflowUrl = new URL(
  '../../../.github/workflows/deploy-fly.yml',
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

  it('does not start approval-gated quality runs for generated-content-only pull requests', async () => {
    const workflow = await readFile(qualityWorkflowUrl, 'utf8');

    expect(workflow).toMatch(
      /pull_request:\n\s+paths-ignore:\n\s+- 'packages\/case-content\/content\/\*\*'/,
    );
  });

  it('dispatches deployment for the exact generated-content merge commit', async () => {
    const [workflow, deployWorkflow] = await Promise.all([
      readFile(workflowUrl, 'utf8'),
      readFile(deployWorkflowUrl, 'utf8'),
    ]);
    const publicationStep = workflow.slice(
      workflow.indexOf(
        'name: Commit and publish generated buffer pull request',
      ),
    );

    expect(workflow).toMatch(/permissions:\n\s+actions: write/);
    expect(publicationStep).toContain(
      'MERGE_SHA="$(gh pr view "$PR_URL" --json mergeCommit --jq \'.mergeCommit.oid\')"',
    );
    expect(publicationStep).toContain('[[ ! "$MERGE_SHA" =~ ^[0-9a-f]{40}$ ]]');
    expect(publicationStep).toContain(
      'gh workflow run deploy-fly.yml --ref main -f ref="$MERGE_SHA"',
    );
    expect(deployWorkflow).toMatch(
      /workflow_dispatch:\n\s+inputs:\n\s+ref:\n\s+description: Commit to verify and deploy/,
    );
  });
});
