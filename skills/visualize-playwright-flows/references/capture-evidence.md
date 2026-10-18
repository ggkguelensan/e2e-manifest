# Capture visual evidence

**Read for:** every capture. Defines capture rules; the shared schemas own the data format.

## Preconditions

Run the target behavioral scenario first and confirm it passes. Derive actions and expectations from the public spec without opening helper implementations. A Journey is optional. If the sequence cannot be translated into Given/When/Then without guessing, clarify the scenario before capture; do not invent steps from application internals.

Create a temporary capture harness only when existing Playwright output cannot produce the required evidence. Reuse public POM, optional Journey and control interfaces supplied by the fixture. Keep screenshot calls, reporting hooks and output-specific branches out of the application, specs, Journey and POM. Do not add `toHaveScreenshot`, visual-regression baselines or committed PNGs.

## Capture contract

For every user-visible assertion that materially advances or explains the flow:

1. Perform the user action.
2. Wait for the semantic assertion to pass.
3. Ensure fonts and relevant images are loaded and meaningful animation has settled.
4. Confirm developer tools and debug overlays are absent.
5. Mark the exact region that proves the assertion.
6. Capture one PNG for that assertion.
7. Remove any temporary marker before continuing.

Use observation-based waits, never arbitrary sleeps. An annotation belongs outside application content or is applied after capture; it must not obscure or reflow the UI. A frame answers one question and its caption states that question as an observable expectation.

A passing Playwright scenario is necessary but not sufficient visual evidence:

- wait for an application-specific visual readiness signal before capture;
- prefer a non-layout-changing marker attached directly to the target; use coordinate overlays only as a fallback;
- make the screenshot prove a visible fact; use semantic evidence for accessibility-only state;
- inspect every captured frame for applied styles and correct marker placement.

Use synthetic identities and data only. Never expose tokens, cookies, real personal data or private environment values.

## Evidence storage

Use the authoritative [run/evidence format](../../../docs/evidence.md), not a second flow manifest. Capture writes `runs/<run-id>/run.json`, `evidence.json` and `assets/` inside the selected target's `e2e/tmp/`. Storage and publication follow the [local policy](../../../docs/local-workflow.md).

Start run.json before execution with running status. Each executed case identifies scenario_id, spec path/hash, profile and attempt; each public step has a stable ID and outcome. Preserve failed/interrupted attempts. A screenshot proving a passed assertion belongs to that case/step and records its actual capture conditions, timestamp, MIME and SHA-256. Diagnostic failure captures are labelled as diagnostics, never as proof of a passed expectation.

Keep original screenshots immutable. If annotation is needed, preserve the original separately and record the derivation in the description; don't replace the only unmarked evidence. Prefer names that identify the case and step. Never use these images as visual-regression assertions.

Finalize run statuses even on failure where possible. If execution terminates before finalization, leave running as incomplete rather than inventing a terminal result. Run `npm run validate:evidence -- --target <target-root> --run <run-id>` from the pinned manifest, inspect screenshots and pass the same run to reporting. Report formatting does not rerun the scenario.
