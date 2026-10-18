import { readFileSync, realpathSync, statSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import Ajv from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ajv = new Ajv({ allErrors: true, strict: true });
addFormats(ajv);
const validators = Object.fromEntries(['run', 'evidence'].map(name => [name, ajv.compile(JSON.parse(readFileSync(resolve(root, `schemas/${name}.schema.json`), 'utf8')))]));
export const hash = (file: string) => createHash('sha256').update(readFileSync(file)).digest('hex');
function assert(ok: unknown, message: string): asserts ok { if (!ok) throw new Error(message); }
export function localFile(root: string, path: string): string {
  assert(path && !isAbsolute(path) && !path.includes('\\') && !path.includes(':') && !path.split('/').includes('..'), `Unsafe path: ${path}`);
  const base = realpathSync(root), file = realpathSync(resolve(base, path)), rel = relative(base, file);
  assert(rel !== '..' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel), `Path escapes root: ${path}`);
  return file;
}
function unique(values: string[], label: string) { assert(new Set(values).size === values.length, `Duplicate ${label}`); }
function read(name: string, path: string): any {
  const value = JSON.parse(readFileSync(path, 'utf8'));
  assert(validators[name](value), `${name}: ${ajv.errorsText(validators[name].errors)}`);
  return value;
}
/** Validate saved data, not a claim that the current branch still matches its source. */
export function validateRun(targetRoot: string, runId: string) {
  assert(/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(runId), 'Invalid run ID');
  const target = realpathSync(targetRoot);
  const directory = localFile(target, `e2e/tmp/runs/${runId}`);
  const run = read('run', localFile(directory, 'run.json'));
  const evidence = read('evidence', localFile(directory, 'evidence.json'));
  assert(run.run_id === runId && evidence.run_id === runId, 'Run ID mismatch');
  const git = (...args: string[]) => execFileSync('git', args, { cwd: target, encoding: 'utf8' }).trim();
  const worktree = realpathSync(git('rev-parse', '--show-toplevel'));
  assert(realpathSync(run.worktree) === worktree, 'Evidence belongs to a different worktree');
  assert(localFile(worktree, run.target_path) === target, 'Evidence belongs to a different target');
  const start = Date.parse(run.started_at), end = run.finished_at === null ? null : Date.parse(run.finished_at);
  assert(end === null || end >= start, 'Run finishes before it starts');
  assert((run.status === 'running') === (end === null), 'Running/finished timestamp conflict');
  unique(run.cases.map((c: any) => c.id), 'case ID');
  unique(run.cases.map((c: any) => JSON.stringify([c.scenario_id, c.profile, c.attempt])), 'case attempt');
  const cases = new Map<string, any>();
  for (const c of run.cases) {
    unique(c.steps.map((s: any) => s.id), 'step ID');
    if (c.status === 'passed') assert(c.steps.length > 0 && c.steps.every((s: any) => s.status === 'passed'), 'Passed case has incomplete steps');
    if (run.status !== 'running') assert(c.status !== 'running' && c.steps.every((s: any) => s.status !== 'running'), 'Finished run contains running work');
    if (c.status === 'skipped') assert(c.steps.every((s: any) => s.status === 'skipped'), 'Skipped case contains executed steps');
    if (c.status === 'failed') assert(c.steps.some((s: any) => s.status === 'failed'), 'Failed case needs failed step');
    cases.set(c.id, c);
  }
  if (run.status === 'passed') assert(run.cases.length > 0 && run.cases.every((c: any) => c.status === 'passed' || c.status === 'skipped') && run.cases.some((c: any) => c.status === 'passed'), 'Passed run has no success or unfinished/failed cases');
  if (run.status === 'failed') assert(run.cases.some((c: any) => c.status === 'failed'), 'Failed run needs failed case');
  if (run.status === 'skipped') assert(run.cases.every((c: any) => c.status === 'skipped'), 'Skipped run has executed cases');
  unique(evidence.items.map((e: any) => e.id), 'evidence ID');
  unique(evidence.items.map((e: any) => e.path), 'artifact path');
  for (const item of evidence.items) {
    const c = cases.get(item.case_id);
    assert(c && c.steps.some((s: any) => s.id === item.step_id), 'Unknown evidence case/step');
    const captured = Date.parse(item.captured_at);
    assert(captured >= start && (end === null || captured <= end), 'Capture outside run interval');
    assert(item.path.startsWith('assets/') || item.path.startsWith('diagnostics/'), 'Artifact outside assets/diagnostics');
    const file = localFile(directory, item.path);
    assert(statSync(file).isFile() && hash(file) === item.sha256, 'Artifact missing or hash mismatch');
    if (item.kind === 'screenshot') {
      const data = readFileSync(file);
      const png = data.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
      const jpeg = data[0] === 255 && data[1] === 216 && data[2] === 255;
      assert((item.mime === 'image/png' && png) || (item.mime === 'image/jpeg' && jpeg), 'Screenshot MIME/signature mismatch');
    }
  }
  return { run, evidence, directory };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2);
    assert(args.length === 4 && args[0] === '--target' && args[2] === '--run', 'Usage: --target <target-root> --run <run-id>');
    const { run, evidence } = validateRun(args[1], args[3]);
    console.log(`Validated ${run.run_id}: ${run.status}; ${evidence.items.length} artifacts. Saved source hashes are provenance, not verification of current source.`);
  } catch (error) { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; }
}
