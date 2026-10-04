// `npm run build` writes the compiled theme files; `npm run check` compares them with the committed ones instead.
import fs from 'node:fs';
import path from 'node:path';
import { build } from './build.mjs';

const root = path.join(import.meta.dirname, '..');
const themesDir = path.join(root, 'themes');
const template = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, 'template.json'), 'utf8'));
const check = process.argv.includes('--check');

const { flavors, violations } = build(template, path.join(root, 'palettes'), check ? themesDir : undefined);

if (!check) {
  for (const { file, json } of flavors) fs.writeFileSync(path.join(themesDir, file), json);
}
for (const { flavor, key, message } of violations) console.error(`${flavor}: ${key}: ${message}`);
if (violations.length > 0) {
  console.error(`${violations.length} violation(s)`);
  process.exitCode = 1;
} else {
  console.log(`${flavors.length} flavor(s) ${check ? 'match their committed theme files' : 'written'}`);
}
