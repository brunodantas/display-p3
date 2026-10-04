# Display P3

A VS Code extension of color themes tuned for bright wide-gamut screens. Each flavor compiles from an OKLCH palette through one shared template into the committed theme JSON.

## Language

**Flavor**:
One color theme inside the extension.
_Avoid_: theme, variant

**Port**:
A flavor based on an existing third-party theme, such as Dracula or Monokai.
_Avoid_: remake

**Palette**:
A flavor's swatches and the roles they fill.
_Avoid_: color scheme

**Swatch**:
One named OKLCH color in a palette. Roles and overrides refer to it by name, with an optional alpha byte, as in `pink/1f`.
_Avoid_: base color

**Role**:
A job a color does across the UI, such as the editor background or a selection overlay, which the template maps to VS Code keys and a palette binds to a swatch with an optional alpha.
_Avoid_: slot, token

**Override**:
A palette entry that sets one VS Code key directly, bypassing the key's role.
_Avoid_: exception, patch

**Template**:
The shared mapping from palette roles to VS Code color keys and syntax scopes.
_Avoid_: base theme

**Accent**:
A saturated swatch used for syntax or emphasis.
_Avoid_: highlight

**Signal color**:
An accent that marks state: the cursor, focus, errors, warnings and badges.
_Avoid_: status color

**Neutral**:
A light color with no visible hue. This project bans them.
_Avoid_: white, grey

**Tint**:
The small chroma a light value takes from its background's hue.
_Avoid_: cast

**Gamut edge**:
The highest chroma sRGB allows at a given hue and lightness.
_Avoid_: max saturation
