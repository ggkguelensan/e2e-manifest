import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { localFile, validateRun } from './evidence.ts';
const esc = (s: unknown) => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
function requireValue(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }
export function renderDesign(target: string, reviewId: string, designRoot: string, revision: string) {
  requireValue(/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(reviewId), 'Invalid review ID');
  requireValue(/^[a-f0-9]{40}$/.test(revision), 'Design revision must be a full commit');
  const base = realpathSync(designRoot);
  const git = (...args: string[]) => execFileSync('git', args, { cwd: base, encoding: 'utf8' }).trim();
  requireValue(realpathSync(git('rev-parse', '--show-toplevel')) === base, 'Design path must be its checkout root');
  requireValue(git('rev-parse', 'HEAD') === revision && !git('status', '--porcelain'), 'Design pin mismatch or dirty checkout');
  const root = localFile(target, `e2e/tmp/design-review/${reviewId}`);
  execFileSync(process.execPath, [localFile(base, 'scripts/validate.ts'), '--root', root, '--comparison', 'comparison.json'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  const comparison = JSON.parse(readFileSync(localFile(root, 'comparison.json'), 'utf8'));
  requireValue(comparison.schema_version === 2, 'Renderer supports comparison format 2');
  const snapshot = comparison.snapshot ? JSON.parse(readFileSync(localFile(root, comparison.snapshot.path), 'utf8')) : null;
  if (snapshot) requireValue(snapshot.schema_version === 1, 'Renderer supports snapshot format 1');
  for (const pair of comparison.pairs) {
    if (!pair.ui?.run_id) continue;
    const { run, evidence } = validateRun(target, pair.ui.run_id);
    const ui = pair.ui;
    requireValue(run.repository_id === ui.repository && run.revision === ui.revision && run.dirty === ui.local_changes, 'UI source differs from run provenance');
    const cases = run.cases.filter((c: any) => c.profile === ui.profile && c.attempt === ui.attempt && c.spec.path === ui.spec?.path && c.spec.sha256 === ui.spec?.sha256);
    requireValue(evidence.items.some((e: any) => cases.some((c: any) => c.id === e.case_id) && e.step_id === ui.step && e.sha256 === ui.artifact.sha256 && e.captured_at === ui.captured_at && e.conditions.dpr === ui.dpr && e.conditions.viewport.width === ui.viewport.width && e.conditions.viewport.height === ui.viewport.height && ['theme', 'locale', 'state'].every(k => e.conditions[k] === ui[k])), 'UI copy does not match original run evidence');
  }
  const out = resolve(root, 'reports');
  if (existsSync(out)) localFile(root, 'reports'); else mkdirSync(out);
  const reports = realpathSync(out);
  const href = (path: string) => esc(relative(reports, localFile(root, path)).split('/').map(encodeURIComponent).join('/'));
  const details = (title: string, data: unknown) => `<details><summary>${esc(title)}</summary><pre>${esc(JSON.stringify(data, null, 2))}</pre></details>`;
  const picture = (artifact: any, title: string) => artifact ? `<figure>${['image/png', 'image/jpeg'].includes(artifact.media_type) ? `<a href="${href(artifact.path)}"><img src="${href(artifact.path)}" alt="${esc(title)}"></a>` : `<a download href="${href(artifact.path)}">${esc(title)} — original resource</a>`}<figcaption>${esc(title)} · ${esc(artifact.sha256)}</figcaption></figure>` : `<p>${esc(title)} unavailable</p>`;
  const pairs = comparison.pairs.map((p: any) => {
    const ref = snapshot?.references.find((r: any) => r.id === p.reference_id);
    const resource = snapshot?.resources.find((r: any) => r.id === ref?.resource_id);
    return `<section><h2>${esc(p.id)} — ${esc(p.status)}</h2><p>${esc(p.scope)}</p><div class="pair">${picture(resource?.artifact, 'Design')}${picture(p.ui?.artifact, 'Captured UI')}</div>${details('Comparability', p.comparability)}${details('Findings', p.findings)}${details('Limitations', p.limitations)}${details('UI provenance', p.ui)}${details('Design provenance', { source: snapshot?.source ?? null, reference: ref ?? null, resource: resource ?? null })}</section>`;
  }).join('');
  const html = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src 'self' file:; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"><title>Design review ${esc(comparison.comparison_id)}</title><style>body{font:16px/1.5 system-ui;margin:auto;padding:20px;max-width:1200px;background:#f6f7f9;color:#18202b}section{background:white;padding:20px;margin:20px 0;border:1px solid #ccd2d9}img{max-width:100%;max-height:700px}figure{margin:0;min-width:0}figcaption,pre{white-space:pre-wrap;overflow-wrap:anywhere}.pair{display:grid;grid-template-columns:1fr 1fr;gap:20px}summary{cursor:pointer}a:focus-visible,summary:focus-visible{outline:3px solid #a45500}@media(max-width:650px){.pair{grid-template-columns:1fr}body,section{padding:12px}}</style><h1>Design review ${esc(comparison.comparison_id)}</h1><p>${esc(comparison.created_at)} · Design Manifest ${esc(revision)}</p><p>Recorded comparison results. Rendering does not reassess conformity or authorize changes.</p>${pairs}${details('Review limitations', comparison.limitations)}<a href="${href('comparison.json')}">comparison.json</a></html>`;
  const digest = createHash('sha256').update(html).digest('hex').slice(0, 16), name = `comparison-${digest}.html`, file = resolve(reports, name);
  if (existsSync(file)) { localFile(root, `reports/${name}`); requireValue(readFileSync(file, 'utf8') === html, 'Report collision'); } else writeFileSync(file, html, { flag: 'wx' });
  return file;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const a = process.argv.slice(2);
    requireValue(a.length === 8 && a[0] === '--target' && a[2] === '--review' && a[4] === '--design' && a[6] === '--revision', 'Usage: --target <root> --review <id> --design <checkout> --revision <commit>');
    console.log(renderDesign(a[1], a[3], a[5], a[7]));
  } catch (error) { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; }
}
