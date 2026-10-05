// Renders a flavor as a mock VS Code window, so README screenshots come from the theme files and stay repeatable.
import { wcagContrast, wcagLuminance } from 'culori';

export const SAMPLE = `import { readFile } from 'node:fs/promises';

// A swatch compiles from OKLCH to sRGB hex.
interface Swatch {
  name: string;
  chroma: number | 'max';
  hue: number;
}

export class Palette {
  #swatches = new Map<string, Swatch>();

  constructor(readonly flavor: string, readonly tint = 0.025) {}

  async load(path: string): Promise<number> {
    const raw = JSON.parse(await readFile(path, 'utf8'));
    for (const swatch of raw.swatches as Swatch[]) {
      this.#swatches.set(swatch.name, swatch);
    }
    return this.#swatches.size;
  }

  get(name: string): Swatch {
    return this.#swatches.get(name) ?? fallback;
  }
}`;

const ANSI = ['Black', 'Red', 'Green', 'Yellow', 'Blue', 'Magenta', 'Cyan', 'White'];

const KEYS = [
  'titleBar.activeBackground', 'titleBar.activeForeground', 'titleBar.border',
  'activityBar.background', 'activityBar.foreground', 'activityBar.inactiveForeground', 'activityBar.activeBorder',
  'activityBarBadge.background', 'activityBarBadge.foreground', 'badge.background', 'badge.foreground',
  'sideBar.background', 'sideBar.foreground', 'sideBar.border', 'sideBarTitle.foreground',
  'sideBarSectionHeader.background', 'sideBarSectionHeader.foreground', 'sideBarSectionHeader.border',
  'list.inactiveSelectionBackground', 'gitDecoration.modifiedResourceForeground', 'gitDecoration.untrackedResourceForeground',
  'editorGroupHeader.tabsBackground', 'editorGroupHeader.tabsBorder', 'tab.border',
  'tab.activeBackground', 'tab.activeForeground', 'tab.activeBorder', 'tab.inactiveBackground', 'tab.inactiveForeground',
  'breadcrumb.foreground', 'editor.background', 'editor.foreground',
  'editorLineNumber.foreground', 'editorLineNumber.activeForeground',
  'editor.lineHighlightBackground', 'editor.lineHighlightBorder', 'editor.selectionBackground',
  'editorCursor.foreground', 'editorIndentGuide.background', 'editorError.foreground', 'scrollbarSlider.background',
  'panel.background', 'panel.border', 'panelTitle.activeForeground', 'panelTitle.activeBorder', 'panelTitle.inactiveForeground',
  'terminal.background', 'terminal.foreground', 'terminalCursor.foreground',
  ...ANSI.flatMap((c) => [`terminal.ansi${c}`, `terminal.ansiBright${c}`]),
  'statusBar.background', 'statusBar.foreground', 'statusBar.border',
];

// VS Code's own defaults for the keys no flavor sets, so the mock draws what the editor would.
const DEFAULTS = {
  dark: { 'editorError.foreground': '#f14c4c' },
  light: { 'editorError.foreground': '#e51400' },
};

export const escape = (s) => s.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);
const cssVar = (key) => `--${key.replace(/\./g, '-')}`;

