import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { hash, validateRun } from '../../scripts/evidence.ts';

const scratch = resolve('e2e/tmp'); mkdirSync(scratch, { recursive: true });
export function fixture(action: (x: any) => void) {
  const root = mkdtempSync(resolve(scratch, 'evidence-'));
  try {
    execFileSync('git', ['init', '-q', root]);
    const directory = resolve(root, 'apps/web/e2e/tmp/runs/example');
    mkdirSync(resolve(directory, 'assets'), { recursive: true });
    const artifact = resolve(directory, 'assets/step.png');
    writeFileSync(artifact, Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2D4sAAAAASUVORK5CYII=', 'base64'));
    const run = { schema_version: 1, run_id: 'example', repository_id: 'fixture', target_id: 'web', worktree: root, target_path: 'apps/web', revision: 'a'.repeat(40), dirty: true, started_at: '2026-10-18T10:00:00Z', finished_at: '2026-10-18T10:00:02Z', status: 'passed', cases: [{ id: 'case-one', scenario_id: 'show-result', spec: { path: 'e2e/example.spec.ts', sha256: 'b'.repeat(64) }, scenario: 'show result', profile: 'mobile', attempt: 1, status: 'passed', steps: [{ id: 'result', title: 'Then result is visible', status: 'passed' }] }], limitations: [] };
    const evidence = { schema_version: 2, run_id: 'example', items: [{ id: 'result-image', case_id: 'case-one', step_id: 'result', captured_at: '2026-10-18T10:00:01Z', kind: 'screenshot', path: 'assets/step.png', sha256: hash(artifact), mime: 'image/png', description: 'Result after action', conditions: { viewport: { width: 390, height: 844 }, dpr: 1, theme: 'light', locale: 'ru', state: 'result' } }] };
    const save = () => { writeFileSync(resolve(directory, 'run.json'), JSON.stringify(run)); writeFileSync(resolve(directory, 'evidence.json'), JSON.stringify(evidence)); };
    const check = () => { save(); return validateRun(resolve(root, 'apps/web'), 'example'); };
    action({ root, directory, artifact, run, evidence, check });
  } finally { rmSync(root, { recursive: true, force: true }); }
}
