import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium, expect } from '@playwright/test';
import { hash, validateRun } from '../scripts/evidence.ts';
import { renderDesign } from '../scripts/design-report.ts';
const [target, runId, design] = process.argv.slice(2);
if (!target || !runId || !design || process.argv.length !== 5) throw new Error('Usage: <target-root> <run-id> <design-checkout>');
const revision = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: design, encoding: 'utf8' }).trim();
assert.equal(execFileSync('git', ['status', '--porcelain'], { cwd: design, encoding: 'utf8' }).trim(), '');
const { run, evidence, directory } = validateRun(target, runId);
const reviewId = `reference-${Date.now()}`, root = resolve(target, `e2e/tmp/design-review/${reviewId}`);
mkdirSync(resolve(root, 'assets'), { recursive: true });
const source = resolve(design, 'tests/fixtures/reservation-reference.html');
copyFileSync(source, resolve(root, 'assets/reference-source.html'));
const browser = await chromium.launch();
const snapshot: any = { schema_version: 1, snapshot_id: reviewId, captured_at: '', source: { provider: 'local', instance_url: null, document_id: null, version: revision, provenance: `Synthetic independently authored design fixture tests/fixtures/reservation-reference.html; source SHA256 ${hash(source)}; Chromium ${browser.version()}; not a user design or Figma/Penpot export.` }, references: [], resources: [], limitations: ['Synthetic local source; real provider access not exercised.'] };
const pairs = [], measurements = [];
try {
  for (const c of run.cases) {
    const e = evidence.items.filter((e: any) => e.case_id === c.id && e.step_id === 'then-confirmed').at(-1); assert.ok(e, 'Fixture final step required');
    assert.match(c.profile, /^[a-zA-Z0-9_-]+$/, 'Safe fixture profile required');
    assert.equal(e.conditions.theme, 'light', 'Reference fixture supports light theme only');
    const page = await browser.newPage({ viewport: e.conditions.viewport, deviceScaleFactor: e.conditions.dpr, locale: e.conditions.locale, colorScheme: 'light' });
    await page.goto(pathToFileURL(resolve(root, 'assets/reference-source.html')).href);
    await page.evaluate(() => document.fonts.ready);
    await expect(page.getByRole('button')).toHaveText('Reserved'); await expect(page.getByRole('button')).toBeDisabled();
    const image = `assets/design-${c.profile}.png`; await page.screenshot({ path: resolve(root, image), animations: 'disabled' });
    measurements.push({ profile: c.profile, source: 'design', observed: await page.evaluate(() => ({ button: document.querySelector('button')?.textContent, viewport: { width: innerWidth, height: innerHeight }, dpr: devicePixelRatio, scroll: { x: scrollX, y: scrollY }, font: getComputedStyle(document.body).fontFamily, animations: document.getAnimations().length, fonts: document.fonts.status })) });
    const resourceId = `design-${c.profile}`, referenceId = `reference-${c.profile}`;
    snapshot.references.push({ id: referenceId, node_id: null, label: 'Reservation confirmed', export_scale: e.conditions.dpr, variant: null, viewport: e.conditions.viewport, theme: e.conditions.theme, locale: e.conditions.locale, state: e.conditions.state, resource_id: resourceId });
    snapshot.resources.push({ id: resourceId, role: 'reference', artifact: { path: image, sha256: hash(resolve(root, image)), media_type: 'image/png' }, source: `Local fixture ${revision}; assets/reference-source.html SHA256 ${hash(source)}`, distribution: 'allowed', parent_id: null, transform: null });
    const ui = `assets/ui-${c.profile}.png`; copyFileSync(resolve(directory, e.path), resolve(root, ui));
    pairs.push({ id: c.id, scope: 'Confirmed ticket reservation: button label and visible confirmation; not a pixel-perfect audit', reference_id: referenceId, ui: { repository: run.repository_id, revision: run.revision, local_changes: run.dirty, provenance: `runs/${runId}/evidence.json#${e.id}`, run_id: runId, spec: c.spec, step: e.step_id, profile: c.profile, attempt: c.attempt, captured_at: e.captured_at, viewport: e.conditions.viewport, dpr: e.conditions.dpr, theme: e.conditions.theme, locale: e.conditions.locale, state: e.conditions.state, artifact: { path: ui, sha256: e.sha256, media_type: e.mime } }, status: 'not-reviewed', findings: [], limitations: ['Original image pair is available; visual review still required.'], comparability: { assessed: false, checks: Object.fromEntries(['state','viewport','scale','theme','locale','content','scroll_crop','fonts','animations'].map(k => [k, 'unknown'])), notes: 'Reference export measured; UI comparability must be reviewed against original capture.' } });
    await page.close();
  }
  snapshot.captured_at = new Date().toISOString(); writeFileSync(resolve(root, 'snapshot.json'), JSON.stringify(snapshot, null, 2));
  const request = { schema_version: 1, review_id: reviewId, requested_at: new Date().toISOString(), pairs: pairs.map(p => ({ id: p.id, scope: p.scope })) };
  writeFileSync(resolve(root, 'request.json'), JSON.stringify(request, null, 2));
  const comparison = { schema_version: 3, request: { path: 'request.json', sha256: hash(resolve(root, 'request.json')) }, comparison_id: reviewId, created_at: new Date().toISOString(), snapshot: { path: 'snapshot.json', sha256: hash(resolve(root, 'snapshot.json')) }, pairs, limitations: ['Fixture source is synthetic; no provider API or product design changes.'] };
  writeFileSync(resolve(root, 'comparison.json'), JSON.stringify(comparison, null, 2));
  mkdirSync(resolve(root, 'diagnostics'));
  writeFileSync(resolve(root, 'diagnostics/reference-export.json'), JSON.stringify({ reference_export_measurements: measurements }, null, 2));
  const report = renderDesign(target, reviewId, design, revision);
  console.log(JSON.stringify({ root, reviewId, revision, report, status: 'not-reviewed', next: 'Inspect original pairs, record comparability and findings, validate and regenerate report; never auto-promote draft to matched.' }, null, 2));
} finally { await browser.close(); }