const MIN_TERMINAL_CONTRAST = 4.5;
const channels = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const toHex = (rgb) => `#${rgb.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
const darker = (rgb) => rgb.map((v) => Math.floor(v * 0.9));
const lighter = (rgb) => rgb.map((v) => Math.min(255, v + Math.ceil((255 - v) * 0.1)));

function stepUntil(rgb, background, step) {
  let color = toHex(rgb);
  while (wcagContrast(color, background) < MIN_TERMINAL_CONTRAST) {
    const next = toHex(step(channels(color)));
    if (next === color) break;
    color = next;
  }
  return color;
}

// VS Code's terminal lifts dim text to terminal.integrated.minimumContrastRatio, so this ports xterm's ensureContrastRatio.
function terminalColor(hex, background) {
  if (wcagContrast(hex, background) >= MIN_TERMINAL_CONTRAST) return hex;
  const rgb = channels(hex);
  const [first, second] = wcagLuminance(hex) < wcagLuminance(background) ? [darker, lighter] : [lighter, darker];
  const a = stepUntil(rgb, background, first);
  if (wcagContrast(a, background) >= MIN_TERMINAL_CONTRAST) return a;
  const b = stepUntil(rgb, background, second);
  return wcagContrast(a, background) > wcagContrast(b, background) ? a : b;
}

function colorVars(theme) {
  return KEYS.map((key) => {
    const color = theme.colors[key] ?? DEFAULTS[theme.type]?.[key];
    if (!color) throw new Error(`${theme.name} sets no ${key}, and the mock has no default for it`);
    const shown = key.startsWith('terminal.ansi') ? terminalColor(color, theme.colors['terminal.background']) : color;
    return `${cssVar(key)}: ${shown};`;
  }).join(' ');
}

const lines = SAMPLE.split('\n');
const lineOf = (text) => lines.findIndex((l) => l.includes(text));
const markOn = (text, cls) => {
  const line = lineOf(text);
  const start = lines[line].indexOf(text);
  return { line, start, end: start + text.length, cls };
};
const selection = markOn('swatch.name', 'sel');
const MARKS = [selection, markOn('fallback', 'err')];
const CURSOR = { line: selection.line, col: selection.end };

const indentOf = (i) => (lines[i].trim() ? lines[i].length - lines[i].trimStart().length : null);

// A blank line takes the shallower indent of its neighbours, which matches VS Code wherever both neighbours share an indent, as in SAMPLE.
function guideIndent(i) {
  if (indentOf(i) !== null) return indentOf(i);
  const near = (step) => {
    for (let j = i + step; j >= 0 && j < lines.length; j += step) if (indentOf(j) !== null) return indentOf(j);
    return 0;
  };
  return Math.min(near(-1), near(1));
}

function tokenSpan(text, token, cls) {
  const style = [`color:${token.color}`];
  if (token.fontStyle & 1) style.push('font-style:italic');
  if (token.fontStyle & 2) style.push('font-weight:bold');
  if (token.fontStyle & 4) style.push('text-decoration:underline');
  return `<span${cls ? ` class="${cls}"` : ''} style="${style.join(';')}">${escape(text)}</span>`;
}

function codeLine(tokens, i) {
  const marks = MARKS.filter((m) => m.line === i);
  const cuts = marks.flatMap((m) => [m.start, m.end]);
  let col = 0;
  let html = '';
  for (const token of tokens) {
    const end = col + token.content.length;
    const points = [...cuts.filter((c) => c > col && c < end), end].sort((a, b) => a - b);
    let from = col;
    for (const to of points) {
      const cls = marks.filter((m) => from >= m.start && from < m.end).map((m) => m.cls).join(' ');
      html += tokenSpan(token.content.slice(from - col, to - col), token, cls);
      from = to;
    }
    col = end;
  }
  const guides = [];
  for (let c = 0; c < guideIndent(i); c += 2) guides.push(`<i class="guide" style="left:${c}ch"></i>`);
  const cursor = CURSOR.line === i ? `<i class="cursor" style="left:${CURSOR.col}ch"></i>` : '';
  return `<div class="row${CURSOR.line === i ? ' current' : ''}"><span class="ln">${i + 1}</span><span class="code">${guides.join('')}${html || ' '}${cursor}</span></div>`;
}

const icon = (body, size = 24) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round">${body}</svg>`;
const ICONS = {
  files: '<path d="M13.5 3H7.5a1 1 0 0 0-1 1v13a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V8z"/><path d="M13.5 3v5h5"/><path d="M4 7v13a1 1 0 0 0 1 1h9"/>',
  search: '<circle cx="10.5" cy="10.5" r="6"/><path d="M15 15l5.5 5.5"/>',
  branch: '<circle cx="7" cy="5" r="2"/><circle cx="7" cy="19" r="2"/><circle cx="17" cy="7" r="2"/><path d="M7 7v10M17 9c0 5-6 4-9.5 8.5"/>',
  run: '<path d="M8 5l11 7-11 7z"/>',
  extensions: '<rect x="4" y="10" width="5" height="5"/><rect x="9" y="10" width="5" height="5"/><rect x="4" y="15" width="5" height="5"/><rect x="9" y="15" width="5" height="5"/><rect x="14.5" y="4.5" width="5" height="5"/>',
  chevron: '<path d="M9 6l6 6-6 6"/>',
};

const TREE = [
  { name: 'build', depth: 0, folder: false },
  { name: 'palettes', depth: 0, folder: false },
  { name: 'src', depth: 0, folder: true },
  { name: 'gamut.ts', depth: 1, git: 'M' },
  { name: 'palette.ts', depth: 1, selected: true },
  { name: 'preview.ts', depth: 1, git: 'U' },
  { name: 'themes', depth: 0, folder: false },
  { name: '.gitignore', depth: 0 },
  { name: 'package.json', depth: 0 },
  { name: 'README.md', depth: 0 },
];

function treeRow({ name, depth, folder, git, selected }) {
  const twistie = folder === undefined ? '<span class="twistie"></span>' : `<span class="twistie${folder ? ' open' : ''}">${icon(ICONS.chevron, 16)}</span>`;
  const gitClass = git === 'M' ? ' modified' : git === 'U' ? ' untracked' : '';
  return `<div class="item${selected ? ' selected' : ''}${gitClass}" style="padding-left:${12 + depth * 14}px">${twistie}<span class="name">${name}</span>${git ? `<span class="git">${git}</span>` : ''}</div>`;
}

