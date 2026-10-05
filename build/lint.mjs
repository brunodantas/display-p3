import { converter, wcagContrast } from 'culori';

const oklch = converter('oklch');

// A light neutral glares on a bright wide-gamut panel; dark neutrals and shadows are fine.
const isLightNeutral = ({ l, c = 0 }) => c < 0.008 && l > 0.6;

const rgbOf = (hex) => hex.slice(0, 7).toLowerCase();

const lightnessAndChroma = ({ l, c = 0 }) => `L ${l.toFixed(3)}, C ${c.toFixed(4)}`;

/** Reports every rule a compiled theme breaks, measuring the emitted hex rather than the palette's numbers. */
export function lint(theme, report) {
  const background = theme.colors['editor.background'];
  for (const [key, hex] of themeColors(theme)) {
    // Exempting the background keeps a light flavor's paper legal.
    if (background && rgbOf(hex) === rgbOf(background)) continue;
    const measured = oklch(rgbOf(hex));
    if (isLightNeutral(measured)) {
      report(key, `light neutral ${hex} (${lightnessAndChroma(measured)})`);
    }
  }
  lintBrightWhite(theme.colors, report);
  lintContrast(theme, report);
  lintPale(theme, report);
}

// Below this chroma a light color stops reading as a hue, so code in it loses its syntax color.
const isPale = ({ l, c = 0 }) => l > 0.6 && c < 0.06;

const isComment = (selector) => selector === 'comment' || selector.startsWith('comment.');

// The keywords rule borrows a few keyword.operator scopes, so only a rule made entirely of operators is exempt.
const isOperator = (selector) => /^(keyword\.operator|punctuation)(\.|$)/.test(selector);

// Comments and operators recede on purpose, and a light neutral is already reported as one.
function lintPale(theme, report) {
  const code = [
    ['editor.foreground', theme.colors['editor.foreground']],
    ...tokenForegrounds(theme).filter(([, , selectors]) => !selectors.some(isComment) && !selectors.every(isOperator)),
  ];
  for (const [key, hex] of code) {
    if (typeof hex !== 'string') continue;
    const measured = oklch(rgbOf(hex));
    if (isPale(measured) && !isLightNeutral(measured)) {
      report(key, `pale ${hex} (${lightnessAndChroma(measured)})`);
    }
  }
}

// WCAG 2 floors; line numbers have none, because every flavor keeps them dim on purpose.
const textFloor = 7;
const tokenFloor = 4.5;
const commentFloor = 3;

// Compositing would make a floor depend on what sits under the editor, so an alpha fails outright.
function lintContrast(theme, report) {
  const background = theme.colors['editor.background'];
  if (!background) return;
  const floored = [
    ['editor.foreground', theme.colors['editor.foreground'], textFloor],
    ...tokenForegrounds(theme).map(([key, hex, selectors]) => [key, hex, selectors.some(isComment) ? commentFloor : tokenFloor]),
  ];
  for (const [key, hex, floor] of floored) {
    if (typeof hex !== 'string') continue;
    if (hex.length > 7) {
      report(key, `${hex} has an alpha channel, so it cannot be held to the ${floor}:1 floor`);
      continue;
    }
    const ratio = wcagContrast(hex, rgbOf(background));
    // Truncating keeps a ratio just under the floor from printing as the floor itself.
    if (ratio < floor) {
      report(key, `${hex} has contrast ${(Math.floor(ratio * 100) / 100).toFixed(2)}:1 against ${background}, under the ${floor}:1 floor`);
    }
  }
}

// CLI tools use bright white for emphasis, so a tint must not let another ANSI color outshine it.
function lintBrightWhite(colors, report) {
  const brightWhite = colors['terminal.ansiBrightWhite'];
  if (!brightWhite) return;
  const lightness = (hex) => oklch(rgbOf(hex)).l;
  const rivals = Object.entries(colors).filter(
    ([key, hex]) => key.startsWith('terminal.ansi') && key !== 'terminal.ansiBrightWhite' && lightness(hex) >= lightness(brightWhite),
  );
  for (const [key, hex] of rivals) {
    report(
      'terminal.ansiBrightWhite',
      `bright white ${brightWhite} (L ${lightness(brightWhite).toFixed(3)}) is not lighter than ${key} ${hex} (L ${lightness(hex).toFixed(3)})`,
    );
  }
}

/** Every color a theme emits as [key, hex], naming token rules by their name. */
export function themeColors(theme) {
  return [...Object.entries(theme.colors), ...tokenForegrounds(theme).map(([key, hex]) => [key, hex])].filter(
    ([, hex]) => typeof hex === 'string',
  );
}

// A semantic token's name doubles as its selector, so comments match the same way in both lists.
function tokenForegrounds({ tokenColors, semanticTokenColors }) {
  return [
    ...tokenColors.map((rule) => [rule.name, rule.settings.foreground, rule.scope]),
    ...Object.entries(semanticTokenColors).map(([name, value]) => [
      `semanticTokenColors.${name}`,
      typeof value === 'string' ? value : value.foreground,
      [name],
    ]),
  ];
}
