import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { hash, validateRun } from '../scripts/evidence.ts';

const scratch = resolve('e2e/tmp'); mkdirSync(scratch, { recursive: true });
function fixture(action: (x: any) => void) {
  const root = mkdtempSync(resolve(scratch, 'evidence-'));
  try {
    execFileSync('git', ['init', '-q', root]);
    const directory = resolve(root, 'apps/web/e2e/tmp/runs/example');
    mkdirSync(resolve(directory, 'assets'), { recursive: true });
    const artifact = resolve(directory, 'assets/step.png');
    writeFileSync(artifact, Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2D4sAAAAASUVORK5CYII=', 'base64'));
    const run = { schema_version: 1, run_id: 'example', repository_id: 'fixture', target_id: 'web', worktree: root, target_path: 'apps/web', revision: 'a'.repeat(40), dirty: true, started_at: '2026-10-18T10:00:00Z', finished_at: '2026-10-18T10:00:02Z', status: 'passed', cases: [{ id: 'case-one', scenario_id: 'show-result', spec: { path: 'e2e/example.spec.ts', sha256: 'b'.repeat(64) }, scenario: 'show result', profile: 'mobile', attempt: 1, status: 'passed', steps: [{ id: 'result', title: 'Then result is visible', status: 'passed' }] }], limitations: [] };
    const evidence = { schema_version: 1, run_id: 'example', items: [{ id: 'result-image', case_id: 'case-one', step_id: 'result', captured_at: '2026-10-18T10:00:01Z', kind: 'screenshot', path: 'assets/step.png', sha256: hash(artifact), mime: 'image/png', description: 'Result after action', conditions: { viewport: { width: 390, height: 844 }, dpr: 1, theme: 'light', locale: 'ru', state: 'result' } }] };
    const save = () => { writeFileSync(resolve(directory, 'run.json'), JSON.stringify(run)); writeFileSync(resolve(directory, 'evidence.json'), JSON.stringify(evidence)); };
    const check = () => { save(); return validateRun(resolve(root, 'apps/web'), 'example'); };
    action({ root, directory, artifact, run, evidence, check });
  } finally { rmSync(root, { recursive: true, force: true }); }
}
test('saved run and artifacts validate independently of current source', () => fixture(({ check }) => assert.equal(check().run.status, 'passed')));
test('reject unknown fields/version and invalid date', () => fixture(({ run, check }) => {
  run.extra = true; assert.throws(check, /additional properties/); delete run.extra;
  run.schema_version = 2; assert.throws(check, /constant/); run.schema_version = 1;
  run.started_at = 'not-a-date'; assert.throws(check, /date-time/);
}));
test('case/step identity and attempts are unambiguous', () => fixture(({ run, evidence, check }) => {
  evidence.items[0].step_id = 'missing'; assert.throws(check, /Unknown evidence/); evidence.items[0].step_id = 'result';
  run.cases.push({ ...run.cases[0], id: 'other' }); assert.throws(check, /Duplicate case attempt/);
}));
test('passed cannot conceal interruption or running work', () => fixture(({ run, check }) => {
  run.cases[0].steps[0].status = 'interrupted'; assert.throws(check, /incomplete steps/);
  run.cases[0].status = 'interrupted'; assert.throws(check, /unfinished/);
  run.status = 'interrupted'; assert.equal(check().run.status, 'interrupted');
  run.cases[0].steps[0].status = 'running'; assert.throws(check, /running work/);
}));
test('running requires open interval and capture chronology is checked', () => fixture(({ run, evidence, check }) => {
  run.finished_at = null; assert.throws(check, /timestamp conflict/);
  run.status = 'running'; assert.equal(check().run.status, 'running');
  evidence.items[0].captured_at = '2026-10-18T09:00:00Z'; assert.throws(check, /outside run interval/);
}));
test('hash and screenshot signature checked separately', () => fixture(({ artifact, evidence, check }) => {
  writeFileSync(artifact, 'not an image'); assert.throws(check, /hash mismatch/);
  evidence.items[0].sha256 = hash(artifact); assert.throws(check, /signature mismatch/);
}));
test('artifact symlink cannot escape run directory', () => fixture(({ root, directory, evidence, check }) => {
  writeFileSync(resolve(root, 'outside.png'), 'outside');
  symlinkSync(resolve(root, 'outside.png'), resolve(directory, 'assets/escape.png'));
  evidence.items[0].path = 'assets/escape.png'; assert.throws(check, /escapes root/);
}));
test('different target/worktree cannot claim run provenance', () => fixture(({ root, run, check }) => {
  mkdirSync(resolve(root, 'other')); run.worktree = resolve(root, 'other'); assert.throws(check, /different worktree/);
  run.worktree = root; run.target_path = 'other'; assert.throws(check, /different target/);
}));
