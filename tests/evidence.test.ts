import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, symlinkSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { hash } from '../scripts/evidence.ts';
import { fixture } from './helpers/evidence.ts';
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
