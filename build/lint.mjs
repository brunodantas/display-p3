import { converter } from 'culori';

const oklch = converter('oklch');

// A light neutral glares on a bright wide-gamut panel; dark neutrals and shadows are fine.
const isLightNeutral = ({ l, c = 0 }) => c < 0.008 && l > 0.6;

const rgbOf = (hex) => hex.slice(0, 7).toLowerCase();

/** Reports every rule a compiled theme breaks, measuring the emitted hex rather than the palette's numbers. */
export function lint(theme, report) {
  const background = theme.colors['editor.background'];
  for (const [key, hex] of themeColors(theme)) {
    // Exempting the background keeps a light flavor's paper legal.
    if (background && rgbOf(hex) === rgbOf(background)) continue;
    const measured = oklch(rgbOf(hex));
    if (isLightNeutral(measured)) {
      report(key, `light neutral ${hex} (L ${measured.l.toFixed(3)}, C ${(measured.c ?? 0).toFixed(4)})`);
    }
  }
  lintBrightWhite(theme.colors, report);
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
export function themeColors({ colors, tokenColors, semanticTokenColors }) {
  return [
    ...Object.entries(colors),
    ...tokenColors.map((rule) => [rule.name, rule.settings.foreground]),
    ...Object.entries(semanticTokenColors).map(([name, value]) => [
      `semanticTokenColors.${name}`,
      typeof value === 'string' ? value : value.foreground,
    ]),
  ].filter(([, hex]) => typeof hex === 'string');
}
