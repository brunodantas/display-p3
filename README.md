# Display P3 Themes

Sixteen VS Code color themes, called flavors, tuned for bright wide-gamut screens such as Apple's Studio Display. Fifteen are dark and one is light. Dracula, Monokai, Solarized, Tokyo Night, Night Owl, One Dark and Synthwave are ports of the themes they're named after.

![All 16 Display P3 flavors](images/grid.png)

VS Code can't show colors beyond sRGB. Its themes accept only sRGB hex, and the editor converts them as sRGB on a [Display P3](https://en.wikipedia.org/wiki/DCI-P3) panel too. So "P3" here names the screens the flavors are built for, not the colors they use. Every flavor follows three rules:

- No white or light grey without a hue. Code text carries the flavor's background hue as a clear color. Terminal bright white and the line-highlight overlay take a slight tint of it, so they don't glare at full brightness.
- The cursor, focus ring, errors, warnings and badges sit at the sRGB gamut edge, the most saturated color sRGB allows at their hue and lightness.
- Editor text meets a 7:1 contrast ratio against the background, syntax colors 4.5:1 and comments 3:1, measured as WCAG 2.

[ADR 0001](docs/adr/0001-palettes-are-oklch-sources.md) records why, and the two routes to native P3 color that didn't work.

## Installation

Install via https://marketplace.visualstudio.com/items?itemName=brunodantas.display-p3, then pick a flavor with **Preferences: Color Theme**.

## Dark flavors

### Display P3 - Bioluminescent

![Display P3 - Bioluminescent](images/bioluminescent.png)

### Display P3 - Cyber-Oasis

![Display P3 - Cyber-Oasis](images/cyber-oasis.png)

### Display P3 - Deep Earth

![Display P3 - Deep Earth](images/deep-earth.png)

### Display P3 - Deep Forest

![Display P3 - Deep Forest](images/deep-forest.png)

### Display P3 - Dracula

![Display P3 - Dracula](images/dracula.png)

### Display P3 - Hyper-Vapor

![Display P3 - Hyper-Vapor](images/hyper-vapor.png)

### Display P3 - Midnight Press

![Display P3 - Midnight Press](images/midnight-press.png)

### Display P3 - Monokai

![Display P3 - Monokai](images/monokai.png)

### Display P3 - Neon

![Display P3 - Neon](images/neon.png)

### Display P3 - Night Owl

![Display P3 - Night Owl](images/night-owl.png)

### Display P3 - One Dark

![Display P3 - One Dark](images/one-dark.png)

### Display P3 - Solar Flare

![Display P3 - Solar Flare](images/solar-flare.png)

### Display P3 - Solarized

![Display P3 - Solarized](images/solarized.png)

### Display P3 - Synthwave

![Display P3 - Synthwave](images/synthwave.png)

### Display P3 - Tokyo Night

![Display P3 - Tokyo Night](images/tokyo-night.png)

## Light flavors

### Display P3 - Artisan Paper

![Display P3 - Artisan Paper](images/artisan-paper.png)

## Changing a flavor

Each flavor is an OKLCH palette in `palettes/`. The build compiles it through one shared template, `build/template.json`, into the theme JSON in `themes/` that VS Code reads. Never edit `themes/` by hand, because the check fails on any file that differs from the build.

1. Edit the flavor's palette. A numeric swatch is `[lightness, chroma, hue]` in OKLCH, and a chroma of `"max"` puts it on the gamut edge. A swatch like `{ "tint": "text" }` takes the flavor's tint instead.
2. Run `npm run build` to write the theme files.
3. Run `npm run check`. It fails when a flavor breaks a color rule, for example with a light neutral, a color under its contrast floor or a swatch outside sRGB without `"max"`. It also fails when a theme file differs from the build. Each failure names the flavor and key.
4. Run `npm run screenshots` to redraw `images/` from the theme files. It renders each flavor as a mock VS Code window, so the images match the colors without a hand capture. The first run needs `npx playwright install chromium`.

`npm run preview` writes `preview/index.html`, which puts each flavor's colors on `main` next to your build so you can judge a change by eye. `npm test` runs the build's tests, and [CONTEXT.md](CONTEXT.md) defines the terms.
