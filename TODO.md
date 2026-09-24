# TODO

Library requests from section agents (the library owner decides; sections work around them with instance overrides or drawings until then).

- **Checkbox component.** The Workbench calibration table needs a standalone checkbox (18 px, `border/strong` outline, `accent/primary` fill with `Icon/check` when checked). FrameCard has one inside it but it is not a component. P9 draws its own for now (`section-calibration` › `cell-choice` › `checkbox-checked`).
- **Data-driven Histogram and Histogram/Mini.** Bars inside an instance can be resized but not moved, so a bar can only grow downward from the top; the components cannot show real data from an instance, and Histogram carries a visible "PLACEHOLDER" label. Options: bottom-anchored bars (a vertical auto-layout with `primaryAxisAlignItems = 'MAX'` per bar column), or accept per-page drawn charts as Flats-2 and the Workbench do. Until then FrameCard mini histograms show the placeholder shape everywhere.
- **Radio-style selector.** Flat level and combination method are one-of-many choices; both pages use Chip groups (the Flats-2 pattern). If a dedicated radio row is wanted in tables, add it to the library.
- **Enlarged hover view for the Workbench ROI strip** (owner request, 2026-09-24): a tile in the pinned strip enlarges on hover. Needs a design (overlay size, position) and a component state.

Shared UI stubs vs the lesson frames (from LESSONS-B, 2026-09-24; Foundation decides). The Bias and Darks pages use `LessonPage`, `Toggle` and the store from `src/shared`, and keep section-local copies of two components whose stubs draw differently from Figma:

- **ROITile (9:337).** In the lesson frames the tile is a 320 px box on `surface/stage-raised` with a 1 px `border/on-stage`, a head bar (label/md, 12/10 padding), the image well, and the caption inside the box (body/sm on-stage-muted, 12/10 padding). The stub draws title and caption outside an unbordered well. Darks needs a 318×318 well (5× pixel patch, `image-rendering: pixelated`). `src/sections/bias/ui.tsx` and `src/sections/darks/ui.tsx` hold the Figma rendering until the shared one matches; swap when it does.
- **Callout Kind=Why (9:210).** Figma: `surface/card` box with a 1 px `border/strong`, 24/16 padding, eyebrow "Why?" in `text/link`, title label/md, body body/sm, 440 wide. The stub has a coloured side bar and an icon.
- **TopBar / BottomNav.** Figma 17:1087 uses 120 px gutters, a 2 px ink rule under the chapter row, 3 px cobalt indicators under the current chapter and page, and a cream `surface/panel` page row; BottomNav 11:28 shows "← Noise & Defects" (Secondary, 2 px ink border) and "Darks →" (Primary), 88 px tall.
