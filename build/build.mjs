import fs from 'node:fs';
import path from 'node:path';
import { formatHex } from 'culori';
import { formatTheme } from './format.mjs';

/**
 * Compiles every palette in paletteDir through the template into theme JSON text.
 * A reference that does not resolve is a violation rather than an error, and with
 * committedDir so is every difference from the committed theme file.
 */
export function build(template, paletteDir, committedDir) {
  const flavors = [];
  const violations = [];
  for (const file of fs.readdirSync(paletteDir).filter((f) => f.endsWith('.json')).sort()) {
    const flavor = path.basename(file, '.json');
    const report = (key, message) => {
      violations.push({ flavor, key, message });
    };
    const palette = JSON.parse(fs.readFileSync(path.join(paletteDir, file), 'utf8'));
    const json = compile(template, palette, report);
    flavors.push({ flavor, file, json });
    if (committedDir) compareWithCommitted(json, path.join(committedDir, file), report);
  }
  return { flavors, violations };
}

function compile(template, palette, report) {
  // Takes a swatch name with an optional alpha byte, like "pink/1f".
  const color = (ref, key) => {
    const [, swatchName, alpha = ''] = /^(\w+)(?:\/([0-9a-f]{2}))?$/.exec(ref) ?? [];
    if (!Object.hasOwn(palette.swatches, swatchName ?? '')) {
      report(key, `cannot resolve color "${ref}"`);
      return null;
    }
    const [l, c, h] = palette.swatches[swatchName];
    return formatHex({ mode: 'oklch', l, c, h }) + alpha;
  };
  const role = (name, key) => {
    if (Object.hasOwn(palette.roles, name)) return color(palette.roles[name], key);
    report(key, `role "${name}" is not bound`);
    return null;
  };

  const templateKeys = new Set(template.colors.flatMap(Object.keys));
  for (const key of Object.keys(palette.overrides)) {
    if (!templateKeys.has(key)) report(key, 'override for a key the template does not have');
  }

  const colorGroups = template.colors
    .map((group) =>
      Object.entries(group)
        .map(([key, roleName]) => [
          key,
          Object.hasOwn(palette.overrides, key) ? color(palette.overrides[key], key) : role(roleName, key),
        ])
        .filter(([, hex]) => hex !== null),
    )
    .filter((group) => group.length > 0);

  // A palette entry either names a template rule or carries its own scope and color.
  const tokenColors = palette.syntax.flatMap((entry) => {
    const key = entry.rule ?? entry.name;
    if (!entry.rule) {
      return [{ name: entry.name, scope: entry.scope, settings: settings(color(entry.color, key), entry.fontStyle) }];
    }
    const rule = template.syntax[entry.rule];
    if (!rule) {
      report(key, `unknown syntax rule "${entry.rule}"`);
      return [];
    }
    return [{ name: entry.name, scope: rule.scope, settings: settings(role(rule.foreground, key), rule.fontStyle) }];
  });

  const semanticTokenColors = Object.fromEntries(
    Object.entries(template.semanticTokenColors).map(([name, value]) => {
      const key = `semanticTokenColors.${name}`;
      return [name, typeof value === 'string' ? role(value, key) : { ...value, foreground: role(value.foreground, key) }];
    }),
  );

  return formatTheme({ name: palette.name, type: palette.type, colorGroups, tokenColors, semanticTokenColors });
}

const settings = (foreground, fontStyle) => ({ foreground, ...(fontStyle && { fontStyle }) });

function compareWithCommitted(json, file, report) {
  if (!fs.existsSync(file)) return report('file', `no committed theme file at ${file}`);
  const committedText = fs.readFileSync(file, 'utf8');
  if (committedText === json) return;
  let committed;
  try {
    committed = flatten(JSON.parse(committedText));
  } catch {
    return report('file', 'committed theme file is not valid JSON');
  }
  const built = flatten(JSON.parse(json));
  const paths = [...new Set([...Object.keys(committed), ...Object.keys(built)])];
  const differing = paths.filter((p) => committed[p] !== built[p]);
  for (const p of differing) {
    report(p.replace(/^colors\./, ''), `committed ${describe(committed[p])}, built ${describe(built[p])}`);
  }
  if (differing.length === 0) report('file', 'committed theme file differs from the build in formatting only');
}

const describe = (value) => (value === undefined ? 'nothing' : JSON.stringify(value));

// Path keys let a drift report name the exact theme key that changed.
function flatten(value, prefix = '') {
  if (value === null || typeof value !== 'object') return { [prefix]: value };
  return Object.assign(
    {},
    ...Object.entries(value).map(([k, v]) =>
      flatten(v, Array.isArray(value) ? `${prefix}[${k}]` : prefix ? `${prefix}.${k}` : k),
    ),
  );
}
