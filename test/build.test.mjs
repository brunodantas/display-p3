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
    { 'editor.background': 'background', 'editor.foreground': 'code' },
    { 'badge.background': 'text', 'badge.foreground': 'background' },
  ],
  syntax: {
    comments: { scope: ['comment'], foreground: 'comment', fontStyle: 'italic' },
  },
  semanticTokenColors: { comment: { foreground: 'comment', italic: true } },
  tint: {
    text: { lightness: 0.9, chroma: 0.025 },
    code: { lightness: 0.8, chroma: 0.095 },
    brightWhite: { lightness: 0.975, chroma: 0.01 },
  },
};

// A pink that converts to #ff00aa inside sRGB.
const pink = [0.6597, 0.2755, 349.6];
// Dracula's background, which converts to #1e1f29 at hue 280.4.
const night = [0.243, 0.019, 280.4];

const palette = (changes = {}) => ({
  name: 'Display P3 — Fixture',
  type: 'dark',
  swatches: { black: [0, 0, 0], night, text: { tint: 'text' }, code: { tint: 'code' }, pink },
  roles: { background: 'night', text: 'text', code: 'code', comment: 'pink' },
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

const buildOne = (p, committed, from = template) => {
  const result = build(from, tempDir({ 'Fixture P3.json': p }), committed && tempDir(committed));
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

test('every flavor is named Display P3 followed by its flavor name', () => {
  const { flavors } = build(realTemplate, path.join(root, 'palettes'));
  for (const { file, json } of flavors) {
    assert.equal(JSON.parse(json).name, `Display P3 — ${file.replace(/ P3\.json$/, '')}`, file);
  }
});

test('a role bound with an alpha keeps the alpha byte after the converted color', () => {
  const { theme, violations } = buildOne(palette({ roles: { background: 'night', text: 'text', code: 'pink/1f', comment: 'pink' } }));
  assert.deepEqual(violations.map((v) => v.key), ['editor.foreground']);
  assert.equal(theme.colors['editor.foreground'], '#ff00aa1f');
  assert.equal(theme.colors['editor.background'], '#1e1f29');
});

test('a per-key override replaces one key and leaves the rest of its role alone', () => {
  const { theme, violations } = buildOne(palette({ overrides: { 'badge.foreground': 'pink/d4' } }));
  assert.deepEqual(violations, []);
  assert.equal(theme.colors['badge.foreground'], '#ff00aad4');
  assert.equal(theme.colors['editor.background'], '#1e1f29');
});

test('syntax rules come out in palette order with template scopes, then extra rules', () => {
  const extra = { name: 'Fixture: Tags', scope: ['entity.name.tag'], color: 'pink/80' };
  const { theme, violations } = buildOne(palette({ syntax: [{ rule: 'comments', name: 'Fixture: Comments' }, extra] }));
  assert.deepEqual(violations.map((v) => v.key), ['Fixture: Tags']);
  assert.deepEqual(theme.tokenColors, [
    { name: 'Fixture: Comments', scope: ['comment'], settings: { foreground: '#ff00aa', fontStyle: 'italic' } },
    { name: 'Fixture: Tags', scope: ['entity.name.tag'], settings: { foreground: '#ff00aa80' } },
  ]);
  assert.deepEqual(theme.semanticTokenColors, { comment: { foreground: '#ff00aa', italic: true } });
});

test('unresolvable references are violations naming the flavor and key', () => {
  const { violations } = buildOne(palette({
    roles: { background: 'night', text: 'grey', code: 'grey', comment: 'pink' },
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
    swatches: { night, text: { tint: 'text' }, code: { tint: 'code' }, dim: { tint: 'text', lightness: 0.7 }, pink },
    roles: { background: 'night', text: 'text', code: 'code', comment: 'dim' },
  }));
  assert.deepEqual(violations, []);
  assert.equal(theme.colors['badge.background'], '#daddef');
  assert.equal(theme.tokenColors[0].settings.foreground, '#9b9dae');
});

test('a flavor changes either tint number per strength, and the hue for every strength', () => {
  const swatches = { night, text: { tint: 'text' }, code: { tint: 'code' }, bright: { tint: 'brightWhite' }, pink };
  const roles = { background: 'night', text: 'text', code: 'code', comment: 'bright' };
  const lighter = buildOne(palette({ swatches, roles, tint: { text: { lightness: 0.95, chroma: 0.018 } } }));
  assert.deepEqual(lighter.violations, []);
  assert.equal(lighter.theme.colors['badge.background'], '#ecedfb');
  assert.equal(lighter.theme.tokenColors[0].settings.foreground, '#f5f6fe');
  const yellow = buildOne(palette({ swatches, roles, tint: { hue: 106.5, text: { lightness: 0.977 } } }));
  assert.deepEqual(yellow.violations, []);
  assert.equal(yellow.theme.colors['badge.background'], '#f9f9e6');
  assert.equal(yellow.theme.tokenColors[0].settings.foreground, '#f7f7f0');
});

test('a tint with no background hue, or naming an unknown strength, is a violation', () => {
  const { violations } = buildOne(palette({
    swatches: { black: [0, 0, 0], text: { tint: 'text' }, odd: { tint: 'glow' }, pink },
    roles: { background: 'black', text: 'text', code: 'text', comment: 'odd' },
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
    roles: { background: 'night', text: 'white', code: 'white', comment: 'white/08' },
  }));
  assert.deepEqual(violations, [
    { flavor: 'Fixture P3', key: 'editor.foreground', message: 'light neutral #ffffff (L 1.000, C 0.0000)' },
    { flavor: 'Fixture P3', key: 'badge.background', message: 'light neutral #ffffff (L 1.000, C 0.0000)' },
    { flavor: 'Fixture P3', key: 'Fixture: Comments', message: 'light neutral #ffffff08 (L 1.000, C 0.0000)' },
    { flavor: 'Fixture P3', key: 'semanticTokenColors.comment', message: 'light neutral #ffffff08 (L 1.000, C 0.0000)' },
    { flavor: 'Fixture P3', key: 'Fixture: Comments', message: '#ffffff08 has an alpha channel, so it cannot be held to the 3:1 floor' },
    { flavor: 'Fixture P3', key: 'semanticTokenColors.comment', message: '#ffffff08 has an alpha channel, so it cannot be held to the 3:1 floor' },
  ]);
});

test('a light value just under the chroma floor fails, and one just above it passes', () => {
  // Chroma 0.008 rounds to #f8f8f2, which measures C 0.0079.
  const lightValue = (c) => buildOne(palette({
    swatches: { night, text: [0.977, c, 106.5], code: { tint: 'code' }, pink },
    roles: { background: 'night', text: 'text', code: 'code', comment: 'pink' },
  })).violations.map((v) => v.key);
  assert.deepEqual(lightValue(0.008), ['badge.background']);
  assert.deepEqual(lightValue(0.0095), []);
});

test('dark neutrals and black shadows pass', () => {
  const { violations } = buildOne(palette({
    swatches: { night, black: [0, 0, 0], grey: [0.6, 0, 0], text: { tint: 'text' }, code: { tint: 'code' } },
    roles: { background: 'night', text: 'text', code: 'code', comment: 'grey' },
    overrides: { 'badge.background': 'black/80' },
  }));
  assert.deepEqual(violations, []);
});

test('the background color itself is exempt, wherever it is used', () => {
  // Artisan Paper's paper, #fdfaf5, measures C 0.0073.
  const { violations } = buildOne(palette({
    type: 'light',
    swatches: { paper: [0.986, 0.007, 80.7], ink: [0.272, 0.009, 67.4], pink },
    roles: { background: 'paper', text: 'ink', code: 'ink', comment: 'ink' },
    overrides: { 'badge.background': 'paper/80', 'badge.foreground': 'paper' },
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
      swatches: { night, text: { tint: 'text' }, code: { tint: 'code' }, bright: { tint: 'brightWhite' }, pink },
      roles: { background: 'night', text: 'text', code: 'code', comment: 'pink', ansiDim: 'pink', brightWhite: 'bright' },
      tint,
    }),
  })).violations.map((v) => v.key);
  assert.deepEqual(ansi(undefined), []);
  assert.deepEqual(ansi({ brightWhite: { lightness: 0.9, chroma: 0.025 } }), ['terminal.ansiBrightWhite']);
  assert.deepEqual(ansi({ brightWhite: { lightness: 0.85 } }), ['terminal.ansiBrightWhite']);
});

test('max chroma lands on the gamut edge, which at a primary\'s own lightness and hue is the primary', () => {
  // The OKLCH lightness and hue of sRGB red, green and blue, from Ottosson's reference conversion.
  const edge = (l, h) => buildOne(palette({
    swatches: { night, text: { tint: 'text' }, code: { tint: 'code' }, pink, signal: [l, 'max', h] },
    roles: { background: 'night', text: 'text', code: 'code', comment: 'pink' },
    overrides: { 'badge.background': 'signal' },
  }));
  for (const [[l, h], hex] of [
    [[0.627955, 29.2339], '#ff0000'],
    [[0.86644, 142.4953], '#00ff00'],
    [[0.452014, 264.052], '#0000ff'],
  ]) {
    const { theme, violations } = edge(l, h);
    assert.deepEqual(violations, []);
    assert.equal(theme.colors['badge.background'], hex);
  }
});

test('a swatch outside sRGB without max is one violation naming the flavor, swatch and values', () => {
  // A cyan that needs a red channel of -0.03.
  const { violations } = buildOne(palette({
    swatches: { night, text: { tint: 'text' }, code: { tint: 'code' }, cyan: [0.905, 0.155, 194.8] },
    roles: { background: 'night', text: 'text', code: 'code', comment: 'cyan' },
  }));
  assert.deepEqual(violations, [
    { flavor: 'Fixture P3', key: 'swatches.cyan', message: 'oklch(0.905 0.155 194.8) is outside sRGB, so lower its chroma or set it to "max"' },
  ]);
});

// Each pair of lightnesses passed to this is one 8-bit step apart, straddling a floor.
const tinted = (lightness) => ({ tint: 'text', lightness });

// The text tint near a floor is also pale, which is a separate rule with its own tests.
const floorViolations = (swatches, roles, extraRules = []) => {
  const withFloors = {
    ...template,
    colors: [...template.colors, { 'editorLineNumber.foreground': 'lineNumber' }],
    syntax: { ...template.syntax, keywords: { scope: ['keyword'], foreground: 'keyword' } },
    semanticTokenColors: { ...template.semanticTokenColors, variable: 'keyword' },
  };
  return buildOne(
    palette({
      swatches: { night, text: { tint: 'text' }, code: { tint: 'code' }, pink, ...swatches },
      roles: { background: 'night', text: 'text', code: 'code', comment: 'pink', keyword: 'pink', lineNumber: 'pink', ...roles },
      syntax: [{ rule: 'comments', name: 'Fixture: Comments' }, { rule: 'keywords', name: 'Fixture: Keywords' }, ...extraRules],
    }),
    undefined,
    withFloors,
  ).violations.filter((v) => !v.message.startsWith('pale'));
};

test('editor text under 7:1 against the editor background is a violation naming the measured ratio', () => {
  assert.deepEqual(floorViolations({ code: tinted(0.737) }, {}), [
    { flavor: 'Fixture P3', key: 'editor.foreground', message: '#a6a8ba has contrast 6.96:1 against #1e1f29, under the 7:1 floor' },
  ]);
  assert.deepEqual(floorViolations({ code: tinted(0.7371) }, {}), []);
});

test('syntax tokens, semantic ones included, need 4.5:1', () => {
  const message = '#838596 has contrast 4.48:1 against #1e1f29, under the 4.5:1 floor';
  assert.deepEqual(floorViolations({ keyword: tinted(0.6221) }, { keyword: 'keyword' }), [
    { flavor: 'Fixture P3', key: 'Fixture: Keywords', message },
    { flavor: 'Fixture P3', key: 'semanticTokenColors.variable', message },
  ]);
  assert.deepEqual(floorViolations({ keyword: tinted(0.6222) }, { keyword: 'keyword' }), []);
});

test('comments need only 3:1', () => {
  const message = '#676878 has contrast 2.98:1 against #1e1f29, under the 3:1 floor';
  assert.deepEqual(floorViolations({ comment: tinted(0.5231) }, { comment: 'comment' }), [
    { flavor: 'Fixture P3', key: 'Fixture: Comments', message },
    { flavor: 'Fixture P3', key: 'semanticTokenColors.comment', message },
  ]);
  assert.deepEqual(floorViolations({ comment: tinted(0.5232) }, { comment: 'comment' }), []);
});

test('a palette rule scoped to a kind of comment gets the comment floor, and other rules the token floor', () => {
  const rules = [
    { name: 'Fixture: Line Comments', scope: ['comment.line'], color: 'dim' },
    { name: 'Fixture: Commentary', scope: ['commentary'], color: 'dim' },
  ];
  assert.deepEqual(floorViolations({ dim: tinted(0.5232) }, {}, rules), [
    { flavor: 'Fixture P3', key: 'Fixture: Commentary', message: '#676978 has contrast 3.01:1 against #1e1f29, under the 4.5:1 floor' },
  ]);
});

test('a color under a floor with an alpha channel fails, even when opaque alpha would pass', () => {
  assert.deepEqual(floorViolations({}, { code: 'text/ff', keyword: 'pink/80' }), [
    { flavor: 'Fixture P3', key: 'editor.foreground', message: '#daddefff has an alpha channel, so it cannot be held to the 7:1 floor' },
    { flavor: 'Fixture P3', key: 'Fixture: Keywords', message: '#ff00aa80 has an alpha channel, so it cannot be held to the 4.5:1 floor' },
    { flavor: 'Fixture P3', key: 'semanticTokenColors.variable', message: '#ff00aa80 has an alpha channel, so it cannot be held to the 4.5:1 floor' },
  ]);
});

test('dim line numbers have no floor', () => {
  // #383948 measures 1.43:1, under every floor.
  assert.deepEqual(floorViolations({ lineNumber: tinted(0.35) }, { lineNumber: 'lineNumber' }), []);
});

const paleViolations = (swatches, roles, { colors = {}, syntax = [] } = {}) => {
  const withCode = {
    ...template,
    colors: [...template.colors, colors],
    syntax: { ...template.syntax, keywords: { scope: ['keyword'], foreground: 'keyword' }, operators: realTemplate.syntax.operators },
    semanticTokenColors: { ...template.semanticTokenColors, variable: 'keyword' },
  };
  return buildOne(
    palette({
      swatches: { night, text: { tint: 'text' }, code: { tint: 'code' }, pink, ...swatches },
      roles: { background: 'night', text: 'text', code: 'code', comment: 'pink', keyword: 'pink', ...roles },
      syntax: [{ rule: 'comments', name: 'Fixture: Comments' }, { rule: 'keywords', name: 'Fixture: Keywords' }, ...syntax],
    }),
    undefined,
    withCode,
  ).violations.filter((v) => v.message.startsWith('pale'));
};

test('code text above lightness 0.6 is pale, naming the flavor, key and measured values', () => {
  const pale = { flavor: 'Fixture P3', message: 'pale #7c7f92 (L 0.601, C 0.0290)' };
  assert.deepEqual(paleViolations({ grey: [0.6, 0.03, 280.4] }, { code: 'grey', keyword: 'grey' }), [
    { ...pale, key: 'editor.foreground' },
    { ...pale, key: 'Fixture: Keywords' },
    { ...pale, key: 'semanticTokenColors.variable' },
  ]);
  // #7c7e92 measures L 0.598.
  assert.deepEqual(paleViolations({ grey: [0.5995, 0.03, 280.4] }, { code: 'grey', keyword: 'grey' }), []);
});

test('code text under chroma 0.06 is pale, and at 0.06 it is a color', () => {
  assert.deepEqual(paleViolations({ lavender: [0.75, 0.059, 280.4] }, { keyword: 'lavender' }), [
    { flavor: 'Fixture P3', key: 'Fixture: Keywords', message: 'pale #a6aad3 (L 0.749, C 0.0590)' },
    { flavor: 'Fixture P3', key: 'semanticTokenColors.variable', message: 'pale #a6aad3 (L 0.749, C 0.0590)' },
  ]);
  // #a6aad4 measures C 0.0605.
  assert.deepEqual(paleViolations({ lavender: [0.75, 0.06, 280.4] }, { keyword: 'lavender' }), []);
});

test('comments, operators, UI text and terminal bright white may be pale', () => {
  const violations = paleViolations(
    { lavender: [0.75, 0.03, 280.4], bright: { tint: 'brightWhite' } },
    { text: 'lavender', comment: 'lavender', operator: 'lavender', brightWhite: 'bright' },
    {
      colors: { 'terminal.ansiBrightWhite': 'brightWhite' },
      syntax: [{ rule: 'operators', name: 'Fixture: Operators' }],
    },
  );
  assert.deepEqual(violations, []);
});

test('the template tints code at lightness 0.8 and chroma 0.095, which is not pale', () => {
  const { theme, violations } = buildOne(palette(), undefined, { ...template, tint: realTemplate.tint });
  assert.deepEqual(violations, []);
  assert.equal(theme.colors['editor.foreground'], '#b2b7fa');
});

test('a rule with only some operator scopes, like keywords, may not be pale', () => {
  const keywords = { name: 'Fixture: Keyword Operators', scope: ['keyword', 'keyword.operator.new'], color: 'lavender' };
  assert.deepEqual(paleViolations({ lavender: [0.75, 0.03, 280.4] }, {}, { syntax: [keywords] }), [
    { flavor: 'Fixture P3', key: 'Fixture: Keyword Operators', message: 'pale #aaacc1 (L 0.750, C 0.0301)' },
  ]);
});
