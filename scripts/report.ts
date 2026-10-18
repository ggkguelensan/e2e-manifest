import { existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { localFile, validateRun } from './evidence.ts';

const escape = (value: unknown) => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const url = (path: string) => path.split('/').map(encodeURIComponent).join('/');
export function renderRun(target: string, runId: string) {
  const { run, evidence, directory } = validateRun(target, runId);
  const output = resolve(directory, 'reports');
  // Confine a pre-existing reports symlink before any write.
  if (existsSync(output)) localFile(directory, 'reports');
  else mkdirSync(output);
  const reports = realpathSync(output);
  const link = (file: string) => escape(url(relative(reports, file)));
  const list = (items: string[]) => items.length ? `<ul>${items.map(s => `<li>${escape(s)}</li>`).join('')}</ul>` : '<p>None recorded.</p>';
  const sections = run.cases.map((c: any) => `<section id="${escape(c.id)}"><h2>${escape(c.scenario)}</h2>
<p><strong>${escape(c.status)}</strong> · scenario ${escape(c.scenario_id)} · ${escape(c.profile)} · attempt ${c.attempt}</p>
<p>Spec: ${escape(c.spec.path)} <code>${escape(c.spec.sha256)}</code></p>
<ol>${c.steps.map((step: any) => {
    const items = evidence.items.filter((e: any) => e.case_id === c.id && e.step_id === step.id);
    return `<li><h3>${escape(step.title)} — ${escape(step.status)}</h3>${items.length ? items.map((e: any) => {
      const file = localFile(directory, e.path);
      return `<figure>${e.kind === 'screenshot' ? `<a href="${link(file)}"><img loading="lazy" src="${link(file)}" alt="${escape(e.description)}"></a>` : `<a download href="${link(file)}">${escape(e.kind)}: ${escape(e.description)}</a>`}<figcaption>${escape(e.id)} · ${escape(e.captured_at)}<br>${escape(JSON.stringify(e.conditions))}<br><code>${escape(e.sha256)}</code></figcaption></figure>`;
    }).join('') : '<p>No evidence captured for this step.</p>'}</li>`;
  }).join('')}</ol></section>`).join('');
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src 'self' file:; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"><title>${escape(run.run_id)} — ${escape(run.status)}</title><style>body{font:16px/1.5 system-ui;margin:auto;padding:24px;max-width:1100px;color:#18202b;background:#f7f8fa}a{color:#1554b2}a:focus-visible{outline:3px solid #a45500}section{background:white;border:1px solid #ccd2d9;border-radius:8px;padding:20px;margin:20px 0}img{max-width:100%;max-height:720px;object-fit:contain}figure{margin:16px 0}code,figcaption{overflow-wrap:anywhere}nav ul{display:flex;flex-wrap:wrap;gap:20px}h1,h2,h3{line-height:1.3}@media(max-width:600px){body{padding:12px}section{padding:12px}ol{padding-left:20px}}</style></head><body>
<h1>${escape(run.run_id)} — ${escape(run.status)}</h1>
<p>Repository ${escape(run.repository_id)} · target ${escape(run.target_id)} · revision <code>${escape(run.revision)}</code> · dirty: ${run.dirty}</p>
<p>${escape(run.started_at)} → ${escape(run.finished_at ?? 'Not finished')}</p>
<p>Worktree: ${escape(run.worktree)} / ${escape(run.target_path)}</p>
<p>Saved results; this report does not rerun tests or establish design conformity.</p>
<nav aria-label="Scenarios"><ul>${run.cases.map((c: any) => `<li><a href="#${escape(c.id)}">${escape(c.scenario)} · ${escape(c.profile)} · ${escape(c.status)}</a></li>`).join('')}</ul></nav>
${sections}<section><h2>Limitations</h2>${list(run.limitations)}</section>
<footer><a href="${link(localFile(directory, 'run.json'))}">run.json</a> · <a href="${link(localFile(directory, 'evidence.json'))}">evidence.json</a></footer></body></html>`;
  const digest = createHash('sha256').update(html).digest('hex').slice(0, 16);
  const file = resolve(reports, `run-${digest}.html`);
  if (existsSync(file)) {
    localFile(directory, `reports/run-${digest}.html`);
    if (readFileSync(file, 'utf8') !== html) throw new Error('Report name collision; existing output preserved');
  } else writeFileSync(file, html, { flag: 'wx' });
  return file;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2);
    if (args.length !== 4 || args[0] !== '--target' || args[2] !== '--run') throw new Error('Usage: --target <target-root> --run <run-id>');
    console.log(renderRun(args[1], args[3]));
  } catch (error) { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; }
}
