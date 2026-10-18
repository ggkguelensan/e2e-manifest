import Ajv from 'ajv/dist/2020.js';
import assert from 'node:assert/strict';
import { existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, realpathSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { hash, localFile, validateRun } from './evidence.ts';

const validate = new Ajv({strict:true,allErrors:true}).compile(JSON.parse(readFileSync(new URL('../schemas/index.schema.json',import.meta.url),'utf8')));
function present(path: string) { try { lstatSync(path); return true; } catch (e: any) { if(e.code === 'ENOENT') return false; throw e; } }
function directory(path: string) {
  const stat = lstatSync(path);
  assert.ok(!stat.isSymbolicLink() && stat.isDirectory(), 'Index directory must be a physical directory');
}
function tmpPath(target: string, create: boolean) {
  let path = realpathSync(target);
  for (const segment of ['e2e','tmp']) {
    path = resolve(path, segment);
    if (!existsSync(path)) {
      try { lstatSync(path); throw new Error('Dangling index directory symlink'); } catch (error: any) { if (error.code !== 'ENOENT') throw error; }
      if (!create) return null;
      mkdirSync(path);
    }
    directory(path);
  }
  return path;
}
export function buildIndex(target: string) {
  target = realpathSync(target);
  const tmp = tmpPath(target, false);
  const entries = [];
  if (tmp && present(resolve(tmp, 'runs'))) {
    const runs = resolve(tmp, 'runs'); directory(runs);
    for (const entry of readdirSync(runs, { withFileTypes: true }).sort((a,b)=>a.name.localeCompare(b.name))) {
      assert.ok(entry.isDirectory() && !entry.isSymbolicLink(), 'Unexpected entry in runs directory');
      const runFile = localFile(target, `e2e/tmp/runs/${entry.name}/run.json`), evidenceFile = localFile(target, `e2e/tmp/runs/${entry.name}/evidence.json`);
      const before = [hash(runFile), hash(evidenceFile)];
      validateRun(target, entry.name);
      assert.deepEqual([hash(runFile),hash(evidenceFile)], before, 'Run changed during indexing; retry after capture');
      entries.push({ run_id: entry.name, run: { path: `runs/${entry.name}/run.json`, sha256: before[0] }, evidence: { path: `runs/${entry.name}/evidence.json`, sha256: before[1] } });
    }
  }
  return { schema_version: 1, generated_by: 'e2e-manifest:index', target_root: target, runs: entries };
}
export function writeIndex(target: string) {
  const data = buildIndex(target), tmp = tmpPath(target, true)!;
  const output = resolve(tmp, 'index.json');
  try {
    assert.ok(lstatSync(output).isFile() && !lstatSync(output).isSymbolicLink(), 'Index output must be a regular file');
    const old = JSON.parse(readFileSync(output, 'utf8'));
    assert.ok(validate(old), 'Existing index is not an owned compatible derived index');
  } catch(error: any) { if (error.code !== 'ENOENT') throw error; }
  const staging = resolve(tmp, `.index-${randomUUID()}.json`);
  try { writeFileSync(staging, JSON.stringify(data,null,2)+'\n', {flag:'wx'}); renameSync(staging, output); }
  finally { rmSync(staging, {force:true}); }
  return output;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const [target, mode, ...extra] = process.argv.slice(2);
    assert.ok(target && !extra.length && (!mode || mode === '--write'), 'Usage: <target-root> [--write]');
    console.log(mode ? writeIndex(target) : JSON.stringify(buildIndex(target), null, 2));
  } catch(error) { console.error(error instanceof Error ? error.message : error); process.exitCode=1; }
}
