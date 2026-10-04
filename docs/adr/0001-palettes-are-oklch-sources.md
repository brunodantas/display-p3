# Palettes are OKLCH sources; "P3" means tuned for wide-gamut screens

---
status: proposed
---

VS Code themes accept only sRGB hex (`color.ts` parseHex), and Chromium on macOS
converts them as sRGB, so no flavor can show colors beyond sRGB even on a P3
panel. We keep the "P3" name to mean flavors tuned for bright wide-gamut
screens: no neutral whites, and signal colors at the sRGB gamut edge. Each
flavor is an OKLCH palette compiled to committed hex through one shared
template, because the tint and gamut-edge rules need lightness, chroma and hue
as separate numbers, and 16 hand-edited files sharing 163 keys drifted.

## Considered options

- `color(display-p3 ...)` values in the theme: VS Code turns them red.
- `force-color-profile` in argv.json: no evidence it reaches native P3 red on
  macOS, and every user would have to edit a config file.
- Hand-edited hex with a lint only: catches white, but cannot compute a tint or
  a gamut edge.
