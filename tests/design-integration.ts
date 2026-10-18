import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium, expect } from '@playwright/test';
import { validateRun } from '../scripts/evidence.ts';
import { renderDesign } from '../scripts/design-report.ts';
const [target, runId, design] = process.argv.slice(2);
if (!target || !runId || !design || process.argv.length !== 5) throw new Error('Usage: <target-root> <run-id> <design-checkout>');
const revision = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: design, encoding: 'utf8' }).trim();
const { run, evidence, directory } = validateRun(target, runId);
const reviewId = `integration-${Date.now()}`;
const root = resolve(target, `e2e/tmp/design-review/${reviewId}`); mkdirSync(resolve(root, 'assets'), { recursive: true });
const pairs = run.cases.map((c: any) => {
  const e = evidence.items.filter((e: any) => e.case_id === c.id).at(-1); assert.ok(e);
  const path = `assets/${e.id}.png`; copyFileSync(resolve(directory, e.path), resolve(root, path));
  return { id: c.id, reference_id: null, scope: `${c.scenario}; final UI`, ui: { repository: run.repository_id, revision: run.revision, local_changes: run.dirty, provenance: `runs/${runId}/evidence.json#${e.id}`, run_id: runId, spec: c.spec, step: e.step_id, profile: c.profile, attempt: c.attempt, captured_at: e.captured_at, viewport: e.conditions.viewport, dpr: e.conditions.dpr, theme: e.conditions.theme, locale: e.conditions.locale, state: e.conditions.state, artifact: { path, sha256: e.sha256, media_type: e.mime } }, status: 'inconclusive', findings: [], limitations: ['No independent design reference supplied; conformity not assessed.'], comparability: { assessed: false, checks: Object.fromEntries(['state','viewport','scale','theme','locale','content','scroll_crop','fonts','animations'].map(k => [k, 'unknown'])), notes: 'Only actual UI evidence is available.' } };
});
pairs.push({ id: 'missing-both', reference_id: null, scope: '<script>not executable</script>', ui: null, status: 'not-reviewed', findings: [], limitations: ['Neither source supplied for this requested state.'], comparability: { assessed: false, checks: Object.fromEntries(['state','viewport','scale','theme','locale','content','scroll_crop','fonts','animations'].map(k => [k, 'unknown'])), notes: 'No sources' } } as any);
const comparison = { schema_version: 2, comparison_id: reviewId, created_at: new Date().toISOString(), snapshot: null, pairs, limitations: ['Integration fixture checks incomplete reviews, not design conformity.'] };
const save = () => writeFileSync(resolve(root, 'comparison.json'), JSON.stringify(comparison, null, 2)); save();
const render = () => renderDesign(target, reviewId, design, revision);
const report = render();
assert.throws(() => renderDesign(target, reviewId, design, '0'.repeat(40)), /pin mismatch/);
const originalStep = pairs[0].ui.step; pairs[0].ui.step = 'wrong-step'; save(); assert.throws(render, /original run evidence/); pairs[0].ui.step = originalStep;
pairs[0].status = 'matched'; save(); assert.throws(render); pairs[0].status = 'inconclusive'; save(); assert.equal(render(), report);
assert.ok(!readFileSync(report, 'utf8').includes('<script>'));
const browser = await chromium.launch();
try {
  const checks = [];
  for (const width of [390, 1280]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } }); const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(pathToFileURL(report).href);
    await expect(page.getByRole('heading', { level: 2 })).toHaveCount(3);
    await page.locator('img').evaluateAll(async images => { await Promise.all(images.map(i => i.decode())); });
    assert.equal(await page.locator('img').count(), 2);
    await page.locator('details').evaluateAll(nodes => nodes.forEach(n => n.open = true));
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    assert.deepEqual(errors, []); await page.screenshot({ path: resolve(root, `reports/inspection-${width}.png`), fullPage: true });
    checks.push({ width, loaded_images: 2, pairs: 3, errors }); await page.close();
  }
  writeFileSync(resolve(root, 'reports/verification.json'), JSON.stringify({ revision, browser: browser.version(), checks }, null, 2));
  console.log(JSON.stringify({ report, reviewId, revision, checks }, null, 2));
} finally { await browser.close(); }
