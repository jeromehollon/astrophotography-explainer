# TODO

Library requests from section agents (the library owner decides; sections work around them with instance overrides or drawings until then).

- **Checkbox component.** The Workbench calibration table needs a standalone checkbox (18 px, `border/strong` outline, `accent/primary` fill with `Icon/check` when checked). FrameCard has one inside it but it is not a component. P9 draws its own for now (`section-calibration` › `cell-choice` › `checkbox-checked`).
- **Data-driven Histogram and Histogram/Mini.** Bars inside an instance can be resized but not moved, so a bar can only grow downward from the top; the components cannot show real data from an instance, and Histogram carries a visible "PLACEHOLDER" label. Options: bottom-anchored bars (a vertical auto-layout with `primaryAxisAlignItems = 'MAX'` per bar column), or accept per-page drawn charts as Flats-2 and the Workbench do. Until then FrameCard mini histograms show the placeholder shape everywhere.
- **Radio-style selector.** Flat level and combination method are one-of-many choices; both pages use Chip groups (the Flats-2 pattern). If a dedicated radio row is wanted in tables, add it to the library.
- **Enlarged hover view for the Workbench ROI strip** (owner request, 2026-09-24): a tile in the pinned strip enlarges on hover. Needs a design (overlay size, position) and a component state.
- **Shared UI stubs vs Figma (Algorithms page, 2026-09-24).** `src/shared/ui` Chip is 32 px tall with a 1 px border; Figma Chip 9:130 is 39 px (label/md, 16×8 padding), 1.5 px `border/strong`, `surface/card` fill when unselected. Callout 9:210 is a `surface/card` box with a 1 px `border/strong` outline, a cobalt "Why?" eyebrow, then a label/md title and body/sm text at 24×16 padding, not a colour bar with an icon. ROITile 9:337 as used on lessons has a `surface/stage-raised` box with a 1 px `border/on-stage`, a header strip (label/md, 12×10 padding) and a caption strip below the well. TopBar 17:1087 (cobalt links, 3 px cobalt indicator, page row with a 276 px spacer showing the chapter's single page) and BottomNav 11:28 (88 px, "← Alignment" Secondary at left, "Light frames →" Primary at right) also differ from the stubs. `src/sections/algorithms/local.tsx` carries Figma-exact Chip / ROITile / Callout until the shared ones match.

Shared UI stubs vs the lesson frames (from LESSONS-B, 2026-09-24; Foundation decides). The Bias and Darks pages use `LessonPage`, `Toggle` and the store from `src/shared`, and keep section-local copies of two components whose stubs draw differently from Figma:

- **ROITile (9:337).** In the lesson frames the tile is a 320 px box on `surface/stage-raised` with a 1 px `border/on-stage`, a head bar (label/md, 12/10 padding), the image well, and the caption inside the box (body/sm on-stage-muted, 12/10 padding). The stub draws title and caption outside an unbordered well. Darks needs a 318×318 well (5× pixel patch, `image-rendering: pixelated`). `src/sections/bias/ui.tsx` and `src/sections/darks/ui.tsx` hold the Figma rendering until the shared one matches; swap when it does.
- **Callout Kind=Why (9:210).** Figma: `surface/card` box with a 1 px `border/strong`, 24/16 padding, eyebrow "Why?" in `text/link`, title label/md, body body/sm, 440 wide. The stub has a coloured side bar and an icon.
- **TopBar / BottomNav.** Figma 17:1087 uses 120 px gutters, a 2 px ink rule under the chapter row, 3 px cobalt indicators under the current chapter and page, and a cream `surface/panel` page row; BottomNav 11:28 shows "← Noise & Defects" (Secondary, 2 px ink border) and "Darks →" (Primary), 88 px tall.

## Shared UI vs Figma (lessons-a, 2026-09-24)

Differences between `src/shared/ui` and the Figma lesson frames (57:619, 61:1149, 73:2, 94:46) found while building Welcome, Noise & Defects, Alignment and Light frames. The four pages use the shared `LessonPage` chrome and keep Figma-exact local primitives in `src/sections/lessons-a-shim/ui.tsx` until these are settled; then they swap to the shared ones by changing one import.

- **TopBar.** Figma: current chapter has a 3 px `accent/primary` indicator and other chapters are `text/link` cobalt; row 2 (40 px, `surface/panel`, 1 px `border/default` bottom) shows the chapter's pages with the same 3 px indicator, and single-page chapters show their one page. Shared: ink indicator, secondary-text chapters, row 2 is an underline on cream and hides pages with an empty label.
- **BottomNav.** Figma: 88 px, 1 px `border/default` top; Previous is a Secondary button "← Flats, continued", Next is Primary "Algorithms →"; Welcome shows only "Start: Noise & Defects →". Shared: 96 px, strong border, ghost "Previous: …" with chevron icons, secondary "Next: …".
- **Reading.** Figma gap is 32 px (`space/8`) between blocks, padding 64 px; shared uses 48.
- **PageHead.** Figma: eyebrow in `text/link`, lede in `text/secondary`, gap 12; Welcome adds a Jost Medium 24/32 subtitle in `text/secondary` with −0.5 tracking; h1 tracking −0.5. Shared: eyebrow and lede colours differ, gap 16.
- **Prose.** Figma h2 → p spacing is the 24 px gap only; shared adds `margin-top: 16px` on h2.
- **Callout.** Figma Note: `surface/panel`, 4 px cobalt left border, eyebrow word "Note" (`text/secondary`) then a label/md title and body/sm text, 24/16 padding. Why?: `surface/card`, 1 px `border/strong`, eyebrow "Why?" in `text/link`. Shared: card background, 6 px bar, icon + title in the eyebrow row, body/md, no kind word.
- **Badge/Source.** Figma labels are "Bias", "Dark", "Flat", "Random noise", "Outside the camera", with a 1 px border in the source colour, 12 px glyph and 8/4 padding. Shared: "Dark signal", "Flat-field", no border, 10 px glyph.

## Shared UI vs the Flats / Flats-continued Figma frames (lessons-c, 2026-09-24)

The Flats pages use the shared `LessonPage` chrome but keep section-local copies of
these primitives (`src/sections/flats/ui.tsx`, `src/sections/flats-2/ui.tsx`) because the
shared ones render differently from the Figma library components the frames use:

- `ROITile` (9:337): Figma is a 320-wide raised card (`surface/stage-raised`, 1 px
  `border/on-stage`) with a 12/10 px padded title row, a 320x240 well and a padded caption;
  shared draws the title above a bare well and defaults to 360 wide.
- `Chip` (9:130): Figma is 16/8 px padding, 1.5 px `border/strong` on `surface/card`
  (unselected) and cobalt fill (selected); shared uses h-8, px-3, 1 px muted border.
- `Toggle` (9:117): Figma track is 44x24 with a 2 px ink stroke and a 14 px knob; shared
  uses a 1 px border and a 16 px knob.
- `Experiment`: in the frames the title, control and 360 px help text sit in one row
  (gap 24) with no top border; shared stacks them and adds a border-top.
- `Callout` (9:210): Figma Why = cream card with 1 px ink border and a "WHY?" eyebrow in
  `text/link`; Note = `surface/panel` with a 4 px cobalt left bar and a "NOTE" eyebrow;
  shared uses a coloured bar plus icon for every kind.
- `PageHead` / `Reading`: Figma uses eyebrow in `text/link`, 12 px gaps and 32 px between
  reading sections; shared uses `text/secondary`, 16 px and 48 px.

Once the shared components match the library, delete the local `ui.tsx` files and point the
imports at `src/shared/ui` (same prop names).
- `BottomNav` (11:28): the frames show "← Darks" / "Flats, continued →" as Secondary / Primary
  buttons at the far left and right; shared renders "Previous: …" as a ghost link with a
  chevron and "Next: …" as Secondary. `TopBar` row 2 in the frames underlines the current
  page with a 3 px cobalt indicator and colours the other tabs `text/link`; shared uses a
  text underline and `text/secondary`.
