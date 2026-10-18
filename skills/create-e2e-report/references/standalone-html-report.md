# Local HTML report

Read when HTML is requested. Generate from existing evidence; do not launch the application again for formatting.

From the pinned E2E Manifest checkout:

```sh
npm run report -- --target /absolute/worktree/apps/web --run checkout-mobile
```

The [renderer](../../../scripts/report.ts) validates [run/evidence](../../../docs/evidence.md) before writing `runs/<run-id>/reports/run-<hash>.html`. It preserves case/step statuses, missing artifacts, limitations, profiles, attempts and source provenance. Invalid evidence aborts rendering. Existing reports are preserved; identical inputs reuse identical output. Artifact hashes participate in report content.

HTML has no external dependencies or JavaScript. Images and source JSON use relative links to immutable run originals, avoiding copied evidence and embedded image payloads. The report works locally while the run directory is retained; copying only the HTML does not package its resources. Any requested export must include the referenced run resources and follow the [publication policy](../../../docs/local-workflow.md).

Open the generated report in a real browser at desktop and narrow widths. Verify navigation, ordered steps, readable loaded images, keyboard focus, no network dependencies, correct statuses and absence of secrets. State separately whether file validation and browser inspection were performed.

For design comparison use [report:design](../../../docs/design-comparison.md#локальный-html) with an explicitly pinned Design Manifest checkout. It validates the owner schemas and original E2E references, preserves missing pairs and recorded verdicts, and writes comparison HTML into that review's reports directory. Apply the same browser inspection; rendering is not a new visual review.
