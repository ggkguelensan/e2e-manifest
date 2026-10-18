# Local HTML report

Read when HTML is requested. Generate from existing evidence; do not launch the application again for formatting.

From the pinned E2E Manifest checkout:

```sh
npm run report -- --target /absolute/worktree/apps/web --run checkout-mobile
```

The [renderer](../../../scripts/report.ts) validates [run/evidence](../../../docs/evidence.md) before writing `runs/<run-id>/reports/run-<hash>.html`. It preserves case/step statuses, missing artifacts, limitations, profiles, attempts and source provenance. Invalid evidence aborts rendering. Existing reports are preserved; identical inputs reuse identical output. Artifact hashes participate in report content.

HTML has no external dependencies or JavaScript. Images and source JSON use relative links to immutable run originals, avoiding copied evidence and embedded image payloads. The report works locally while the run directory is retained; copying only the HTML does not package its resources. Any requested export must include the referenced run resources and follow the [publication policy](../../../docs/local-workflow.md).

Open the generated report in a real browser at desktop and narrow widths. Verify navigation, ordered steps, readable loaded images, keyboard focus, no network dependencies, correct statuses and absence of secrets. State separately whether file validation and browser inspection were performed.

The current command renders functional run evidence. Design comparison needs the pinned Design Manifest validator and comparison-aware rendering; do not present its absence as a completed design review. A manually prepared comparison report must preserve all pairs and limitations, validate its source JSON, escape text and keep original image provenance. The coordinated renderer integration is still pending.
