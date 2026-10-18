import './evidence.ts';
import './adaptation.ts';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const failures: string[] = [];
const files: string[] = [];
function scan(directory: string) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (['.git', 'node_modules', 'workdir', 'tmp'].includes(entry.name)) continue;
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) scan(path);
    else if (entry.isFile()) files.push(path);
  }
}
scan(root);
for (const file of files) {
  const text = readFileSync(file, 'utf8');
  if (file.endsWith('.json')) {
    try { JSON.parse(text); } catch { failures.push(`${relative(root, file)}: invalid JSON`); }
  }
  if (!file.endsWith('.md')) continue;
  // Inline repository links; external URLs are intentionally not requested.
  for (const match of text.matchAll(/\]\(([^\s)]+)\)/g)) {
    const href = match[1];
    if (/^[a-z]+:/i.test(href)) continue;
    const [path, anchor] = decodeURIComponent(href).split('#');
    const target = path ? resolve(dirname(file), path) : file;
    if (!existsSync(target)) {
      failures.push(`${relative(root, file)}: missing ${href}`); continue;
    }
    if (anchor && target.endsWith('.md')) {
      const headings = [...readFileSync(target, 'utf8').matchAll(/^#+\s+(.+)$/gm)].map(m => m[1].toLowerCase().replace(/[^\p{L}\p{N}_\- ]/gu, '').replaceAll(' ', '-'));
      if (!headings.includes(anchor)) failures.push(`${relative(root, file)}: missing anchor ${href}`);
    }
  }
}
if (failures.length) { console.error(failures.join('\n')); process.exitCode = 1; }
else console.log('Local Markdown links/anchors, JSON syntax and run/evidence schema compilation checked. Data validation is separate.');
