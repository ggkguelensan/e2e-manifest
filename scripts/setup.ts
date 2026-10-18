import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, realpathSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = realpathSync(resolve(dirname(fileURLToPath(import.meta.url)), '..'));
const git = (...args: string[]) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
function setup() {
  if (realpathSync(git('rev-parse', '--show-toplevel')) !== root) throw new Error('Run setup in a dedicated e2e-manifest checkout.');
  const flag = process.env.E2E_MANIFEST_DEV;
  if (flag !== undefined && flag !== '0' && flag !== '1') throw new Error('E2E_MANIFEST_DEV must be 1, 0, or unset.');
  const dev = flag === '1';
  const catalog = JSON.parse(readFileSync(resolve(root, 'stack/catalog.json'), 'utf8'));
  if (catalog.schema_version !== 1) throw new Error('Unsupported stack catalog version.');
  const available = Object.keys(catalog.modules);
  const raw = process.env.E2E_MANIFEST_STACKS;
  // Selection validates intent; it does not prune files or configure agent discovery.
  const selected = dev ? available : raw?.trim() ? [...new Set(raw.split(',').map(value => value.trim()))] : [];
  for (const id of selected) {
    if (!available.includes(id)) throw new Error(`Unknown stack: ${id}`);
    for (const dependency of catalog.modules[id].requires) {
      if (!available.includes(dependency)) throw new Error(`Unknown module dependency: ${dependency}`);
      if (!selected.includes(dependency)) throw new Error(`Select required module ${dependency} explicitly for ${id}.`);
    }
  }
  const directory = resolve(root, 'workdir');
  mkdirSync(directory, { recursive: true });
  const output = resolve(directory, 'installation.json');
  const temporary = `${output}.${process.pid}.tmp`;
  writeFileSync(temporary, JSON.stringify({ schema_version: 2, mode: dev ? 'development' : 'consumer', base_revision: git('rev-parse', 'HEAD'), modules: selected }, null, 2) + '\n');
  renameSync(temporary, output);
  console.log(`${dev ? 'Development' : 'Consumer'} setup: ${selected.join(', ') || 'no modules selected'}. Files and workdir adaptation preserved. Agent discovery is not configured by setup.`);
}
try { setup(); } catch (error) { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; }
