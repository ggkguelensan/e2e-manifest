import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
const source = process.cwd();
const scratch = resolve(source, 'e2e/tmp');
mkdirSync(scratch, { recursive: true });
function fixture(branch: string, action: (root: string, git: (...args: string[]) => string) => void) {
  const root = mkdtempSync(resolve(scratch, 'setup-'));
  const git = (...args: string[]) => execFileSync('git', ['-c', 'core.hooksPath=/dev/null', ...args], { cwd: root, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
  try {
    mkdirSync(resolve(root, 'scripts')); copyFileSync(resolve(source, 'scripts/setup.ts'), resolve(root, 'scripts/setup.ts'));
    for (const id of ['playwright', 'msw']) { mkdirSync(resolve(root, `stack/${id}`), { recursive: true }); writeFileSync(resolve(root, `stack/${id}/README.md`), id); }
    copyFileSync(resolve(source, 'stack/catalog.json'), resolve(root, 'stack/catalog.json'));
    writeFileSync(resolve(root, 'stack/README.md'), 'catalog'); writeFileSync(resolve(root, '.gitignore'), '/workdir/\n');
    git('init', '-b', branch); git('config', 'user.name', 'Setup Test'); git('config', 'user.email', 'setup@example.invalid'); git('add', '.'); git('commit', '-m', 'fixture');
    action(root, git);
  } finally { rmSync(root, { recursive: true, force: true }); }
}
function setup(root: string, dev: string, stacks = '') {
  return spawnSync(process.execPath, ['scripts/setup.ts'], { cwd: root, encoding: 'utf8', env: { ...process.env, E2E_MANIFEST_DEV: dev, E2E_MANIFEST_STACKS: stacks } });
}
test('dev retains every module and preserves workdir data', () => fixture('dev', (root, git) => {
  mkdirSync(resolve(root, 'workdir')); writeFileSync(resolve(root, 'workdir/project.json'), 'keep');
  const result = setup(root, '1'); assert.equal(result.status, 0, result.stderr);
  assert.ok(existsSync(resolve(root, 'stack/msw/README.md')));
  assert.equal(readFileSync(resolve(root, 'workdir/project.json'), 'utf8'), 'keep'); assert.equal(git('status', '--porcelain'), '');
}));
test('main excludes unselected modules, stays clean, and restores on reselection', () => fixture('main', (root, git) => {
  let result = setup(root, '0', 'playwright'); assert.equal(result.status, 0, result.stderr);
  assert.ok(!existsSync(resolve(root, 'stack/msw/README.md'))); assert.ok(existsSync(resolve(root, 'stack/playwright/README.md'))); assert.equal(git('status', '--porcelain'), '');
  result = setup(root, '0', 'msw'); assert.equal(result.status, 0, result.stderr);
  assert.ok(existsSync(resolve(root, 'stack/msw/README.md'))); assert.ok(!existsSync(resolve(root, 'stack/playwright/README.md')));
  git('switch', '-c', 'dev'); result = setup(root, '1'); assert.equal(result.status, 0, result.stderr);
  assert.ok(existsSync(resolve(root, 'stack/playwright/README.md'))); assert.equal(git('status', '--porcelain'), '');
}));
test('branch, detached HEAD, missing selection and invalid values fail before removal', () => fixture('main', (root, git) => {
  for (const [dev, selection] of [['1', ''], ['0', ''], ['0', 'missing'], ['true', 'playwright'], ['0', '../msw']]) {
    const result = setup(root, dev, selection); assert.notEqual(result.status, 0); assert.ok(existsSync(resolve(root, 'stack/msw/README.md')));
  }
  git('checkout', '--detach'); assert.notEqual(setup(root, '0', 'playwright').status, 0);
}));
test('dirty tracked and untracked stack files are preserved', () => fixture('main', (root) => {
  const file = resolve(root, 'stack/msw/README.md'); writeFileSync(file, 'user edit');
  assert.notEqual(setup(root, '0', 'playwright').status, 0); assert.equal(readFileSync(file, 'utf8'), 'user edit');
}));
test('untracked content prevents pruning', () => fixture('main', (root) => {
  writeFileSync(resolve(root, 'stack/msw/local.md'), 'user content');
  assert.notEqual(setup(root, '0', 'playwright').status, 0); assert.ok(existsSync(resolve(root, 'stack/msw/local.md')));
}));
test('required module closure is retained', () => fixture('main', (root, git) => {
  const path = resolve(root, 'stack/catalog.json'); const catalog = JSON.parse(readFileSync(path, 'utf8')); catalog.modules.playwright.requires = ['msw']; writeFileSync(path, JSON.stringify(catalog)); git('add', '.'); git('commit', '-m', 'dependency');
  assert.equal(setup(root, '0', 'playwright').status, 0); assert.ok(existsSync(resolve(root, 'stack/msw/README.md')));
}));
test('ignored local stack files also prevent pruning', () => fixture('main', (root, git) => {
  writeFileSync(resolve(root, '.gitignore'), '/workdir/\n*.local\n'); git('add', '.gitignore'); git('commit', '-m', 'ignore local files');
  const local = resolve(root, 'stack/msw/notes.local'); writeFileSync(local, 'preserve');
  assert.notEqual(setup(root, '0', 'playwright').status, 0); assert.equal(readFileSync(local, 'utf8'), 'preserve');
}));
test('commit/push guard requires dev branch and development environment', () => fixture('main', (root, git) => {
  const guard = (flag: string) => spawnSync(process.execPath, [resolve(source, 'scripts/guard.ts')], { cwd: root, env: { ...process.env, E2E_MANIFEST_DEV: flag }, encoding: 'utf8' });
  assert.notEqual(guard('1').status, 0); git('switch', '-c', 'dev'); assert.notEqual(guard('0').status, 0); assert.equal(guard('1').status, 0);
}));
