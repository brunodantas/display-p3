# Changelog

All notable changes to this extension are documented in this file. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the version follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## 0.2.1 - 2026-10-04

### Changed

- The README shows a new screenshot of every flavor and a grid of all 16 at the top. A script draws them from the theme files, so they show 0.2.0's colors. No flavor's colors change.

## 0.2.0 - 2026-10-04

Every flavor now compiles from an OKLCH palette, and a check fails any flavor that breaks the color rules below. Most flavors look the same at a glance. Midnight Press changes the most, with warm text, types and punctuation and light violet keywords. Deep Earth's functions turn a lighter blue.

### Changed

- The extension is now called Display P3 Themes. The README no longer promises colors beyond sRGB, because VS Code can't show them. [ADR 0001](docs/adr/0001-palettes-are-oklch-sources.md) explains.
- Neon's theme name is `Display P3 — Neon`, like the other 15. Your selected theme stays selected.
- Light colors take a tint of the flavor's background hue instead of pure white or flat grey:
  - Editor text changes in four flavors. Dracula goes from `#f8f8f2` to `#ecedfb`, Monokai from `#f8f8f2` to `#f9f9eb`, Midnight Press from `#d7d5d2` to `#e7dccc`, and Neon from `#e0e0e0` to `#d4dfef`. Monokai's muted greys take the tint too.
  - Midnight Press types and classes go from `#cfd0d0` to `#d9cebe`, and its punctuation and dim UI text from `#a9adb0` to `#b5ab9b`.
  - Terminal bright white is a tinted near-white in all 16 flavors, and stays the lightest of the 16 ANSI colors. Artisan Paper's becomes cream, `#fffbf4`.
  - Every `#ffffffXX` overlay, such as the current-line highlight, becomes the text tint at the same alpha.
  - Neon's badge and secondary button text go from `#ffffff` to `#f3f7fe`.
- The cursor, focus ring, errors, warnings and badges sit at the sRGB gamut edge in all 16 flavors. Most were there already. Deep Earth's focus ring and badge move from `#1a5fb4` to `#005dbf`.

### Fixed

Syntax colors that missed their contrast floor against the editor background now meet it: 4.5:1 for syntax, 3:1 for comments. Each moved by the smallest lightness step that reaches the floor. UI elements that shared the old color keep it. The other 11 flavors already met every floor.

- Artisan Paper
  - Keywords, constants, parameters, decorators, type parameters and macros go from `#b86b00` to `#aa6200` (3.92 to 4.52:1).
  - Comments go from `#a68e8e` to `#a48c8c` (2.93 to 3.00:1).
- Cyber-Oasis
  - Functions and methods go from `#bd00ff` to `#be1aff` (4.34 to 4.50:1).
- Deep Earth
  - Functions and properties go from `#1a5fb4` to `#3b7ed6` (2.94 to 4.52:1).
  - Keywords, parameters, decorators, type parameters and macros go from `#d64200` to `#df4a12` (4.08 to 4.51:1).
  - Strings go from `#008f5d` to `#01905e` (4.47 to 4.53:1).
- Midnight Press
  - Keywords, decorators and macros go from deep violet `#6b00b8` to light violet `#9e53f5` (2.08 to 4.51:1).
  - Constants go from `#0033ff` to `#3872ff` (2.63 to 4.52:1).
  - Strings and properties go from `#008282` to `#168a89` (4.07 to 4.53:1).
- Monokai
  - Keywords, invalid code and macros go from `#ff005f` to `#ff035f` (4.48 to 4.50:1).
