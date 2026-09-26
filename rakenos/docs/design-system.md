# Raken Design System

Files: `design-system/tokens.css`, `design-system/components.css`, `design-system/icons.js`, `design-system/fonts/`.

## Principles

- Calm, neutral surfaces; one accent colour (Raken blue) used for actions and state.
- Content first: grouped inset lists, restrained cards, no decorative gradients or neon.
- Real SVG icons on a 24 px grid with a 1.8 px stroke — never emoji.
- Motion that explains: spring-like curves (`--r-ease-emphasized`) for navigation, short fades for state. Reduce Motion and Battery Saver shorten all durations.

## Tokens

- **Typography** — Raken Sans (Inter, SIL OFL): display 34, title1 28, title2 22, title3 19, headline 16/600, body 16, callout 15, subhead 14, footnote 13, caption 12. All sizes scale with the Text Size setting through `--r-type-scale`; Bold Text raises body weights.
- **Spacing** — 4 px grid (`--r-space-1` … `--r-space-10`), 16 px gutter.
- **Radii** — 6, 10, 14, 20, 28 px and a continuous app-icon radius.
- **Colour** — light and dark palettes (`:root` and `:root[data-theme='dark']`): background, surfaces, text levels, separators, accent, success, warning, danger, materials for translucent system chrome. Increase Contrast strengthens secondary text and separators.
- **Motion** — `--r-dur-fast` 140 ms, `--r-dur-base` 240 ms, `--r-dur-slow` 380 ms.

## Components

Buttons (primary, tinted, plain, destructive, small, pill, icon), navigation bar with large titles that collapse on scroll, grouped list sections and rows (icon, subtitle, value, chevron, badge), switches, sliders with filled tracks, segmented controls, search fields, text fields, badges and counters, progress bars and spinners, dialogs, bottom sheets with drag-to-dismiss, action menus, toasts, empty states and app icons. RDesign (RAS app interfaces) renders with the same components.
