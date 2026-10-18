import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { hash } from '../scripts/evidence.ts';
import { validateAdaptation } from '../scripts/adaptation.ts';
const scratch = resolve('e2e/tmp'); mkdirSync(scratch, { recursive: true });
function fixture(action: (x: any) => void) {
  const root = mkdtempSync(resolve(scratch, 'adaptation-')), base = resolve(root, 'base'), target = resolve(root, 'app'), directory = resolve(base, 'workdir/project/web');
  for (const dir of ['docs', 'workdir/project/web/patches', 'workdir/project/web/resources']) mkdirSync(resolve(base, dir), { recursive: true });
  mkdirSync(resolve(target, 'e2e'), { recursive: true });
  writeFileSync(resolve(base, '.gitignore'), '/workdir/\n'); writeFileSync(resolve(base, 'docs/evidence.md'), '# Evidence\n\n## Проектные предпочтения\n');
  const git = (...args: string[]) => execFileSync('git', ['-c', 'core.hooksPath=/dev/null', '-c', 'commit.gpgsign=false', ...args], { cwd: base, encoding: 'utf8' }).trim();
  git('init', '-b', 'dev'); git('add', '.'); git('-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-m', 'base');
  const revision = git('rev-parse', 'HEAD');
  const manifest = { schema_version: 2, repository_id: 'app', target_id: 'web', base: { path: '../../..', revision }, modules: ['playwright'], patches: ['patches/mobile.json'] };
  const patch: any = { schema_version: 2, id: 'mobile', status: 'active', base_revision: revision, topic: 'workflow', scope: ['.'], target: 'docs/evidence.md#проектные-предпочтения', mode: 'override', decision_ref: 'User requested mobile first', reason: 'Prioritize mobile evidence', requirements: ['Capture mobile before desktop'], verification: ['Inspect capture ordering'], revision: 1, updated_at: '2026-10-01T00:00:00Z', review: { revision: 1, reviewed_at: '2026-10-02T00:00:00Z', review_due_at: '2026-11-01T00:00:00Z' }, resources: [], settings: { evidence_priority: 'mobile-first' } };
  const save = () => { writeFileSync(resolve(directory, 'manifest.json'), JSON.stringify(manifest)); writeFileSync(resolve(directory, 'patches/mobile.json'), JSON.stringify(patch)); };
  const check = () => { save(); return validateAdaptation(directory, base, target, 'e2e', new Date('2026-10-18T00:00:00Z')); };
  try { action({ base, target, directory, manifest, patch, check }); } finally { rmSync(root, { recursive: true, force: true }); }
}
test('external adaptation resolves reviewed preference in selected target', () => fixture(({ check }) => { const result = check(); assert.equal(result.settings.evidence_priority, 'mobile-first'); assert.equal(result.pending.length, 0); }));
test('reject incompatible format, unknown parameters and missing module', () => fixture(({ manifest, patch, check }) => {
  manifest.schema_version = 1; assert.throws(check, /constant/); manifest.schema_version = 2;
  patch.settings.disable_integrity = true; assert.throws(check, /additional properties/); delete patch.settings.disable_integrity;
  patch.target = 'stack/msw/http-runtime.md#commands'; assert.throws(check, /unselected stack/);
}));
test('review chronology dates and revisions are enforced', () => fixture(({ patch, check }) => {
  patch.review.reviewed_at = 'invalid'; assert.throws(check, /date-time/);
  patch.review.reviewed_at = '2026-10-02T00:00:00Z'; patch.review.review_due_at = '2026-10-03T00:00:00Z'; assert.throws(check, /stale/);
  patch.review.review_due_at = '2026-11-01T00:00:00Z'; patch.review.revision = 2; assert.throws(check, /revision mismatch/);
}));
test('proposed requirements remain pending, never effective', () => fixture(({ patch, check }) => {
  patch.status = 'proposed'; delete patch.review; const result = check(); assert.equal(result.pending.length, 1); assert.deepEqual(result.settings, {});
}));
test('resource bytes and scope confinement checked', () => fixture(({ directory, patch, check }) => {
  const file = resolve(directory, 'resources/note.md'); writeFileSync(file, 'verified');
  patch.resources = [{ id: 'note', path: 'resources/note.md', kind: 'rules', summary: 'Details', sha256: hash(file) }]; check();
  writeFileSync(file, 'changed'); assert.throws(check, /hash mismatch/);
  patch.resources = []; patch.scope = ['../base']; assert.throws(check);
}));
test('overlapping different settings conflict independent of order', () => fixture(({ directory, manifest, patch, check }) => {
  manifest.patches.push('patches/desktop.json'); writeFileSync(resolve(directory, 'patches/desktop.json'), JSON.stringify({ ...patch, id: 'desktop', settings: { evidence_priority: 'desktop-first' } })); assert.throws(check, /Conflicting setting/);
}));
test('generic override cannot disable base guarantees', () => fixture(({ base, patch, check }) => {
  patch.target = 'docs/evidence.md#evidence'; assert.throws(check, /Only typed/);
  patch.target = 'docs/evidence.md#проектные-предпочтения'; writeFileSync(resolve(base, 'untracked.txt'), 'local change'); assert.throws(check, /local changes/);
}));