const prompt = '<span class="t-blue t-bold">~/display-p3</span> <span class="t-magenta">main</span> %';

export function windowHtml({ theme, label, tokens }) {
  const ansiRow = (bright) =>
    ANSI.map((c) => `<span style="color:var(--terminal-ansi${bright ? 'Bright' : ''}${c})">${c.toLowerCase()}</span>`).join(' ');
  return `<div class="window ${theme.type}" style="${colorVars(theme)}">
  <div class="titlebar"><span class="lights"><i></i><i></i><i></i></span><span class="title">palette.ts — ${escape(label)}</span></div>
  <div class="body">
    <div class="activitybar">
      <span class="act active">${icon(ICONS.files)}</span><span class="act">${icon(ICONS.search)}</span>
      <span class="act">${icon(ICONS.branch)}<b class="actbadge">2</b></span><span class="act">${icon(ICONS.run)}</span><span class="act">${icon(ICONS.extensions)}</span>
    </div>
    <div class="sidebar">
      <div class="sidetitle">EXPLORER</div>
      <div class="section"><span class="twistie open">${icon(ICONS.chevron, 16)}</span>DISPLAY-P3</div>
      ${TREE.map(treeRow).join('\n      ')}
    </div>
    <div class="main">
      <div class="tabs"><span class="tab active">palette.ts<span class="close">×</span></span><span class="tab">gamut.ts<span class="dot">●</span></span><span class="tabfill"></span></div>
      <div class="breadcrumbs">src › palette.ts › Palette › load</div>
      <div class="editor"><div class="lines">${tokens.map(codeLine).join('')}</div><i class="slider"></i></div>
      <div class="panel">
        <div class="paneltabs"><span>PROBLEMS<b class="badge">1</b></span><span>OUTPUT</span><span>DEBUG CONSOLE</span><span class="active">TERMINAL</span></div>
        <div class="terminal">
          <div>${prompt} npm run check</div>
          <div class="t-green">16 flavor(s) match their committed theme files</div>
          <div>${ansiRow(false)}</div>
          <div>${ansiRow(true)}</div>
          <div>${prompt} <i class="tcursor"></i></div>
        </div>
      </div>
    </div>
  </div>
  <div class="statusbar"><span>${icon(ICONS.branch, 14)} main*</span><span>⊗ 1 &nbsp;⚠ 0</span><span class="spacer"></span><span>Ln ${CURSOR.line + 1}, Col ${CURSOR.col + 1}</span><span>Spaces: 2</span><span>UTF-8</span><span>LF</span><span>TypeScript</span></div>
</div>`;
}

