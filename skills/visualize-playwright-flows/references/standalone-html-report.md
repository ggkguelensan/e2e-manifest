# Standalone HTML report

## Output

Generate a local static report directory. Do not commit it unless the user explicitly requests repository artifacts.

The report must work without an application server, backend or external CDN. Keep screenshots as relative assets rather than base64 by default so the report remains inspectable and reasonably sized.

Resolve the script path relative to this skill directory, not the application repository. Run it in an environment with Node.js and `tsx` available (`pnpm exec tsx` uses the project dependency):

```sh
pnpm exec tsx /absolute/path/to/visualize-playwright-flows/scripts/render-flow-report.ts \
  --manifest /absolute/path/to/flow-evidence.json \
  --output /absolute/path/to/playwright-flow-report
```

Alternatively, Node.js 22.18+ can run this script directly with `node /absolute/path/to/visualize-playwright-flows/scripts/render-flow-report.ts --manifest <manifest.json> --output <directory>`; the renderer uses only Node.js built-ins. It renders existing evidence and does not launch Playwright or capture screenshots.

The generated report is named `<playwright-visualization-name>.<file-hash>.html`. The visualization name comes from `manifest.name`. The 12-character SHA-256 prefix is calculated from the final HTML; screenshot content hashes are included in asset names, so changed visual evidence also changes the report hash.

Use `--force` only after resolving the exact generated report path and confirming it is the report that should be replaced.

## Verification

Open the generated `<playwright-visualization-name>.<file-hash>.html` in a real browser and inspect at desktop and narrow mobile widths. Verify:

- scenario/device navigation follows the manifest;
- all steps and expectations are present in order;
- every screenshot loads and remains readable;
- keyboard focus and headings provide usable navigation;
- no content depends on network access;
- the report contains no secrets or real personal data.

Return the absolute path to the generated HTML file and state whether the report was generated as temporary output or a requested repository artifact.
