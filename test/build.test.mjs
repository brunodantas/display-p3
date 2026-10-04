import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { build } from '../build/build.mjs';

const root = path.join(import.meta.dirname, '..');
const realTemplate = JSON.parse(fs.readFileSync(path.join(root, 'build/template.json'), 'utf8'));

const template = {
  colors: [
    { 'editor.background': 'background', 'editor.foreground': 'text' },
    { 'badge.background': 'text', 'badge.foreground': 'background' },
  ],
  syntax: {
    comments: { scope: ['comment'], foreground: 'comment', fontStyle: 'italic' },
  },
  semanticTokenColors: { comment: { foreground: 'comment', italic: true } },
  tint: { text: { lightness: 0.9, chroma: 0.025 }, brightWhite: { lightness: 0.975, chroma: 0.01 } },
};

// Dracula's pink, which converts to #ff00aa.
const pink = [0.66, 0.276, 349.7];
// Dracula's background, which converts to #1e1f29 at hue 280.4.
const night = [0.243, 0.019, 280.4];

const palette = (changes = {}) => ({
  name: 'Display P3 — Fixture',
  type: 'dark',
  swatches: { black: [0, 0, 0], night, text: { tint: 'text' }, pink },
  roles: { background: 'night', text: 'text', comment: 'pink' },
  overrides: {},
  syntax: [{ rule: 'comments', name: 'Fixture: Comments' }],
  ...changes,
});

const tempDir = (files) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'display-p3-'));
  for (const [name, content] of Object.entries(files)) {
    fs.writeFileSync(path.join(dir, name), typeof content === 'string' ? content : JSON.stringify(content));
  }
  return dir;
};

const buildOne = (p, committed) => {
  const result = build(template, tempDir({ 'Fixture P3.json': p }), committed && tempDir(committed));
  return { ...result, theme: result.flavors[0] && JSON.parse(result.flavors[0].json) };
};

test('every committed flavor compiles from its palette byte for byte', () => {
  const { flavors, violations } = build(realTemplate, path.join(root, 'palettes'));
  assert.deepEqual(violations, []);
  assert.deepEqual(
    flavors.map((f) => f.file),
    fs.readdirSync(path.join(root, 'themes')).filter((f) => f.endsWith('.json')).sort(),
  );
  for (const { file, json } of flavors) {
    assert.equal(json, fs.readFileSync(path.join(root, 'themes', file), 'utf8'), file);
  }
});

test('a role bound with an alpha keeps the alpha byte after the converted color', () => {
  const { theme, violations } = buildOne(palette({ roles: { background: 'night', text: 'pink/1f', comment: 'pink' } }));
  assert.deepEqual(violations, []);
  assert.equal(theme.colors['editor.foreground'], '#ff00aa1f');
  assert.equal(theme.colors['editor.background'], '#1e1f29');
});

test('a per-key override replaces one key and leaves the rest of its role alone', () => {
  const { theme, violations } = buildOne(palette({ overrides: { 'badge.background': 'pink/d4' } }));
  assert.deepEqual(violations, []);
  assert.equal(theme.colors['badge.background'], '#ff00aad4');
  assert.equal(theme.colors['editor.foreground'], '#daddef');
});

test('syntax rules come out in palette order with template scopes, then extra rules', () => {
  const extra = { name: 'Fixture: Tags', scope: ['entity.name.tag'], color: 'text/80' };
  const { theme, violations } = buildOne(palette({ syntax: [{ rule: 'comments', name: 'Fixture: Comments' }, extra] }));
  assert.deepEqual(violations, []);
  assert.deepEqual(theme.tokenColors, [
    { name: 'Fixture: Comments', scope: ['comment'], settings: { foreground: '#ff00aa', fontStyle: 'italic' } },
    { name: 'Fixture: Tags', scope: ['entity.name.tag'], settings: { foreground: '#daddef80' } },
  ]);
  assert.deepEqual(theme.semanticTokenColors, { comment: { foreground: '#ff00aa', italic: true } });
});

