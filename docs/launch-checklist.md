# Whereabouts launch checklist

Verified on 2026-08-14:

- [x] Biome CI, TypeScript, unit/component tests, publication validation, and production build pass through `pnpm quality`.
- [x] Playwright completes nine deterministic desktop/mobile journeys, including local-date routing, win/loss, resume and corrupt-state recovery, spoiler-free sharing, list-only completion, and mobile dossier confirmation.
- [x] The 2026-08-14 Istanbul case passes schema, source-reference, coordinate, publication, and spoiler-leak validation.
- [x] The globe is emitted as a separate lazy client chunk; the initial route does not contain the Three.js payload.
- [x] AI SDK/provider identifiers are absent from the browser client bundle. AI runs only in the publishing tools.
- [x] Reduced-motion rules, keyboard focus management, text temperature labels, 44-pixel controls, and a WebGL-independent list flow are implemented and covered by component or browser tests.

Required before a public launch:

- [ ] Review the interface manually at 320×568, 375×667, and 390×844, at 200% zoom, and with a physical keyboard/screen reader.
- [ ] Configure `OPENAI_API_KEY` and a contact-bearing `WIKIMEDIA_USER_AGENT` in the publishing environment.
- [ ] Generate the remaining 29 launch cases from 2026-08-15, inspect every review packet, and merge only approved immutable artifacts.
- [ ] Configure the canonical production origin and run the deployed smoke test.

The launch-content step was intentionally not run locally because publishing credentials were not present. The hand-authored development case remains the only public manifest entry.
