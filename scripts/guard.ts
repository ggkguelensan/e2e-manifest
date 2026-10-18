import { execFileSync } from 'node:child_process';
if (process.env.E2E_MANIFEST_DEV !== '1' || execFileSync('git', ['branch', '--show-current'], { encoding: 'utf8' }).trim() !== 'dev') {
  console.error('Commit/push of the manifest requires dev and E2E_MANIFEST_DEV=1. Consumer main is read-only.');
  process.exitCode = 1;
}
