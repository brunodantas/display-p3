// `npm run screenshots` renders every flavor's mock window to images/<flavor>.png, plus images/grid.png with all of them.
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { createHighlighter } from 'shiki';
import { SAMPLE, escape, pageHtml, windowHtml } from './mock.mjs';

const root = path.join(import.meta.dirname, '..');
const outDir = path.join(root, 'images');
const { contributes } = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

const flavors = contributes.themes
  .map(({ label, path: file }) => ({ label, theme: JSON.parse(fs.readFileSync(path.join(root, file), 'utf8')) }))
  .sort((a, b) => a.theme.type.localeCompare(b.theme.type) || a.label.localeCompare(b.label));
const flavorName = (label) => label.replace(/^Display P3 - /, '');
const slug = (label) => flavorName(label).toLowerCase().replace(/[^a-z0-9]+/g, '-');

const highlighter = await createHighlighter({ themes: flavors.map((f) => f.theme), langs: ['typescript'] });
const windows = flavors.map(({ label, theme }) => ({
  label,
  html: windowHtml({ theme, label, tokens: highlighter.codeToTokens(SAMPLE, { lang: 'typescript', theme: theme.name }).tokens }),
}));

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1.5 });
const shoot = async (body, selector, file) => {
  await page.setContent(pageHtml(body));
  await page.locator(selector).screenshot({ path: path.join(outDir, file), omitBackground: true });
  console.log(`wrote images/${file}`);
};

fs.mkdirSync(outDir, { recursive: true });
for (const { label, html } of windows) await shoot(`<div class="shot">${html}</div>`, '.shot', `${slug(label)}.png`);
const tiles = windows.map(({ label, html }) => `<figure>${html}<figcaption>${escape(flavorName(label))}</figcaption></figure>`);
await shoot(`<div class="grid">${tiles.join('')}</div>`, '.grid', 'grid.png');
await browser.close();
