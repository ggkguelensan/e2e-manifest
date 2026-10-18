import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const git = (...args: string[]) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
function setup() {
  if (git('rev-parse', '--show-toplevel') !== root) throw new Error('Run setup in a dedicated e2e-manifest checkout.');
  const flag = process.env.E2E_MANIFEST_DEV;
  if (flag !== undefined && flag !== '0' && flag !== '1') throw new Error('E2E_MANIFEST_DEV must be 1, 0, or unset.');
  const dev = flag === '1';
  const branch = git('branch', '--show-current');
  if (branch !== (dev ? 'dev' : 'main')) throw new Error(`Expected ${dev ? 'dev' : 'main'} branch; found ${branch || 'detached HEAD'}. No files removed.`);
  const catalog = JSON.parse(readFileSync(resolve(root, 'stack/catalog.json'), 'utf8'));
  const available = Object.keys(catalog.modules);
  let selected = available;
  if (!dev) {
    const raw = process.env.E2E_MANIFEST_STACKS;
    if (!raw?.trim()) throw new Error('Set E2E_MANIFEST_STACKS explicitly, e.g. playwright,msw. No files removed.');
    selected = [...new Set(raw.split(',').map(value => value.trim()))];
    for (const id of selected) if (!available.includes(id)) throw new Error(`Unknown stack: ${id}. No files removed.`);
    for (let i = 0; i < selected.length; i++) {
      for (const dependency of catalog.modules[selected[i]].requires) {
        if (!available.includes(dependency)) throw new Error(`Unknown module dependency: ${dependency}`);
        if (!selected.includes(dependency)) selected.push(dependency);
      }
    }
    // Guard the whole tracked checkout, and untracked stack content, before changing visibility.
    if (git('status', '--porcelain', '--untracked-files=no') || git('ls-files', '--others', '--', 'stack')) {
      throw new Error('Checkout has local changes. Preserve them before selecting stacks. No files removed.');
    }
    execFileSync('git', ['sparse-checkout', 'set', '--no-cone', '--stdin'], {
      cwd: root,
      input: ['/*', '!/stack/*', '/stack/README.md', '/stack/catalog.json', ...selected.map(id => `/stack/${id}/`)].join('\n') + '\n',
      stdio: ['pipe', 'inherit', 'inherit'],
    });
  } else {
    const sparse = spawnSync('git', ['config', '--get', 'core.sparseCheckout'], { cwd: root, encoding: 'utf8' }).stdout?.trim();
    if (sparse === 'true') git('sparse-checkout', 'disable');
  }
  const directory = resolve(root, 'workdir');
  mkdirSync(directory, { recursive: true });
  const output = resolve(directory, 'installation.json');
  const temporary = `${output}.${process.pid}.tmp`;
  writeFileSync(temporary, JSON.stringify({ schema_version: 1, mode: dev ? 'development' : 'consumer', branch, base_revision: git('rev-parse', 'HEAD'), modules: selected }, null, 2) + '\n');
  renameSync(temporary, output);
  console.log(`${dev ? 'Development' : 'Consumer'} setup: ${selected.join(', ')}. workdir preserved.`);
}
try { setup(); } catch (error) { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; }
