import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { wcagContrast } from 'culori';
import { SAMPLE, windowHtml } from '../build/mock.mjs';

const themesDir = path.join(import.meta.dirname, '..', 'themes');
const readTheme = (file) => JSON.parse(fs.readFileSync(path.join(themesDir, file), 'utf8'));

// Plain tokens stand in for Shiki's, so these tests check the window and not the grammar.
const plainTokens = (theme) =>
  SAMPLE.split('\n').map((line) => [{ content: line, color: theme.colors['editor.foreground'], fontStyle: 0 }]);

const render = (theme) => windowHtml({ theme, label: 'Display P3 - Fixture', tokens: plainTokens(theme) });

test('every flavor renders a mock window from colors it sets or VS Code defaults', () => {
  for (const file of fs.readdirSync(themesDir).filter((f) => f.endsWith('.json'))) {
    const theme = readTheme(file);
    const html = render(theme);
    assert.match(html, new RegExp(`--editor-background: ${theme.colors['editor.background']};`), file);
  }
});

test('an unset key falls back to the VS Code default for the theme type', () => {
  const dark = readTheme('Dracula P3.json');
  const light = readTheme('Artisan Paper P3.json');
  assert.equal(dark.colors['editorError.foreground'], undefined);
  assert.match(render(dark), /--editorError-foreground: #f14c4c;/);
  assert.match(render(light), /--editorError-foreground: #e51400;/);
});

test('a key with no color and no default fails with the flavor and key', () => {
  const theme = readTheme('Dracula P3.json');
  delete theme.colors['tab.activeBackground'];
  assert.throws(() => render(theme), /Display P3 — Dracula.*tab\.activeBackground/);
});

test('terminal colors are lifted to the 4.5:1 minimum contrast VS Code applies by default', () => {
  const theme = readTheme('Dracula P3.json');
  const black = render(theme).match(/--terminal-ansiBlack: (#[0-9a-f]{6});/)[1];
  assert.notEqual(black, theme.colors['terminal.ansiBlack']);
  assert.ok(wcagContrast(black, theme.colors['terminal.background']) >= 4.5, black);
  const green = theme.colors['terminal.ansiGreen'];
  assert.match(render(theme), new RegExp(`--terminal-ansiGreen: ${green};`));
});

test('a mark that crosses token boundaries covers exactly its text', () => {
  const theme = readTheme('Dracula P3.json');
  const perChar = SAMPLE.split('\n').map((line) => [...line].map((ch) => ({ content: ch, color: '#ffffff', fontStyle: 0 })));
  const html = windowHtml({ theme, label: 'Display P3 - Fixture', tokens: perChar });
  const selected = [...html.matchAll(/<span class="sel"[^>]*>([^<]*)<\/span>/g)].map((m) => m[1]).join('');
  assert.equal(selected, 'swatch.name');
});

test('the error squiggle, selection and cursor land on the sample lines that name them', () => {
  const html = render(readTheme('Dracula P3.json'));
  assert.match(html, /<span class="err"[^>]*>fallback<\/span>/);
  assert.match(html, /<span class="sel"[^>]*>swatch\.name<\/span>/);
  assert.equal(html.match(/class="cursor"/g).length, 1);
});
