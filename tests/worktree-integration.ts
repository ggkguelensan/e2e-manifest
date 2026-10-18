import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, relative, resolve, sep } from 'node:path';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { chromium } from '@playwright/test';
import { validateRun } from '../scripts/evidence.ts';

const [projectBase, designBase] = process.argv.slice(2);
assert.ok(projectBase && [3,4].includes(process.argv.length), 'Usage: <project-manifest-checkout> [design-manifest-checkout]');
const gitAt = (cwd: string, ...args: string[]) => execFileSync('git', ['-c', 'core.hooksPath=/dev/null', '-c', 'commit.gpgsign=false', ...args], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
assert.equal(gitAt(projectBase, 'status', '--porcelain'), '', 'Use a clean Project checkout');
if (designBase) assert.equal(gitAt(designBase, 'status', '--porcelain'), '', 'Use a clean Design checkout');
const e2eBase = resolve('.');
assert.equal(gitAt(e2eBase, 'status', '--porcelain'), '', 'Use a clean E2E checkout for pinned adaptation');
const e2eRevision = gitAt(e2eBase, 'rev-parse', 'HEAD');
const projectRevision = gitAt(projectBase, 'rev-parse', 'HEAD');
const { inspectPi } = await import(pathToFileURL(resolve(projectBase, 'tests/helpers/pi-discovery.ts')).href);
const { validateConnections } = await import(pathToFileURL(resolve(projectBase, 'scripts/connections.ts')).href);
const { readProject, planTask } = await import(pathToFileURL(resolve(projectBase, 'scripts/project.ts')).href);
mkdirSync('e2e/tmp', { recursive: true });
const root = mkdtempSync(resolve('e2e/tmp/worktree-integration-'));
const repo = resolve(root, 'repositories/frontend');
mkdirSync(resolve(repo, 'apps'), { recursive: true });
cpSync('tests/fixtures/ticket-app', resolve(repo, 'apps/ticket'), { recursive: true });
writeFileSync(resolve(repo, 'apps/ticket/e2e/.gitignore'), '/tmp/\n');
gitAt(repo, 'init', '-b', 'dev'); gitAt(repo, 'add', '.');
gitAt(repo, '-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-m', 'Nested fixture application');
const worktree = resolve(root, 'worktrees/task');
gitAt(repo, 'worktree', 'add', '-b', 'task/verify', worktree);
// Registry paths are relative to their common project container, never to Git metadata.
let projectRoot = root;
const bases = [e2eBase, resolve(projectBase), ...(designBase ? [resolve(designBase)] : [])];
while (bases.some(base => { const path = relative(projectRoot, base); return path === '..' || path.startsWith(`..${sep}`); })) projectRoot = dirname(projectRoot);
assert.notEqual(projectRoot, dirname(projectRoot), 'Checkouts must share a project container below filesystem root');
const adaptations: Record<string, string> = {};
const e2eDirectory = resolve(e2eBase, 'workdir', basename(root));
mkdirSync(dirname(e2eDirectory), { recursive: true });
mkdirSync(e2eDirectory); // Unique fixture; never overwrite an existing adaptation.
writeFileSync(resolve(e2eDirectory, 'manifest.json'), JSON.stringify({ schema_version: 2, base: { path: relative(e2eDirectory, e2eBase), revision: e2eRevision }, repository_id: 'frontend', target_id: 'ticket', modules: ['playwright'], patches: [] }, null, 2));
adaptations.e2e = relative(projectRoot, e2eDirectory);
const manifests = [{ id: 'e2e', path: relative(projectRoot, e2eBase), revision: e2eRevision }];
if (designBase) {
  const directory = resolve(designBase, 'workdir', basename(root));
  mkdirSync(dirname(directory), { recursive: true });
  mkdirSync(directory); mkdirSync(resolve(directory, 'resources'));
  const source = `Independent synthetic local reference: ${resolve(designBase, 'tests/fixtures/reservation-reference.html')}. Collect into target e2e/tmp; no permission to modify a design or application.\n`;
  writeFileSync(resolve(directory, 'resources/source.md'), source);
  const revision = gitAt(designBase, 'rev-parse', 'HEAD');
  writeFileSync(resolve(directory, 'manifest.json'), JSON.stringify({ schema_version: 2, base_revision: revision, repository_id: 'frontend', target_id: 'ticket', modules: ['local'], sources: [{ id: 'reservation-reference', module: 'local', resource: { path: 'resources/source.md', sha256: createHash('sha256').update(source).digest('hex') } }], patches: [] }, null, 2));
  adaptations.design = relative(projectRoot, directory);
  manifests.push({ id: 'design', path: relative(projectRoot, resolve(designBase)), revision });
}
const definition = { schema_version: 1, project_id: 'integration', repositories: [{ id: 'frontend', path: relative(projectRoot, repo), references: [], development: 'dev', release: { kind: 'fixed', name: 'main' } }], targets: [{ id: 'ticket', repository_id: 'frontend', path: 'apps/ticket', manifests: manifests.map(m => m.id) }], tools: { worktrunk: { enabled: false, required_for_tasks: false, config: null }, graphify: { enabled: false, procedure: null } }, manifests };
const definitionPath = resolve(root, 'project.json');
writeFileSync(definitionPath, JSON.stringify(definition, null, 2));
const project = readProject(definitionPath, projectRoot);
const task = { target: 'ticket', worktree: relative(projectRoot, worktree), purpose: 'development' as const };
const connections = validateConnections(definitionPath, projectRoot, task, adaptations);
const selection = connections.selection;
assert.deepEqual(Object.keys(connections.domains), manifests.map(m => m.id));
assert.throws(() => planTask(project, projectRoot, { ...task, worktree: relative(projectRoot, repo) }), /main working clone/);
const capture = () => execFileSync(process.execPath, ['tests/browser-flow.ts', selection.target_root, selection.repository_id, selection.target_id], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
const selectedSkills = [
  { name: 'visualize-playwright-flows', path: resolve('skills/visualize-playwright-flows') },
  { name: 'create-e2e-report', path: resolve('skills/create-e2e-report') },
];
const context = await inspectPi(selection.target_root, selectedSkills);
capture();
const { run } = validateRun(selection.target_root, 'reserve-ticket');
assert.equal(run.worktree, selection.worktree);
assert.equal(run.target_path, 'apps/ticket');
assert.equal(run.repository_id, selection.repository_id);
assert.equal(run.target_id, selection.target_id);
assert.equal(run.revision, selection.revision);
assert.equal(run.status, 'passed');
const runFile = resolve(selection.target_root, 'e2e/tmp/runs/reserve-ticket/run.json');
const before = readFileSync(runFile, 'utf8');
assert.throws(capture, /EEXIST/);
assert.equal(readFileSync(runFile, 'utf8'), before);
const secondWorktree = resolve(root, 'worktrees/second');
gitAt(repo, 'worktree', 'add', '-b', 'task/second', secondWorktree);
const second = planTask(project, projectRoot, { ...task, worktree: relative(projectRoot, secondWorktree) });
execFileSync(process.execPath, ['tests/browser-flow.ts', second.target_root, second.repository_id, second.target_id], { stdio: 'pipe' });
const secondRun = validateRun(second.target_root, 'reserve-ticket').run;
assert.equal(secondRun.worktree, secondWorktree);
assert.notEqual(secondRun.worktree, run.worktree);
assert.equal(readFileSync(runFile, 'utf8'), before, 'Second worktree must preserve first evidence');
assert.equal(gitAt(secondWorktree, 'status', '--porcelain'), '');
assert.equal(gitAt(repo, 'status', '--porcelain'), '');
assert.equal(gitAt(worktree, 'status', '--porcelain'), '');
let designReview = null;
if (designBase) {
  const designContext = await inspectPi(selection.target_root, [
    { name: 'compare-ui-with-design', path: resolve(designBase, 'skills/compare-ui-with-design') },
    { name: 'create-e2e-report', path: resolve('skills/create-e2e-report') },
  ]);
  const exported = JSON.parse(execFileSync(process.execPath, ['tests/reference-comparison.ts', selection.target_root, 'reserve-ticket', designBase], { encoding: 'utf8', stdio: 'pipe' }));
  assert.equal(exported.revision, gitAt(designBase, 'rev-parse', 'HEAD'));
  const comparison = JSON.parse(readFileSync(resolve(exported.root, 'comparison.json'), 'utf8'));
  assert.equal(comparison.pairs.length, run.cases.length);
  assert.ok(comparison.pairs.every((pair: any) => pair.status === 'not-reviewed' && pair.ui.run_id === 'reserve-ticket'));
  const browser = await chromium.launch(); const checks = [];
  try {
    for (const width of [390, 1280]) {
      const page = await browser.newPage({ viewport: { width, height: 900 } }); const errors: string[] = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(pathToFileURL(exported.report).href);
      await page.locator('img').evaluateAll(async images => { for (const image of images) { image.loading = 'eager'; await image.decode(); } });
      assert.equal(await page.locator('img').count(), run.cases.length * 2);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      assert.deepEqual(errors, []); checks.push({ width, loaded_images: run.cases.length * 2, errors });
      await page.close();
    }
  } finally { await browser.close(); }
  designReview = { ...exported, context: designContext, report_checks: checks, assessment: 'Draft only; original image review required before findings or conclusive verdict.' };
}
assert.equal(gitAt(worktree, 'status', '--porcelain'), '');
assert.deepEqual(validateConnections(definitionPath, projectRoot, task, adaptations).selection, selection);
const proof = { project_root: projectRoot, project_definition: definitionPath, adaptations, connections, project_revision: projectRevision, selection, context, design_review: designReview, checks: ['registered pinned bases and permanent adaptations validated before capture and after reporting', 'native Pi command discovery equals selected real capture/report skills', 'main clone rejected', 'nested target captured', 'run identity matches selection', 'existing run preserved', 'same run ID isolated in second worktree', 'source checkout and worktree unchanged'], limitations: ['Pi command discovery checked without model calls; full prompt and skill execution not tested. Context files disabled for diagnostic. Worktrunk creation not exercised.'] };
writeFileSync(resolve(selection.target_root, 'e2e/tmp/worktree-verification.json'), JSON.stringify(proof, null, 2));
console.log(JSON.stringify({ root, ...proof }, null, 2));
