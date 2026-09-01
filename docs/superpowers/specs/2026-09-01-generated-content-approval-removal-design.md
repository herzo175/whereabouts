# Generated Content Approval Removal Design

## Problem

Case generation creates and merges a pull request with GitHub Actions' `GITHUB_TOKEN`. GitHub places `pull_request` workflows created by that token into an approval-required state, while suppressing `push` workflows caused by the bot merge. The result is a noisy Quality approval gate and no automatic Fly deployment for generated content.

## Design

Exclude pull requests whose changes are entirely under `packages/case-content/content/**` from the Quality workflow. The generator already runs `pnpm content:validate` and `pnpm quality` before it creates the pull request, so another pull-request Quality run is redundant.

After merging generated content, resolve and validate the exact merge commit SHA, then explicitly dispatch `deploy-fly.yml` with that SHA. Grant the generator only the additional `actions: write` permission required for dispatch. Add a `ref` input to the deployment workflow's manual trigger so its existing checkout expression deploys precisely that merge commit. `workflow_dispatch` is intentionally allowed to run when invoked with `GITHUB_TOKEN`.

## Testing

Workflow regression tests will assert the generated-content path exclusion, the scoped Actions permission, merge-SHA validation, deployment dispatch, and matching deployment input. YAML parsing and the complete repository quality pipeline will verify syntax and unaffected behavior.
