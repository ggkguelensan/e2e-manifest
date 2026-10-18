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
const installation = (root: string) => JSON.parse(readFileSync(resolve(root, 'workdir/installation.json'), 'utf8'));
test('development task branch retains modules and preserves adaptation', () => fixture('task/setup', (root, git) => {
  mkdirSync(resolve(root, 'workdir')); writeFileSync(resolve(root, 'workdir/project.json'), 'keep');
  const result = setup(root, '1'); assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(installation(root).modules, ['playwright', 'msw']);
  assert.equal(readFileSync(resolve(root, 'workdir/project.json'), 'utf8'), 'keep'); assert.equal(git('status', '--porcelain'), '');
}));
test('consumer selection never removes modules and works detached', () => fixture('release/fixture', (root, git) => {
  git('checkout', '--detach');
  const result = setup(root, '0', 'playwright'); assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(installation(root).modules, ['playwright']);
  assert.ok(existsSync(resolve(root, 'stack/msw/README.md'))); assert.equal(git('status', '--porcelain'), '');
  assert.equal(installation(root).base_revision, git('rev-parse', 'HEAD'));
}));
test('no selection succeeds without deleting files; invalid input preserves previous receipt', () => fixture('main', (root) => {
  assert.equal(setup(root, '0').status, 0); assert.deepEqual(installation(root).modules, []);
  const receipt = readFileSync(resolve(root, 'workdir/installation.json'), 'utf8');
  for (const [dev, stacks] of [['0', 'missing'], ['true', 'playwright'], ['0', '../msw'], ['0', 'playwright,']]) {
    assert.notEqual(setup(root, dev, stacks).status, 0);
    assert.equal(readFileSync(resolve(root, 'workdir/installation.json'), 'utf8'), receipt);
  }
  assert.ok(existsSync(resolve(root, 'stack/msw/README.md')));
}));
test('tracked, untracked and ignored user files survive reselection', () => fixture('main', (root, git) => {
  writeFileSync(resolve(root, '.gitignore'), '/workdir/\n*.local\n'); git('add', '.gitignore'); git('commit', '-m', 'ignore');
  const files = ['stack/msw/README.md', 'stack/msw/custom.md', 'stack/msw/notes.local'];
  for (const file of files) writeFileSync(resolve(root, file), 'user content');
  const before = git('status', '--porcelain');
  for (const stacks of ['playwright', 'msw', '']) {
    assert.equal(setup(root, '0', stacks).status, 0);
    for (const file of files) assert.equal(readFileSync(resolve(root, file), 'utf8'), 'user content');
    assert.equal(git('status', '--porcelain'), before);
  }
}));
test('dependencies require explicit selection, never silent capability expansion', () => fixture('main', (root) => {
  const path = resolve(root, 'stack/catalog.json'); const catalog = JSON.parse(readFileSync(path, 'utf8'));
  catalog.modules.playwright.requires = ['msw']; writeFileSync(path, JSON.stringify(catalog));
  assert.match(setup(root, '0', 'playwright').stderr, /Select required module msw/);
  assert.equal(setup(root, '0', 'playwright,msw').status, 0);
  catalog.modules.playwright.requires = ['unknown']; writeFileSync(path, JSON.stringify(catalog));
  assert.match(setup(root, '1').stderr, /Unknown module dependency/);
}));
test('setup does not alter existing sparse checkout configuration', () => fixture('main', (root, git) => {
  git('sparse-checkout', 'set', '--no-cone', '/*', '!/stack/msw/');
  assert.ok(!existsSync(resolve(root, 'stack/msw/README.md')));
  assert.equal(setup(root, '1').status, 0);
  assert.ok(!existsSync(resolve(root, 'stack/msw/README.md')));
  assert.equal(git('config', '--get', 'core.sparseCheckout'), 'true');
}));
test('guard checks explicit development mode on task branches', () => fixture('task/change', (root) => {
  const guard = (flag: string) => spawnSync(process.execPath, [resolve(source, 'scripts/guard.ts')], { cwd: root, env: { ...process.env, E2E_MANIFEST_DEV: flag }, encoding: 'utf8' });
  assert.notEqual(guard('0').status, 0); assert.equal(guard('1').status, 0);
}));