test('unresolvable references are violations naming the flavor and key', () => {
  const { violations } = buildOne(palette({
    roles: { background: 'night', text: 'grey', comment: 'pink' },
    overrides: { 'editor.nonsense': 'black', 'badge.foreground': 'pink/zz' },
    syntax: [{ rule: 'strings', name: 'Fixture: Strings' }],
  }));
  const keys = violations.map((v) => `${v.flavor} ${v.key}`).sort();
  assert.deepEqual(keys, [
    'Fixture P3 badge.background',
    'Fixture P3 badge.foreground',
    'Fixture P3 editor.foreground',
    'Fixture P3 editor.nonsense',
    'Fixture P3 strings',
  ]);
});

test('a role the palette never binds is a violation', () => {
  const { violations } = buildOne(palette({ roles: { background: 'night', comment: 'pink' } }));
  assert.deepEqual(violations.map((v) => v.key).sort(), ['badge.background', 'editor.foreground']);
});

test('a committed file that differs from the build is a violation naming the flavor and key', () => {
  const { flavors } = buildOne(palette());
  const committed = JSON.parse(flavors[0].json);
  committed.colors['badge.foreground'] = '#123456';
  const { violations } = buildOne(palette(), { 'Fixture P3.json': JSON.stringify(committed, null, 2) });
  assert.deepEqual(violations.map((v) => `${v.flavor} ${v.key}`), ['Fixture P3 badge.foreground']);
});

test('a committed file that differs only in formatting is still a violation', () => {
  const { flavors } = buildOne(palette());
  const { violations } = buildOne(palette(), { 'Fixture P3.json': flavors[0].json.replace('\n\n', '\n') });
  assert.equal(violations.length, 1);
  assert.equal(violations[0].flavor, 'Fixture P3');
});

test('a compiled flavor with no committed file is a violation', () => {
  const { violations } = buildOne(palette(), {});
  assert.equal(violations.length, 1);
  assert.equal(violations[0].flavor, 'Fixture P3');
});

test('a tint swatch takes the background hue at the default strength, or its own lightness', () => {
  const { theme, violations } = buildOne(palette({
    swatches: { night, text: { tint: 'text' }, dim: { tint: 'text', lightness: 0.7 }, pink },
    roles: { background: 'night', text: 'text', comment: 'dim' },
  }));
  assert.deepEqual(violations, []);
  assert.equal(theme.colors['editor.foreground'], '#daddef');
  assert.equal(theme.colors['badge.background'], '#daddef');
  assert.equal(theme.tokenColors[0].settings.foreground, '#9b9dae');
});

test('a flavor changes either tint number per strength, and the hue for every strength', () => {
  const swatches = { night, text: { tint: 'text' }, bright: { tint: 'brightWhite' }, pink };
  const roles = { background: 'night', text: 'text', comment: 'bright' };
  const lighter = buildOne(palette({ swatches, roles, tint: { text: { lightness: 0.95, chroma: 0.018 } } }));
  assert.deepEqual(lighter.violations, []);
  assert.equal(lighter.theme.colors['editor.foreground'], '#ecedfb');
  assert.equal(lighter.theme.tokenColors[0].settings.foreground, '#f5f6fe');
  const yellow = buildOne(palette({ swatches, roles, tint: { hue: 106.5, text: { lightness: 0.977 } } }));
  assert.deepEqual(yellow.violations, []);
  assert.equal(yellow.theme.colors['editor.foreground'], '#f9f9e6');
  assert.equal(yellow.theme.tokenColors[0].settings.foreground, '#f7f7f0');
});

test('a tint with no background hue, or naming an unknown strength, is a violation', () => {
  const { violations } = buildOne(palette({
    swatches: { black: [0, 0, 0], text: { tint: 'text' }, odd: { tint: 'glow' }, pink },
    roles: { background: 'black', text: 'text', comment: 'odd' },
    tint: { glow: { lightness: 0.5 } },
  }));
  assert.deepEqual(violations.map((v) => v.key).sort(), [
    'badge.background',
    'comments',
    'editor.foreground',
    'semanticTokenColors.comment',
    'tint',
  ]);
});

