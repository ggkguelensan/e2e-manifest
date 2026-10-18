import Ajv from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { execFileSync } from 'node:child_process';
import { readFileSync, realpathSync } from 'node:fs';
import { dirname, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { hash, localFile } from './evidence.ts';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ajv = new Ajv({ allErrors: true, strict: true, strictRequired: false }); addFormats(ajv);
const schemas = Object.fromEntries(['project-manifest', 'project-patch'].map(name => [name, ajv.compile(JSON.parse(readFileSync(resolve(root, `schemas/${name}.schema.json`), 'utf8')))]));
function ensure(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }
function read(path: string, name: string) { const value = JSON.parse(readFileSync(path, 'utf8')); ensure(schemas[name](value), `${name}: ${ajv.errorsText(schemas[name].errors)}`); return value; }
const under = (parent: string, child: string) => { const rel = relative(parent, child); return rel === '' || (rel !== '..' && !rel.startsWith(`..${sep}`) && !rel.startsWith(sep)); };
const overlaps = (a: string, b: string) => under(a, b) || under(b, a);
export function validateAdaptation(directory: string, base: string, target: string, scope = '.', now = new Date()) {
  ensure(Number.isFinite(now.getTime()), 'Unknown current time');
  const adaptation = realpathSync(directory), actualBase = realpathSync(base), targetRoot = realpathSync(target);
  const manifest = read(localFile(adaptation, 'manifest.json'), 'project-manifest');
  ensure(realpathSync(resolve(adaptation, manifest.base.path)) === actualBase, 'Base path mismatch');
  const git = (...args: string[]) => execFileSync('git', args, { cwd: actualBase, encoding: 'utf8' }).trim();
  ensure(realpathSync(git('rev-parse', '--show-toplevel')) === actualBase && git('rev-parse', 'HEAD') === manifest.base.revision, 'Base revision mismatch');
  ensure(!git('status', '--porcelain'), 'Base checkout has local changes');
  ensure(under(realpathSync(resolve(actualBase, 'workdir')), adaptation), 'Adaptation must be inside base workdir');
  ensure(!under(targetRoot, adaptation), 'Adaptation must be outside product target');
  const task = localFile(targetRoot, scope);
  const ids = new Set<string>(), resourceFiles = new Map<string, string>();
  const patches: any[] = [], applicable: any[] = [], pending: any[] = [];
  for (const path of manifest.patches) {
    const p = read(localFile(adaptation, path), 'project-patch');
    ensure(!ids.has(p.id), 'Duplicate patch ID'); ids.add(p.id);
    ensure(p.base_revision === manifest.base.revision, `Patch ${p.id}: incompatible base`);
    const scopes = p.scope.map((s: string) => localFile(targetRoot, s));
    const [doc, anchor] = p.target.split('#');
    const module = /^stack\/([^/]+)\//.exec(doc)?.[1];
    ensure(!module || manifest.modules.includes(module), `Patch targets unselected stack ${module}`);
    const text = readFileSync(localFile(actualBase, doc), 'utf8');
    const headings = [...text.matchAll(/^#+\s+(.+)$/gm)].map(m => m[1].toLowerCase().replace(/[^\p{L}\p{N}_\- ]/gu, '').replaceAll(' ', '-'));
    ensure(headings.includes(anchor), `Missing target anchor: ${p.target}`);
    if (p.mode === 'override' || p.settings) ensure(p.target === 'docs/evidence.md#проектные-предпочтения' && p.settings, 'Only typed evidence preferences can override defaults');
    const resourceIds = new Set<string>(), paths = new Set<string>();
    for (const r of p.resources) {
      ensure(!resourceIds.has(r.id) && !paths.has(r.path), 'Duplicate resource ID/path'); resourceIds.add(r.id); paths.add(r.path);
      const file = localFile(adaptation, r.path); ensure(hash(file) === r.sha256, 'Resource hash mismatch');
      ensure(!resourceFiles.has(file) || resourceFiles.get(file) === r.sha256, 'Conflicting shared resource hashes'); resourceFiles.set(file, r.sha256);
    }
    const updated = Date.parse(p.updated_at); ensure(updated <= now.getTime(), 'Future patch update');
    if (p.status === 'active') {
      ensure(p.review.revision === p.revision, 'Review revision mismatch');
      ensure(updated <= Date.parse(p.review.reviewed_at) && Date.parse(p.review.reviewed_at) <= now.getTime() && now.getTime() < Date.parse(p.review.review_due_at), 'Patch review stale or chronology invalid');
    }
    const record = { ...p, resolved_scope: scopes };
    patches.push(record);
    if (scopes.some((s: string) => overlaps(s, task))) (p.status === 'active' ? applicable : pending).push(record);
  }
  for (let i = 0; i < patches.length; i++) for (const b of patches.slice(i + 1)) {
    const a = patches[i];
    if (a.status !== 'active' || b.status !== 'active' || !a.resolved_scope.some((s: string) => b.resolved_scope.some((t: string) => overlaps(s, t)))) continue;
    for (const key of Object.keys(a.settings ?? {})) ensure(!(key in (b.settings ?? {})) || a.settings[key] === b.settings[key], `Conflicting setting ${key}: ${a.id}/${b.id}`);
  }
  return { manifest, scope, checked_at: now.toISOString(), applicable, pending, settings: Object.assign({}, ...applicable.map(p => p.settings ?? {})), semantic_review: 'Required: free-text requirements and Markdown conflicts are not proven by structural validation.' };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const a = process.argv.slice(2); ensure(a.length === 8 && a[0] === '--adaptation' && a[2] === '--base' && a[4] === '--target' && a[6] === '--scope', 'Usage: --adaptation <directory> --base <checkout> --target <target-root> --scope <relative-path>');
    console.log(JSON.stringify(validateAdaptation(a[1], a[3], a[5], a[7]), null, 2));
  } catch (error) { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; }
}
