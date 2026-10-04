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
};

// Dracula's pink, which converts to #ff00aa.
const pink = [0.66, 0.276, 349.7];

const palette = (changes = {}) => ({
  name: 'Display P3 — Fixture',
  type: 'dark',
  swatches: { black: [0, 0, 0], white: [1, 0, 0], pink },
  roles: { background: 'black', text: 'white', comment: 'pink' },
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

test('the real palettes compile to the committed theme files byte for byte', () => {
  const { flavors, violations } = build(realTemplate, path.join(root, 'palettes'));
  assert.deepEqual(violations, []);
  assert.deepEqual(
    flavors.map((f) => f.file),
    fs.readdirSync(path.join(root, 'palettes')).filter((f) => f.endsWith('.json')).sort(),
  );
  for (const { file, json } of flavors) {
    assert.equal(json, fs.readFileSync(path.join(root, 'themes', file), 'utf8'), file);
  }
});

test('a role bound with an alpha keeps the alpha byte after the converted color', () => {
  const { theme, violations } = buildOne(palette({ roles: { background: 'black', text: 'pink/1f', comment: 'pink' } }));
  assert.deepEqual(violations, []);
  assert.equal(theme.colors['editor.foreground'], '#ff00aa1f');
  assert.equal(theme.colors['editor.background'], '#000000');
});

test('a per-key override replaces one key and leaves the rest of its role alone', () => {
  const { theme, violations } = buildOne(palette({ overrides: { 'badge.background': 'pink/d4' } }));
  assert.deepEqual(violations, []);
  assert.equal(theme.colors['badge.background'], '#ff00aad4');
  assert.equal(theme.colors['editor.foreground'], '#ffffff');
});

test('syntax rules come out in palette order with template scopes, then extra rules', () => {
  const extra = { name: 'Fixture: Tags', scope: ['entity.name.tag'], color: 'white/80' };
  const { theme, violations } = buildOne(palette({ syntax: [{ rule: 'comments', name: 'Fixture: Comments' }, extra] }));
  assert.deepEqual(violations, []);
  assert.deepEqual(theme.tokenColors, [
    { name: 'Fixture: Comments', scope: ['comment'], settings: { foreground: '#ff00aa', fontStyle: 'italic' } },
    { name: 'Fixture: Tags', scope: ['entity.name.tag'], settings: { foreground: '#ffffff80' } },
  ]);
  assert.deepEqual(theme.semanticTokenColors, { comment: { foreground: '#ff00aa', italic: true } });
});

test('unresolvable references are violations naming the flavor and key', () => {
  const { violations } = buildOne(palette({
    roles: { background: 'black', text: 'grey', comment: 'pink' },
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
  const { violations } = buildOne(palette({ roles: { background: 'black', comment: 'pink' } }));
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