const CSS = `
html, body { margin: 0; background: transparent; }
body { font: 13px/1.4 -apple-system, "SF Pro Text", "Helvetica Neue", sans-serif; -webkit-font-smoothing: antialiased; }
.window { width: 1000px; height: 840px; border-radius: 10px; overflow: hidden; display: grid; grid-template-rows: 34px 1fr 22px;
  box-shadow: 0 24px 64px rgba(0,0,0,.32), 0 0 0 1px rgba(0,0,0,.22); }
.titlebar { position: relative; display: flex; align-items: center; justify-content: center; background: var(--titleBar-activeBackground);
  color: var(--titleBar-activeForeground); border-bottom: 1px solid var(--titleBar-border); }
.lights { position: absolute; left: 14px; display: flex; gap: 8px; }
.lights i { width: 12px; height: 12px; border-radius: 50%; background: #ff5f57; }
.lights i:nth-child(2) { background: #febc2e; } .lights i:nth-child(3) { background: #28c840; }
.body { display: grid; grid-template-columns: 48px 210px 1fr; min-height: 0; }
.activitybar { background: var(--activityBar-background); display: flex; flex-direction: column; }
.act { position: relative; height: 48px; display: flex; align-items: center; justify-content: center; color: var(--activityBar-inactiveForeground); }
.act.active { color: var(--activityBar-foreground); box-shadow: inset 2px 0 var(--activityBar-activeBorder); }
.actbadge { position: absolute; right: 7px; bottom: 8px; min-width: 16px; height: 16px; border-radius: 8px; font: 600 9px/16px -apple-system, sans-serif;
  text-align: center; background: var(--activityBarBadge-background); color: var(--activityBarBadge-foreground); }
.sidebar { background: var(--sideBar-background); color: var(--sideBar-foreground); border-right: 1px solid var(--sideBar-border); overflow: hidden; }
.sidetitle { height: 35px; line-height: 35px; padding-left: 20px; font-size: 11px; color: var(--sideBarTitle-foreground); }
.section { height: 22px; display: flex; align-items: center; font-size: 11px; font-weight: 700; background: var(--sideBarSectionHeader-background);
  color: var(--sideBarSectionHeader-foreground); border-top: 1px solid var(--sideBarSectionHeader-border); }
.twistie { width: 16px; height: 16px; display: inline-flex; margin-right: 4px; }
.twistie.open svg { transform: rotate(90deg); }
.item { height: 22px; display: flex; align-items: center; padding-right: 12px; }
.item .name { flex: 1; }
.item.selected { background: var(--list-inactiveSelectionBackground); }
.item.modified { color: var(--gitDecoration-modifiedResourceForeground); }
.item.untracked { color: var(--gitDecoration-untrackedResourceForeground); }
.main { display: grid; grid-template-rows: 35px 22px 1fr 150px; min-width: 0; background: var(--editor-background); }
.tabs { display: flex; background: var(--editorGroupHeader-tabsBackground); box-shadow: inset 0 -1px var(--editorGroupHeader-tabsBorder); }
.tab { display: flex; align-items: center; gap: 10px; padding: 0 12px 0 16px; background: var(--tab-inactiveBackground);
  color: var(--tab-inactiveForeground); border-right: 1px solid var(--tab-border); }
.tab.active { background: var(--tab-activeBackground); color: var(--tab-activeForeground); box-shadow: inset 0 -1px var(--tab-activeBorder); }
.close { font-size: 15px; } .dot { font-size: 10px; }
.breadcrumbs { padding-left: 20px; line-height: 22px; color: var(--breadcrumb-foreground); }
.editor { position: relative; color: var(--editor-foreground); font: 15px/22px "SF Mono", Menlo, monospace; overflow: hidden; padding-top: 2px; }
.row { display: flex; height: 22px; white-space: pre; }
.ln { width: 46px; padding-right: 20px; text-align: right; color: var(--editorLineNumber-foreground); flex: none; }
.current .ln { color: var(--editorLineNumber-activeForeground); }
.code { position: relative; flex: 1; }
.current .code { background: var(--editor-lineHighlightBackground); box-shadow: inset 0 0 0 2px var(--editor-lineHighlightBorder); }
.guide { position: absolute; top: 0; bottom: 0; width: 1px; background: var(--editorIndentGuide-background); }
.cursor { position: absolute; top: 0; bottom: 0; width: 2px; background: var(--editorCursor-foreground); }
.sel { background: var(--editor-selectionBackground); }
.err { text-decoration: underline wavy var(--editorError-foreground); text-decoration-skip-ink: none; text-underline-offset: 4px; }
.slider { position: absolute; right: 0; top: 0; width: 14px; height: 38%; background: var(--scrollbarSlider-background); }
.panel { display: grid; grid-template-rows: 35px 1fr; background: var(--panel-background); border-top: 1px solid var(--panel-border); }
.paneltabs { display: flex; gap: 24px; padding-left: 20px; font-size: 11px; color: var(--panelTitle-inactiveForeground); }
.paneltabs span { display: flex; align-items: center; gap: 6px; }
.paneltabs .active { color: var(--panelTitle-activeForeground); box-shadow: inset 0 -1px var(--panelTitle-activeBorder); }
.badge { min-width: 16px; height: 16px; border-radius: 8px; font: 600 9px/16px -apple-system, sans-serif; text-align: center;
  background: var(--badge-background); color: var(--badge-foreground); }
.terminal { background: var(--terminal-background); color: var(--terminal-foreground); font: 13px/19px "SF Mono", Menlo, monospace; padding: 6px 20px; }
.terminal div { white-space: pre; }
.t-blue { color: var(--terminal-ansiBlue); } .t-magenta { color: var(--terminal-ansiMagenta); } .t-green { color: var(--terminal-ansiGreen); } .t-bold { font-weight: 700; }
.tcursor { display: inline-block; width: 8px; height: 16px; vertical-align: -3px; background: var(--terminalCursor-foreground); }
.statusbar { display: flex; align-items: center; gap: 14px; padding: 0 12px; font-size: 12px; background: var(--statusBar-background);
  color: var(--statusBar-foreground); border-top: 1px solid var(--statusBar-border); }
.statusbar span { display: flex; align-items: center; gap: 4px; } .statusbar .spacer { flex: 1; }
.shot { display: inline-block; padding: 24px 28px 44px; }
.grid { display: inline-grid; grid-template-columns: repeat(4, 360px); gap: 28px 24px; padding: 24px 28px 36px; }
.grid .window { zoom: 0.36; }
.grid figure { margin: 0; }
.grid figcaption { margin-top: 10px; text-align: center; font-size: 26px; font-weight: 500; color: #767676; }
`;

export function pageHtml(body) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>${CSS}</style></head><body>${body}</body></html>`;
}
