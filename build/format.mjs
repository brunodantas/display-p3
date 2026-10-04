// Writes theme JSON in the layout the hand-written theme files use, so compiled files diff cleanly against them.

const str = JSON.stringify;

const pair = ([key, value]) => `${str(key)}: ${str(value)}`;

const inlineObject = (obj) => `{ ${Object.entries(obj).map(pair).join(', ')} }`;

// The hand-written files keep a scope list of up to three entries on one line.
const scopeList = (scope) =>
  scope.length <= 3
    ? `[${scope.map(str).join(', ')}]`
    : `[\n${scope.map((s) => `        ${str(s)}`).join(',\n')}\n      ]`;

const tokenRule = ({ name, scope, settings }) => `    {
      "name": ${str(name)},
      "scope": ${scopeList(scope)},
      "settings": ${inlineObject(settings)}
    }`;

const semanticEntry = ([key, value]) =>
  typeof value === 'string'
    ? `    ${pair([key, value])}`
    : `    ${str(key)}: {\n${Object.entries(value).map((e) => `      ${pair(e)}`).join(',\n')}\n    }`;

/** Colors come as groups of [key, hex] pairs, because the hand-written files separate groups with a blank line. */
export function formatTheme({ name, type, colorGroups, tokenColors, semanticTokenColors }) {
  const colors = colorGroups.map((group) => group.map((e) => `    ${pair(e)}`).join(',\n')).join(',\n\n');
  return `{
  "name": ${str(name)},
  "type": ${str(type)},
  "colors": {
${colors}
  },
  "tokenColors": [
${tokenColors.map(tokenRule).join(',\n')}
  ],
  "semanticHighlighting": true,
  "semanticTokenColors": {
${Object.entries(semanticTokenColors).map(semanticEntry).join(',\n')}
  }
}
`;
}
