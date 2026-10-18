import {test} from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdirSync,mkdtempSync,rmSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {observeWorkspace,validateDiscovery} from '../scripts/discovery.ts';
import {hash} from '../scripts/evidence.ts';
function fixture(action:(x:any)=>void){
 mkdirSync('e2e/tmp',{recursive:true});const root=mkdtempSync(resolve('e2e/tmp/discovery-')),target=resolve(root,'apps/web');mkdirSync(resolve(target,'e2e/tmp'),{recursive:true});writeFileSync(resolve(target,'e2e/.gitignore'),'/tmp/\n');
 const git=(...args:string[])=>execFileSync('git',['-c','core.hooksPath=/dev/null','-c','commit.gpgsign=false',...args],{cwd:root,stdio:'pipe',encoding:'utf8'}).trim();
 git('init','-b','task');git('add','.');git('-c','user.name=Fixture','-c','user.email=fixture@example.invalid','commit','-m','Fixture');
 const workspace=observeWorkspace(target,'frontend','web'),file=resolve(target,'e2e/tmp/workspace.json');writeFileSync(file,JSON.stringify(workspace));
 const data:any={schema_version:1,workspace:{path:'workspace.json',sha256:hash(file)},recorded_at:new Date().toISOString(),decisions:[{id:'boundary',question:'Which execution boundary?',answer:'Client only',basis:'Fixture has no server rendering',source:'repository'}],open_questions:['Confirm device priority'],limitations:['Synthetic fixture only']};
 const save=()=>writeFileSync(resolve(target,'e2e/tmp/adaptation.json'),JSON.stringify(data));save();const check=()=>validateDiscovery(target,'frontend','web');
 try{action({root,target,git,workspace,file,data,save,check});}finally{rmSync(root,{recursive:true,force:true});}
}
test('workspace records nested current worktree; unresolved questions remain data',()=>fixture(({check})=>{const r=check();assert.equal(r.workspace.target_path,'apps/web');assert.equal(r.current_revision_matches,true);assert.equal(r.discovery.open_questions.length,1);}));
test('changed HEAD remains historical observation, not current source claim',()=>fixture(({git,check})=>{git('-c','user.name=Fixture','-c','user.email=fixture@example.invalid','commit','--allow-empty','-m','Next');assert.equal(check().current_revision_matches,false);}));
test('foreign identities hash changes duplicate decisions and chronology fail',()=>fixture(({data,save,check,target,file})=>{
 assert.throws(()=>validateDiscovery(target,'other','web'),/identity/);
 data.decisions.push({...data.decisions[0]});save();assert.throws(check,/Duplicate/);data.decisions.pop();
 data.recorded_at='2000-01-01T00:00:00Z';save();assert.throws(check,/predates/);
 writeFileSync(file,'{}');assert.throws(check,/hash/);
}));
