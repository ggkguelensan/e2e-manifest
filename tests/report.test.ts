import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fixture } from './helpers/evidence.ts';
import { renderRun } from '../scripts/report.ts';

test('report keeps interrupted status, missing evidence, provenance and escapes input', () => fixture(({ root, run, evidence, check }) => {
  run.status = 'interrupted'; run.cases[0].status = 'interrupted'; run.cases[0].steps[0].status = 'interrupted';
  run.cases[0].scenario = '<script>alert("x")</script>'; run.limitations = ['Browser stopped']; evidence.items = []; check();
  const file = renderRun(resolve(root, 'apps/web'), 'example'); const html = readFileSync(file, 'utf8');
  assert.match(html, /interrupted/); assert.match(html, /No evidence captured/); assert.match(html, /Browser stopped/);
  assert.match(html, /&lt;script&gt;/); assert.ok(!html.includes('<script>')); assert.match(html, /dirty: true/);
  assert.equal(renderRun(resolve(root, 'apps/web'), 'example'), file);
}));
test('report links validated originals and refuses corrupt input', () => fixture(({ root, artifact, check }) => {
  check(); const html = readFileSync(renderRun(resolve(root, 'apps/web'), 'example'), 'utf8');
  assert.match(html, /src="\.\.\/assets\/step.png"/); assert.match(html, /\.\.\/run.json/);
  writeFileSync(artifact, 'broken'); assert.throws(() => renderRun(resolve(root, 'apps/web'), 'example'), /hash mismatch/);
}));
test('report cannot write through escaped reports symlink', () => fixture(({ root, directory, check }) => {
  check(); const outside = resolve(root, 'other'); mkdirSync(outside); symlinkSync(outside, resolve(directory, 'reports'));
  assert.throws(() => renderRun(resolve(root, 'apps/web'), 'example'), /escapes root/);
}));
