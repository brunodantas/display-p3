# Display P3 Themes

<!-- Placeholder: a grid of all 16 flavors goes here, made by hand from the new screenshots. -->

Sixteen VS Code color themes, called flavors, tuned for bright wide-gamut screens such as Apple's Studio Display. Fifteen are dark and one is light. Dracula, Monokai, Solarized, Tokyo Night, Night Owl, One Dark and Synthwave are ports of the themes they're named after.

VS Code can't show colors beyond sRGB. Its themes accept only sRGB hex, and the editor converts them as sRGB on a [Display P3](https://en.wikipedia.org/wiki/DCI-P3) panel too. So "P3" here names the screens the flavors are built for, not the colors they use. Every flavor follows three rules:

- No white or light grey without a hue. Editor text, terminal bright white and the line-highlight overlay take a slight tint from the flavor's background, so they don't glare at full brightness.
- The cursor, focus ring, errors, warnings and badges sit at the sRGB gamut edge, the most saturated color sRGB allows at their hue and lightness.
- Editor text meets a 7:1 contrast ratio against the background, syntax colors 4.5:1 and comments 3:1, measured as WCAG 2.

[ADR 0001](docs/adr/0001-palettes-are-oklch-sources.md) records why, and the two routes to native P3 color that didn't work.

## Installation

Install via https://marketplace.visualstudio.com/items?itemName=brunodantas.display-p3

## Changing a flavor

Each flavor is an OKLCH palette in `palettes/`. The build compiles it through one shared template, `build/template.json`, into the theme JSON in `themes/` that VS Code reads. Never edit `themes/` by hand, because the check fails on any file that differs from the build.

1. Edit the flavor's palette. A numeric swatch is `[lightness, chroma, hue]` in OKLCH, and a chroma of `"max"` puts it on the gamut edge. A swatch like `{ "tint": "text" }` takes the flavor's tint instead.
2. Run `npm run build` to write the theme files.
3. Run `npm run check`. It fails when a flavor breaks a color rule, for example with a light neutral, a color under its contrast floor or a swatch outside sRGB without `"max"`. It also fails when a theme file differs from the build. Each failure names the flavor and key.

`npm run preview` writes `preview/index.html`, which puts each flavor's colors on `main` next to your build so you can judge a change by eye. `npm test` runs the build's tests, and [CONTEXT.md](CONTEXT.md) defines the terms.

## Dark Flavors

### Display P3 - Bioluminescent

<img width="2560" height="1440" alt="image" src="https://github.com/user-attachments/assets/443b6cec-847c-43fe-8cbe-3f10eebccefc" />


### Display P3 - Cyber-Oasis

<img width="2560" height="1440" alt="image" src="https://github.com/user-attachments/assets/07d89f8f-3e29-4ec9-b601-e196392c5e38" />


### Display P3 - Deep Earth

<img width="2560" height="1440" alt="image" src="https://github.com/user-attachments/assets/bb6e9e38-fa20-4fc9-b68d-357a44579858" />

### Display P3 - Deep Forest

<img width="2560" height="1440" alt="image" src="https://github.com/user-attachments/assets/40d37b65-3dee-4ab6-b427-8326039fab65" />

### Display P3 - Dracula

<img width="2560" height="1440" alt="image" src="https://github.com/user-attachments/assets/f54e5484-e509-4aa1-8ae4-d9321a207e0c" />


### Display P3 - Hyper-Vapor

<img width="2560" height="1440" alt="image" src="https://github.com/user-attachments/assets/97dc99b4-4fd7-40f8-a9cb-a9ac5fb80f17" />

### Display P3 - Midnight Press

<img width="2560" height="1440" alt="image" src="https://github.com/user-attachments/assets/cc28fd2c-76d2-4feb-91ec-b1eb01ed314f" />

### Display P3 - Monokai

<img width="2560" height="1440" alt="image" src="https://github.com/user-attachments/assets/bc81d0de-d233-4bf7-b17d-a7a5f1d3605c" />

### Display P3 - Neon

<img width="2560" height="1440" alt="image" src="https://github.com/user-attachments/assets/6d68d3b1-b817-4db8-bdcb-a8d64fb3cee6" />


### Display P3 - Night Owl

<img width="2560" height="1440" alt="image" src="https://github.com/user-attachments/assets/2a865ee9-9797-41e6-a924-923be7ffffd6" />

### Display P3 - One Dark

<img width="2560" height="1440" alt="image" src="https://github.com/user-attachments/assets/2d1cdb67-dc85-459a-91d1-61bc220640b6" />


### Display P3 - Solar Flare

<img width="2560" height="1440" alt="image" src="https://github.com/user-attachments/assets/54c69d10-79bb-4933-a1b8-52df51e52d8d" />


### Display P3 - Solarized

<img width="2560" height="1440" alt="image" src="https://github.com/user-attachments/assets/d899b42e-6e38-4238-aade-699a602ee733" />


### Display P3 - Synthwave

<img width="2560" height="1440" alt="image" src="https://github.com/user-attachments/assets/ff34c0dd-c55f-45ed-a58c-2b17b3a9796f" />


### Display P3 - Tokyo Night

<img width="2560" height="1440" alt="image" src="https://github.com/user-attachments/assets/46b6af5e-9496-407d-bb6c-f2304d860a1e" />


## Light Flavors

### Display P3 - Artisan Paper

<img width="2560" height="1440" alt="image" src="https://github.com/user-attachments/assets/7d0b992d-4d9e-4951-926e-bedc3c90b4b8" />
