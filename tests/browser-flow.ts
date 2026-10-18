import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createServer } from 'node:http';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium, expect } from '@playwright/test';
import { hash, validateRun } from '../scripts/evidence.ts';
import { renderRun } from '../scripts/report.ts';

const args = process.argv.slice(2);
assert.ok(args.length === 0 || args.length === 3, 'Usage: [<fixture-target-root> <repository-id> <target-id>]');
const scratch = resolve('e2e/tmp'); mkdirSync(scratch, { recursive: true });
const root = args.length ? realpathSync(args[0]) : mkdtempSync(resolve(scratch, 'browser-flow-'));
const git = (...args: string[]) => execFileSync('git', ['-c', 'core.hooksPath=/dev/null', '-c', 'commit.gpgsign=false', ...args], { cwd: root, encoding: 'utf8' }).trim();
if (!args.length) {
  cpSync(resolve('tests/fixtures/ticket-app'), root, { recursive: true });
  writeFileSync(resolve(root, 'e2e/.gitignore'), '/tmp/\n');
  git('init', '-b', 'task/browser-flow'); git('add', '.'); git('-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-m', 'Isolated test application');
}
// This probe serves the synthetic ticket fixture only; it is not a product runner.
assert.equal(hash(resolve(root, 'index.html')), hash(resolve('tests/fixtures/ticket-app/index.html')), 'Expected isolated ticket fixture');
assert.ok(readFileSync(resolve(root, 'e2e/.gitignore'), 'utf8').split(/\r?\n/).includes('/tmp/'), 'Target must ignore /tmp/');
const worktree = realpathSync(git('rev-parse', '--show-toplevel'));
const initialStatus = git('status', '--porcelain');
const { TicketPage } = await import(pathToFileURL(resolve(root, 'e2e/ticket.pom.ts')).href);
const { reserveTicket } = await import(pathToFileURL(resolve(root, 'e2e/ticket.spec.ts')).href);
const runId = 'reserve-ticket';
const directory = resolve(root, `e2e/tmp/runs/${runId}`); mkdirSync(resolve(root, 'e2e/tmp/runs'), { recursive: true });
mkdirSync(directory); // Refuse to overwrite a previous run.
mkdirSync(resolve(directory, 'assets'));
const run: any = { schema_version: 1, run_id: runId, repository_id: args[1] ?? 'isolated-fixture', target_id: args[2] ?? 'ticket-app', worktree, target_path: relative(worktree, root).split('\\').join('/') || '.', revision: git('rev-parse', 'HEAD'), dirty: initialStatus !== '', started_at: new Date().toISOString(), finished_at: null, status: 'running', cases: [], limitations: ['Local client-only fixture; no external backend, SSR or design provider exercised.'] };
const evidence: any = { schema_version: 2, run_id: runId, items: [] };
const save = () => { writeFileSync(resolve(directory, 'run.json'), JSON.stringify(run, null, 2)); writeFileSync(resolve(directory, 'evidence.json'), JSON.stringify(evidence, null, 2)); };
save();
const server = createServer((req, res) => { if (req.url !== '/') { res.writeHead(404).end(); return; } res.setHeader('Content-Type', 'text/html'); res.end(readFileSync(resolve(root, 'index.html'))); });
await new Promise<void>(done => server.listen(0, '127.0.0.1', done));
const url = `http://127.0.0.1:${(server.address() as any).port}/`;
let browser;
try {
  browser = await chromium.launch();
  for (const [profile, viewport] of [['mobile', { width: 390, height: 844 }], ['desktop', { width: 1280, height: 800 }]] as const) {
    const context = await browser.newContext({ viewport, deviceScaleFactor: 1, locale: 'en-US', colorScheme: 'light' });
    const page = await context.newPage();
    const c: any = { id: `reserve-${profile}`, scenario_id: 'reserve-ticket', spec: { path: 'e2e/ticket.spec.ts', sha256: hash(resolve(root, 'e2e/ticket.spec.ts')) }, scenario: 'Reserve one concert ticket', profile, attempt: 1, status: 'running', steps: [] }; run.cases.push(c); save();
    try {
      await reserveTicket(new TicketPage(page), url, async (id: string, title: string, action: () => Promise<void>) => {
        const step = { id, title, status: 'running' }; c.steps.push(step); save();
        try {
          await action(); step.status = 'passed'; await page.evaluate(() => document.fonts.ready);
          const path = `assets/${profile}-${id}.png`; await page.screenshot({ path: resolve(directory, path), animations: 'disabled' });
          evidence.items.push({ id: `${profile}-${id}`, case_id: c.id, step_id: id, captured_at: new Date().toISOString(), kind: 'screenshot', path, sha256: hash(resolve(directory, path)), mime: 'image/png', description: title, conditions: { viewport, dpr: 1, theme: 'light', locale: 'en-US', state: id } });
        } catch (error) { step.status = 'failed'; throw error; } finally { save(); }
      }); c.status = 'passed';
    } catch (error) { c.status = 'failed'; throw error; } finally { await context.close(); save(); }
  }
  run.status = 'passed'; run.finished_at = new Date().toISOString(); save(); validateRun(root, runId);
  const report = renderRun(root, runId);
  const inspection = [];
  for (const width of [390, 1280]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } }); const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message)); page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
    await page.goto(pathToFileURL(report).href);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('reserve-ticket — passed');
    await page.locator('img').evaluateAll(async images => { await Promise.all(images.map(async image => { image.loading = 'eager'; await image.decode(); })); });
    assert.equal(await page.locator('img').count(), 6);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, 'Horizontal overflow');
    assert.deepEqual(errors, []);
    await page.keyboard.press('Tab'); assert.equal(await page.evaluate(() => document.activeElement?.tagName), 'A');
    const shot = resolve(directory, `reports/inspection-${width}.png`); await page.screenshot({ path: shot, fullPage: true });
    inspection.push({ width, images_loaded: 6, errors, screenshot: shot }); await page.close();
  }
  writeFileSync(resolve(directory, 'reports/browser-verification.json'), JSON.stringify({ browser: browser.version(), report, inspection }, null, 2));
  assert.equal(git('status', '--porcelain'), initialStatus, 'Capture must preserve source state');
  console.log(JSON.stringify({ root, report, browser: browser.version(), cases: run.cases.length, artifacts: evidence.items.length, inspection }, null, 2));
} catch (error) {
  if (run.status === 'running') { run.status = run.cases.some((c: any) => c.status === 'failed') ? 'failed' : 'interrupted'; run.finished_at = new Date().toISOString(); run.limitations.push(String(error)); save(); }
  throw error;
} finally { await browser?.close(); await new Promise<void>((done, reject) => server.close(e => e ? reject(e) : done())); }
