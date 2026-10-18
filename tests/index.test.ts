import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fixture } from './helpers/evidence.ts';
import { buildIndex, writeIndex } from '../scripts/index.ts';
test('derived index is reproducible and preserves interrupted run as authoritative source',()=>fixture(({root,run,check})=>{
 run.status='interrupted';run.cases[0].status='interrupted';run.cases[0].steps[0].status='interrupted';check();
 const target=resolve(root,'apps/web'), before=buildIndex(target);assert.equal(before.runs.length,1);
 const file=writeIndex(target);assert.deepEqual(JSON.parse(readFileSync(file,'utf8')),before);
 rmSync(file);assert.deepEqual(JSON.parse(readFileSync(writeIndex(target),'utf8')),before);
}));
test('corrupt evidence cannot replace previously valid index',()=>fixture(({root,artifact,check})=>{
 check();const target=resolve(root,'apps/web'), file=writeIndex(target), before=readFileSync(file,'utf8');
 writeFileSync(artifact,'corrupt');assert.throws(()=>writeIndex(target),/hash/);assert.equal(readFileSync(file,'utf8'),before);
}));
test('unknown index and symlink output are preserved rather than overwritten',()=>fixture(({root,check})=>{
 check();const target=resolve(root,'apps/web'), file=resolve(target,'e2e/tmp/index.json');writeFileSync(file,'{"user_data":true}');
 assert.throws(()=>writeIndex(target),/owned/);assert.equal(readFileSync(file,'utf8'),'{"user_data":true}');rmSync(file);
 const other=resolve(root,'other.json');writeFileSync(other,'unchanged');symlinkSync(other,file);assert.throws(()=>writeIndex(target),/regular/);assert.equal(readFileSync(other,'utf8'),'unchanged');
}));
test('empty target index does not imply successful coverage; runs symlink rejected',()=>fixture(({root,check})=>{
 check();const target=resolve(root,'apps/web');rmSync(resolve(target,'e2e/tmp'),{recursive:true});assert.deepEqual(buildIndex(target).runs,[]);
 writeIndex(target);symlinkSync(root,resolve(target,'e2e/tmp/runs'));assert.throws(()=>buildIndex(target),/physical/);
}));
