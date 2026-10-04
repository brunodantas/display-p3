// `npm run preview [ref]` writes preview/index.html, putting each flavor's theme colors at a git ref (default main) next to the build output.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { build } from './build.mjs';
import { themeColors } from './lint.mjs';

const root = path.join(import.meta.dirname, '..');
const ref = process.argv[2] ?? 'main';
const outDir = path.join(root, 'preview');
const template = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, 'template.json'), 'utf8'));
const { flavors, violations } = build(template, path.join(root, 'palettes'));

// A flavor the ref doesn't have yet shows every color as new.
function themeAt(file) {
  try {
    return JSON.parse(execFileSync('git', ['show', `${ref}:themes/${file}`], { cwd: root, encoding: 'utf8', stdio: 'pipe' }));
  } catch {
    return null;
  }
}

const escape = (s) => String(s).replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);

const swatch = (hex, background) =>
  hex
    ? `<span class="chip" style="background:${background}"><span style="background:${hex}"></span></span><code>${hex}</code>`
    : '<span class="chip none"></span><code>none</code>';

const sample = (theme, label) =>
  theme
    ? `<div class="sample" style="background:${theme.colors['editor.background']};color:${theme.colors['editor.foreground']}">${label}: editor text on its background</div>`
    : `<div class="sample none">${label}: no theme at ${escape(ref)}</div>`;

function flavorSection({ flavor, file, json }) {
  const after = JSON.parse(json);
  const before = themeAt(file);
  const beforeColors = new Map(before ? themeColors(before) : []);
  const rows = themeColors(after).map(([key, hex]) => ({ key, before: beforeColors.get(key), after: hex }));
  const changed = rows.filter((r) => r.before?.toLowerCase() !== r.after.toLowerCase());
  const unchanged = rows.filter((r) => !changed.includes(r));
  const row = ({ key, before: b, after: a }) =>
    `<tr><td>${escape(key)}</td><td>${swatch(b, before?.colors['editor.background'])}</td><td>${swatch(a, after.colors['editor.background'])}</td></tr>`;
  const table = (list) => `<table><tr><th>Key</th><th>${escape(ref)}</th><th>Build</th></tr>${list.map(row).join('')}</table>`;
  return `<section>
  <h2>${escape(flavor)} <small>${changed.length} changed, ${unchanged.length} unchanged</small></h2>
  <div class="samples">${sample(before, escape(ref))}${sample(after, 'Build')}</div>
  ${changed.length ? table(changed) : '<p>No color changed.</p>'}
  ${unchanged.length ? `<details><summary>Unchanged colors</summary>${table(unchanged)}</details>` : ''}
</section>`;
}

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Flavor Preview</title>
<style>
  :root { --bg: #f6f5f2; --fg: #22201c; --line: #d9d5cc; --muted: #6b665c; }
  @media (prefers-color-scheme: dark) { :root { --bg: #1b1c22; --fg: #e4e2dc; --line: #34363f; --muted: #9a978f; } }
  body { margin: 0 auto; max-width: 960px; padding: 24px 16px; background: var(--bg); color: var(--fg); font: 14px/1.5 -apple-system, system-ui, sans-serif; }
  h1 { font-size: 20px; } h2 { font-size: 16px; margin-top: 40px; } small, .note { color: var(--muted); font-weight: normal; }
  .samples { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 12px; }
  .sample { padding: 12px; border-radius: 6px; font-family: ui-monospace, monospace; }
  .sample.none { border: 1px dashed var(--line); color: var(--muted); }
  table { width: 100%; border-collapse: collapse; }
  th, td { text-align: left; padding: 4px 8px; border-bottom: 1px solid var(--line); vertical-align: middle; }
  td:first-child { font-family: ui-monospace, monospace; font-size: 12px; overflow-wrap: anywhere; }
  .chip { display: inline-block; width: 40px; height: 20px; padding: 4px; border-radius: 4px; border: 1px solid var(--line); vertical-align: middle; margin-right: 8px; }
  .chip span { display: block; width: 100%; height: 100%; border-radius: 2px; }
  .chip.none { background: repeating-linear-gradient(45deg, transparent 0 4px, var(--line) 4px 6px); }
  code { font-size: 12px; }
  .violations { color: #b3261e; }
</style>
</head>
<body>
<h1>Flavor preview</h1>
<p class="note">Theme files at <code>${escape(ref)}</code> next to the build of the working tree. Each chip sits on its own flavor's editor background.</p>
${violations.length ? `<ul class="violations">${violations.map((v) => `<li>${escape(`${v.flavor}: ${v.key}: ${v.message}`)}</li>`).join('')}</ul>` : ''}
${flavors.map(flavorSection).join('\n')}
</body>
</html>
`;

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'index.html'), html);
console.log(`wrote ${path.relative(root, path.join(outDir, 'index.html'))}, comparing the build with ${ref}`);
