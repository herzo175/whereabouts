# Whereabouts launch checklist

## Engineering

- [ ] Run Biome CI, TypeScript, unit/component tests, publication validation, and the production build through `pnpm quality`.
- [ ] Complete the deterministic browser journeys at desktop and mobile sizes, including local-date routing, resume/corrupt-state recovery, sharing, and the list-only flow.
- [ ] Confirm runtime bundles contain no OpenRouter or AI SDK code and runtime gameplay makes no model calls.
- [ ] Verify reduced-motion behavior, keyboard focus, readable temperature labels, 44px controls, and the WebGL-independent list flow.

## Content

- [ ] Configure `OPENROUTER_API_KEY` and a contact-bearing `WIKIMEDIA_USER_AGENT`.
- [ ] Configure `WHEREABOUTS_MODEL` and, when available, an independent `WHEREABOUTS_CRITIC_MODEL`.
- [ ] Generate the initial ten-day batch with `content:generate-range`.
- [ ] Run `content:validate` at the generated publication ceiling.
- [ ] Inspect every audit JSON, Markdown packet, image attribution, clue, and relationship verdict.
- [ ] Confirm `reviews/index.md` links the complete batch and states that all semantic verdicts passed.
- [ ] Merge only approved immutable artifacts through the reviewed publishing workflow.
- [ ] For ongoing operation, run `content:prepare-buffer` for today plus nine days and repair failures with new revisions.

## Release

- [ ] Configure the canonical production origin and deployment credentials.
- [ ] Run the deployed smoke test after the reviewed content change is released.
- [ ] Document any withdrawn dates while retaining their immutable artifacts for auditability.
