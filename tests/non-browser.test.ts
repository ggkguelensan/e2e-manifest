import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fixture } from './helpers/evidence.ts';
import { hash } from '../scripts/evidence.ts';
import { columns, validateCoverage } from '../scripts/coverage.ts';
import { renderRun } from '../scripts/report.ts';

test('non-browser contract attachment links through coverage and report without UI metadata', () => fixture(({root,directory,run,evidence,check}) => {
  mkdirSync(resolve(directory,'diagnostics'));
  const file = resolve(directory,'diagnostics/contract.json');
  writeFileSync(file, JSON.stringify({operation:'read-order',source_revision:'fixture-v1',result:'passed-for-samples',limitations:['Synthetic sample; no live backend request']}));
  run.cases[0].profile='backend-fixture';
  run.limitations=['Synthetic sample; no live backend request'];
  const item=evidence.items[0];
  Object.assign(item,{id:'contract-result',kind:'attachment',path:'diagnostics/contract.json',mime:'application/json',sha256:hash(file),description:'Contract sample result',conditions:{execution:'non-browser',environment:'local-fixture',state:'read-order sample checked'}});
  check();
  const target=resolve(root,'apps/web');
  writeFileSync(resolve(target,'e2e/tmp/contracts.csv'), [columns.contracts.join(','),'read-order,orders,GET,/orders/1,synthetic sample,fixture-v1,passed-for-samples,runs/example/evidence.json#contract-result,Synthetic sample only'].join('\n'));
  assert.deepEqual(validateCoverage(target).checked_runs,['example']);
  const html=readFileSync(renderRun(target,'example'),'utf8');
  assert.match(html,/href="\.\.\/diagnostics\/contract.json"/);
  assert.match(html,/non-browser/); assert.match(html,/Synthetic sample/);
  assert.ok(!html.includes('&quot;viewport&quot;')); assert.ok(!html.includes('<img'));
  item.sha256='0'.repeat(64);assert.throws(()=>{check();validateCoverage(target)},/hash mismatch/);
}));

test('screenshots require UI conditions and non-browser conditions cannot invent a viewport', () => fixture(({evidence,check}) => {
  const item=evidence.items[0];
  item.conditions={execution:'non-browser',environment:'local',state:'checked'};
  assert.throws(check,/conditions/);
  item.kind='log';check();
  item.conditions.viewport={width:1,height:1};assert.throws(check,/additional properties|oneOf/);
  delete item.conditions.viewport;delete item.conditions.environment;assert.throws(check,/environment/);
}));

test('old evidence format is rejected without modifying recorded version', () => fixture(({evidence,check}) => {
  evidence.schema_version=1;assert.throws(check,/constant/);assert.equal(evidence.schema_version,1);
}));
