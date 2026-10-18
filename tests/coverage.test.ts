import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { columns, table, validateCoverage } from '../scripts/coverage.ts';
import { hash } from '../scripts/evidence.ts';
const scratch = resolve('e2e/tmp'); mkdirSync(scratch, { recursive: true });
function fixture(action: (x: any) => void) {
  const root = mkdtempSync(resolve(scratch, 'coverage-')), tmp = resolve(root, 'e2e/tmp');
  mkdirSync(tmp, { recursive: true }); execFileSync('git', ['init', '-q', root]);
  const write = (kind: keyof typeof columns, rows: string[][]) => writeFileSync(resolve(tmp, `${kind}.csv`), [columns[kind], ...rows].map(row => row.map(v => `"${v.replaceAll('"', '""')}"`).join(',')).join('\n'));
  const coverage = ['checkout', 'purchase', 'Buy ticket', 'e2e/checkout.spec.ts', 'browser', 'implemented', ''];
  const debt = ['missing-name', 'a11y', 'open', '', 'No accessible name', 'Use text', 'Ambiguous locator', '', ''];
  writeFileSync(resolve(root, 'e2e/checkout.spec.ts'), 'fixture spec');
  const check = () => validateCoverage(root);
  const addRun = () => {
    const directory = resolve(tmp, 'runs/test'); mkdirSync(resolve(directory, 'assets'), { recursive: true });
    const run = { schema_version: 1, run_id: 'test', repository_id: 'fixture', target_id: 'web', worktree: root, target_path: '.', revision: 'a'.repeat(40), dirty: true, started_at: '2026-10-18T10:00:00Z', finished_at: '2026-10-18T10:00:02Z', status: 'passed', cases: [{ id: 'checkout-mobile', scenario_id: 'checkout', spec: { path: 'e2e/checkout.spec.ts', sha256: hash(resolve(root, 'e2e/checkout.spec.ts')) }, scenario: 'Buy ticket', profile: 'mobile', attempt: 1, status: 'passed', steps: [{ id: 'result', title: 'Then result', status: 'passed' }] }], limitations: [] };
    writeFileSync(resolve(directory, 'run.json'), JSON.stringify(run));
    writeFileSync(resolve(directory, 'evidence.json'), JSON.stringify({ schema_version: 1, run_id: 'test', items: [] }));
  };
  try { action({ root, tmp, write, coverage, debt, check, addRun }); } finally { rmSync(root, { recursive: true, force: true }); }
}
test('CSV preserves commas, quotes, multiline and BOM', () => {
  const rows = table('\ufeff' + columns.coverage.join(',') + '\r\ncheckout,shop,"Buy, then ""pay""\nnow",,browser,planned,\r\n', 'coverage');
  assert.equal(rows[0].scenario, 'Buy, then "pay"\nnow');
});
test('CSV rejects duplicate IDs, unknown headers and malformed records', () => {
  const row = 'checkout,shop,buy,,browser,planned,\n';
  assert.throws(() => table(columns.coverage.join(',') + '\n' + row + row, 'coverage'), /Duplicate/);
  assert.throws(() => table('id,other\na,b', 'coverage'), /columns/);
  assert.throws(() => table(columns.coverage.join(',') + '\ncheckout,shop', 'coverage'));
});
test('missing table remains unexamined and implemented requires actual spec', () => fixture(({ write, coverage, check }) => {
  assert.equal(check().coverage, null);
  write('coverage', [coverage]); assert.equal(check().coverage.length, 1);
  coverage[3] = ''; write('coverage', [coverage]); assert.throws(check, /needs spec/);
  coverage[3] = '../escape'; write('coverage', [coverage]); assert.throws(check, /Unsafe path/);
}));
test('absent tmp or e2e is unexamined without creating directories', () => fixture(({ root, tmp, check }) => {
  rmSync(tmp, {recursive:true});
  const empty = {coverage:null,debt:null,contracts:null,links:[],checked_runs:[]};
  assert.deepEqual(check(), empty); assert.equal(existsSync(tmp), false);
  rmSync(resolve(root, 'e2e'), {recursive:true});
  assert.deepEqual(check(), empty); assert.equal(existsSync(resolve(root, 'e2e')), false);
}));
test('escaped or dangling coverage directories are errors, not unexamined data', () => fixture(({ root, tmp, check }) => {
  rmSync(tmp, {recursive:true});
  symlinkSync(resolve(root, 'missing'), tmp); assert.throws(check); rmSync(tmp);
  symlinkSync(scratch, tmp); assert.throws(check, /escapes root/);
}));
test('blocked needs an existing open debt; duplicate and dangling links fail', () => fixture(({ tmp, write, coverage, debt, check }) => {
  coverage[5] = 'blocked'; write('coverage', [coverage]); write('debt', [debt]); assert.throws(check, /linked open debt/);
  const link = { scenario_id: 'checkout', debt_id: 'missing-name' };
  const save = (links: any[]) => writeFileSync(resolve(tmp, 'coverage-links.json'), JSON.stringify({ schema_version: 1, scenario_debt: links }));
  save([link]); assert.equal(check().links.length, 1);
  save([link, link]); assert.throws(check, /Duplicate/);
  save([{ ...link, debt_id: 'unknown' }]); assert.throws(check, /Dangling/);
}));
test('resolved debt requires resolution and actual evidence ID', () => fixture(({ write, debt, check, addRun }) => {
  debt[2] = 'resolved'; write('debt', [debt]); assert.throws(check, /Missing resolution/);
  debt[7] = 'Added accessible label'; debt[8] = 'runs/test/evidence.json#missing'; addRun(); write('debt', [debt]); assert.throws(check, /Unknown evidence ID/);
}));
test('last run must contain scenario with current spec hash', () => fixture(({ root, coverage, write, addRun, check }) => {
  addRun(); coverage[6] = 'test'; write('coverage', [coverage]); assert.deepEqual(check().checked_runs, ['test']);
  coverage[0] = 'unknown'; write('coverage', [coverage]); assert.throws(check, /does not contain/);
  coverage[0] = 'checkout'; write('coverage', [coverage]); writeFileSync(resolve(root, coverage[3]), 'changed spec'); assert.throws(check, /stale/);
}));
test('contract sample verification cannot omit evidence or limitations', () => fixture(({ write, check }) => {
  const row = ['read-order', 'orders', 'GET', '/orders/1', 'backend sample', '', 'passed-for-samples', '', ''];
  write('contracts', [row]); assert.throws(check, /Missing source_revision/);
  row[6] = 'not-run'; write('contracts', [row]); assert.equal(check().contracts.length, 1);
}));
