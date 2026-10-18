import Ajv from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, realpathSync, statSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { hash, localFile } from './evidence.ts';
const ajv = new Ajv({strict:true,allErrors:true});addFormats(ajv);
const schemas=Object.fromEntries(['workspace','discovery'].map(name=>[name,ajv.compile(JSON.parse(readFileSync(new URL(`../schemas/${name}.schema.json`,import.meta.url),'utf8')))]));
const git=(root:string,...args:string[])=>execFileSync('git',['--no-optional-locks',...args],{cwd:root,encoding:'utf8',stdio:'pipe'}).trim();
export function observeWorkspace(target:string,repositoryId:string,targetId:string){
 target=realpathSync(target);assert.ok(statSync(target).isDirectory(),'Target must be a directory');
 const worktree=realpathSync(git(target,'rev-parse','--show-toplevel'));
 const data={schema_version:1,observed_at:new Date().toISOString(),repository_id:repositoryId,target_id:targetId,worktree,target_path:relative(worktree,target).split('\\').join('/')||'.',revision:git(target,'rev-parse','HEAD'),branch:git(target,'branch','--show-current')||null,dirty:git(target,'status','--porcelain')!==''};
 assert.ok(schemas.workspace(data),ajv.errorsText(schemas.workspace.errors));return data;
}
export function validateDiscovery(target:string,repositoryId:string,targetId:string){
 target=realpathSync(target);
 const file=localFile(target,'e2e/tmp/adaptation.json');
 const data=JSON.parse(readFileSync(file,'utf8'));assert.ok(schemas.discovery(data),ajv.errorsText(schemas.discovery.errors));
 const workspaceFile=localFile(target,'e2e/tmp/workspace.json');
 assert.equal(hash(workspaceFile),data.workspace.sha256,'Workspace hash mismatch');
 const workspace=JSON.parse(readFileSync(workspaceFile,'utf8'));assert.ok(schemas.workspace(workspace),ajv.errorsText(schemas.workspace.errors));
 const current=observeWorkspace(target,repositoryId,targetId);
 assert.equal(workspace.repository_id,repositoryId,'Repository identity mismatch');assert.equal(workspace.target_id,targetId,'Target identity mismatch');
 assert.equal(realpathSync(workspace.worktree),current.worktree,'Workspace belongs to another worktree');
 assert.equal(localFile(current.worktree,workspace.target_path),target,'Workspace belongs to another target');
 assert.ok(Date.parse(workspace.observed_at)<=Date.parse(data.recorded_at),'Discovery predates workspace observation');
 assert.equal(new Set(data.decisions.map((d:any)=>d.id)).size,data.decisions.length,'Duplicate decision ID');
 return {workspace,discovery:data,current_revision_matches:workspace.revision===current.revision,current_dirty_matches:workspace.dirty===current.dirty,limitations:['Matching revision/dirty flags do not prove identical uncommitted bytes. Decisions and provenance are recorded statements, not verified authorization or proof of completed adaptation.']};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{const [mode,target,repositoryId,targetId,...extra]=process.argv.slice(2);assert.ok(['observe','validate'].includes(mode)&&target&&repositoryId&&targetId&&!extra.length,'Usage: observe|validate <target-root> <repository-id> <target-id>');console.log(JSON.stringify(mode==='observe'?observeWorkspace(target,repositoryId,targetId):validateDiscovery(target,repositoryId,targetId),null,2));}
 catch(error){console.error(error instanceof Error?error.message:error);process.exitCode=1;}
}
