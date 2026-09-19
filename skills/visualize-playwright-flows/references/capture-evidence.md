# Capture visual evidence

## Preconditions

Run the target behavioral scenario first and confirm it passes. Derive the human-readable step sequence from the spec and journey; do not invent steps from implementation details.

Create a temporary capture harness only when existing Playwright output cannot produce the required evidence. Reuse public journeys and POM interfaces. Do not commit screenshot calls, reporting hooks or output-specific branches to the behavioral suite.

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

## Evidence manifest

Store the temporary manifest next to its screenshots. Paths are relative to the manifest. Name captured screenshots `*.tmp.png`; do not commit them or use them as assertions. Keep report assets for as long as the standalone report is needed, then remove temporary captures and the capture harness.

```json
{
	"name": "user-flow",
	"title": "User flow",
	"description": "Observable browser journey",
	"source": "e2e/example.main.spec.ts",
	"generatedAt": "2026-01-01T00:00:00.000Z",
	"scenarios": [
		{
			"id": "primary-flow",
			"title": "Primary user flow",
			"devices": [
				{
					"name": "mobile-webkit",
					"viewport": { "width": 390, "height": 844 },
					"steps": [
						{
							"number": 1,
							"action": "The user opens the start page",
							"expectation": "The primary navigation is available",
							"screenshot": "01-start.tmp.png",
							"alt": "Start page with the primary navigation highlighted"
						}
					]
				}
			]
		}
	]
}
```

Required fields are `name`, `title`, non-empty `scenarios`, scenario `id` and `title`, device `name`, and for every step: positive integer `number`, `action`, `expectation`, `screenshot` and `alt`. The report `name` uses lowercase kebab-case. Scenario IDs are unique lowercase kebab-case; step numbers start at one and remain sequential within each device.

Use stable scenario IDs and sequential filenames. Verify every screenshot has a PNG extension, PNG signature and non-zero dimensions. Capture all requested outputs from this one manifest; do not rerun the scenario separately per renderer.
