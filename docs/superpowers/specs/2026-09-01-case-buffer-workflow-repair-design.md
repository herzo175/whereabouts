# Case Buffer Workflow Repair Design

## Problem

The daily case-buffer workflow has two independent failures:

1. It schedules runs at both possible UTC equivalents of midnight Eastern, then checks the runner's actual wall-clock hour. GitHub Actions may delay scheduled runs, so delayed runs skip every useful step and still report success.
2. Runs that pass that guard fail during candidate research because the Azure-backed structured-output provider rejects an optional `wikipediaTitle` property. Its strict JSON Schema dialect requires every object property to appear in `required`.

## Design

Schedule one daily run at 05:00 UTC and execute it unconditionally. Exact midnight timing is not required for a ten-day publication buffer; 05:00 UTC is midnight EST and 01:00 EDT, and delayed jobs must still run when GitHub eventually starts them. Manual dispatch behavior remains unchanged.

At the model boundary, require `wikipediaTitle` while allowing either a non-empty string or `null`. Prompt the model to return `null` when it does not know a title. Normalize `null` back to the existing omitted-property representation before applying the internal candidate schema, so downstream types and behavior do not change.

## Testing

The workflow regression test will assert that there is one 05:00 UTC schedule, no midnight guard, and no step conditions tied to that guard. The candidate-research test will inspect the generated JSON Schema to confirm `wikipediaTitle` is required and nullable, then verify that model candidates containing `null` remain valid candidates without Wikipedia metadata.

Run the focused workflow and candidate-research tests first, followed by the content-tools test suite, typecheck, and repository quality command.