test('a light neutral is a violation naming the flavor, key and measured values, opaque or alpha', () => {
  const { violations } = buildOne(palette({
    swatches: { night, white: [1, 0, 0], pink },
    roles: { background: 'night', text: 'white', comment: 'white/08' },
  }));
  assert.deepEqual(violations, [
    { flavor: 'Fixture P3', key: 'editor.foreground', message: 'light neutral #ffffff (L 1.000, C 0.0000)' },
    { flavor: 'Fixture P3', key: 'badge.background', message: 'light neutral #ffffff (L 1.000, C 0.0000)' },
    { flavor: 'Fixture P3', key: 'Fixture: Comments', message: 'light neutral #ffffff08 (L 1.000, C 0.0000)' },
    { flavor: 'Fixture P3', key: 'semanticTokenColors.comment', message: 'light neutral #ffffff08 (L 1.000, C 0.0000)' },
  ]);
});

test('a light value just under the chroma floor fails, and one just above it passes', () => {
  // Chroma 0.008 rounds to #f8f8f2, which measures C 0.0079.
  const lightValue = (c) => buildOne(palette({
    swatches: { night, text: [0.977, c, 106.5], pink },
    roles: { background: 'night', text: 'text', comment: 'pink' },
  })).violations.map((v) => v.key);
  assert.deepEqual(lightValue(0.008), ['editor.foreground', 'badge.background']);
  assert.deepEqual(lightValue(0.0095), []);
});

test('dark neutrals and black shadows pass', () => {
  const { violations } = buildOne(palette({
    swatches: { night, black: [0, 0, 0], grey: [0.6, 0, 0], text: { tint: 'text' } },
    roles: { background: 'night', text: 'text', comment: 'grey' },
    overrides: { 'badge.background': 'black/80' },
  }));
  assert.deepEqual(violations, []);
});

test('the background color itself is exempt, wherever it is used', () => {
  // Artisan Paper's paper, #fdfaf5, measures C 0.0073.
  const { violations } = buildOne(palette({
    type: 'light',
    swatches: { paper: [0.986, 0.007, 80.7], ink: [0.272, 0.009, 67.4], pink },
    roles: { background: 'paper', text: 'ink', comment: 'paper/80' },
    overrides: { 'badge.foreground': 'paper' },
  }));
  assert.deepEqual(violations, []);
});

test('bright white must be the lightest of the 16 ANSI colors', () => {
  const ansiNames = ['Black', 'Red', 'Green', 'Yellow', 'Blue', 'Magenta', 'Cyan', 'White'];
  const ansiKeys = Object.fromEntries(
    ansiNames.flatMap((n) => [[`terminal.ansi${n}`, 'ansiDim'], [`terminal.ansiBright${n}`, 'ansiDim']]),
  );
  const withAnsi = { ...template, colors: [...template.colors, { ...ansiKeys, 'terminal.ansiWhite': 'text', 'terminal.ansiBrightWhite': 'brightWhite' }] };
  const ansi = (tint) => build(withAnsi, tempDir({
    'Fixture P3.json': palette({
      swatches: { night, text: { tint: 'text' }, bright: { tint: 'brightWhite' }, pink },
      roles: { background: 'night', text: 'text', comment: 'pink', ansiDim: 'pink', brightWhite: 'bright' },
      tint,
    }),
  })).violations.map((v) => v.key);
  assert.deepEqual(ansi(undefined), []);
  assert.deepEqual(ansi({ brightWhite: { lightness: 0.9, chroma: 0.025 } }), ['terminal.ansiBrightWhite']);
  assert.deepEqual(ansi({ brightWhite: { lightness: 0.85 } }), ['terminal.ansiBrightWhite']);
});
