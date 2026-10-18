import { existsSync, lstatSync, readFileSync, realpathSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'csv-parse/sync';
import { hash, localFile, validateRun } from './evidence.ts';

export const columns = {
  coverage: ['scenario_id', 'capability', 'scenario', 'spec', 'boundary', 'implementation', 'last_run_id'],
  debt: ['debt_id', 'kind', 'status', 'location', 'gap', 'workaround', 'risk', 'resolution', 'evidence_ref'],
  contracts: ['operation_id', 'service', 'method', 'path', 'source', 'source_revision', 'validation_status', 'evidence_ref', 'limitation'],
};
function assert(ok: unknown, message: string): asserts ok { if (!ok) throw new Error(message); }
export function table(text: string, kind: keyof typeof columns): Record<string, string>[] {
  const rows: string[][] = parse(text, { bom: true, skip_empty_lines: true, relax_column_count: false });
  const header = rows.shift();
  assert(header && header.length === columns[kind].length && new Set(header).size === header.length && columns[kind].every(c => header.includes(c)), `Invalid ${kind} columns`);
  const data = rows.map(row => Object.fromEntries(header.map((key, i) => [key, row[i]])));
  const key = columns[kind][0];
  assert(data.every(row => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(row[key])), `Invalid ${key}`);
  assert(new Set(data.map(row => row[key])).size === data.length, `Duplicate ${key}`);
  return data;
}
export function validateCoverage(target: string) {
  target = realpathSync(target);
  assert(statSync(target).isDirectory(), 'Target must be a directory');
  for (const path of ['e2e', 'e2e/tmp']) {
    try { lstatSync(resolve(target, path)); }
    catch (error: any) {
      if (error.code !== 'ENOENT') throw error;
      return { coverage: null, debt: null, contracts: null, links: [], checked_runs: [] };
    }
    assert(statSync(localFile(target, path)).isDirectory(), 'Coverage directory must be a directory');
  }
  const tmp = localFile(target, 'e2e/tmp');
  const load = (kind: keyof typeof columns) => existsSync(resolve(tmp, `${kind}.csv`)) ? table(readFileSync(localFile(tmp, `${kind}.csv`), 'utf8'), kind) : null;
  const coverage = load('coverage'), debt = load('debt'), contracts = load('contracts');
  const runs = new Map<string, ReturnType<typeof validateRun>>();
  function run(id: string) { if (!runs.has(id)) runs.set(id, validateRun(target, id)); return runs.get(id)!; }
  const nonempty = (row: Record<string, string>, keys: string[]) => { for (const k of keys) assert(row[k].trim(), `Missing ${k}`); };
  function evidence(ref: string) {
    const match = /^runs\/([a-z0-9]+(?:-[a-z0-9]+)*)\/evidence.json#([a-z0-9]+(?:-[a-z0-9]+)*)$/.exec(ref);
    assert(match, `Invalid evidence_ref: ${ref}`);
    assert(run(match[1]).evidence.items.some((e: any) => e.id === match[2]), 'Unknown evidence ID');
  }
  for (const row of coverage ?? []) {
    nonempty(row, ['capability', 'scenario']);
    assert(['planned', 'implemented', 'blocked'].includes(row.implementation), 'Invalid implementation');
    assert(['browser', 'browser+ssr'].includes(row.boundary), 'Invalid boundary');
    assert(row.implementation !== 'implemented' || row.spec, 'Implemented scenario needs spec');
    if (row.spec) assert(statSync(localFile(target, row.spec)).isFile(), 'Spec must be a file');
    if (row.last_run_id) {
      const result = run(row.last_run_id);
      const cases = result.run.cases.filter((c: any) => c.scenario_id === row.scenario_id);
      assert(cases.length > 0, 'Run does not contain coverage scenario');
      assert(row.spec && cases.every((c: any) => c.spec.path === row.spec && c.spec.sha256 === hash(localFile(target, row.spec))), 'Coverage references a stale or different spec');
    }
  }
  for (const row of debt ?? []) {
    nonempty(row, ['gap', 'risk']);
    assert(['a11y', 'contract', 'topology', 'ssr', 'infrastructure'].includes(row.kind), 'Invalid debt kind');
    assert(['open', 'resolved'].includes(row.status), 'Invalid debt status');
    if (row.location) localFile(target, row.location);
    if (row.status === 'resolved') nonempty(row, ['resolution', 'evidence_ref']);
    if (row.evidence_ref) evidence(row.evidence_ref);
  }
  for (const row of contracts ?? []) {
    nonempty(row, ['service', 'method', 'path', 'source']);
    assert(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'].includes(row.method), 'Invalid HTTP method');
    assert(['not-run', 'passed-for-samples', 'mismatch'].includes(row.validation_status), 'Invalid contract validation status');
    if (row.validation_status !== 'not-run') nonempty(row, ['source_revision', 'evidence_ref', 'limitation']);
    if (row.evidence_ref) evidence(row.evidence_ref);
  }
  let links: { scenario_id: string; debt_id: string }[] = [];
  if (existsSync(resolve(tmp, 'coverage-links.json'))) {
    const data = JSON.parse(readFileSync(localFile(tmp, 'coverage-links.json'), 'utf8'));
    assert(data && Object.keys(data).sort().join(',') === 'scenario_debt,schema_version' && data.schema_version === 1 && Array.isArray(data.scenario_debt), 'Invalid coverage links format');
    links = data.scenario_debt;
    const seen = new Set<string>();
    for (const link of links) {
      assert(link && Object.keys(link).sort().join(',') === 'debt_id,scenario_id', 'Invalid coverage link');
      assert(coverage?.some(r => r.scenario_id === link.scenario_id) && debt?.some(r => r.debt_id === link.debt_id), 'Dangling scenario/debt link');
      const key = JSON.stringify([link.scenario_id, link.debt_id]); assert(!seen.has(key), 'Duplicate coverage link'); seen.add(key);
    }
  }
  for (const row of coverage ?? []) if (row.implementation === 'blocked') {
    assert(links.some(l => l.scenario_id === row.scenario_id && debt?.some(d => d.debt_id === l.debt_id && d.status === 'open')), 'Blocked scenario needs linked open debt');
  }
  return { coverage, debt, contracts, links, checked_runs: [...runs.keys()] };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2);
    assert(args.length === 2 && args[0] === '--target', 'Usage: --target <target-root>');
    const data = validateCoverage(args[1]);
    console.log(JSON.stringify({ tables: Object.fromEntries(['coverage', 'debt', 'contracts'].map(k => [k, data[k]?.length ?? 'not-surveyed'])), checked_runs: data.checked_runs }));
  } catch (error) { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; }
}
