# TODO

Library requests from section agents (the library owner decides; sections work around them with instance overrides or drawings until then).

- **Checkbox component.** The Workbench calibration table needs a standalone checkbox (18 px, `border/strong` outline, `accent/primary` fill with `Icon/check` when checked). FrameCard has one inside it but it is not a component. P9 draws its own for now (`section-calibration` › `cell-choice` › `checkbox-checked`).
- **Data-driven Histogram and Histogram/Mini.** Bars inside an instance can be resized but not moved, so a bar can only grow downward from the top; the components cannot show real data from an instance, and Histogram carries a visible "PLACEHOLDER" label. Options: bottom-anchored bars (a vertical auto-layout with `primaryAxisAlignItems = 'MAX'` per bar column), or accept per-page drawn charts as Flats-2 and the Workbench do. Until then FrameCard mini histograms show the placeholder shape everywhere.
- **Radio-style selector.** Flat level and combination method are one-of-many choices; both pages use Chip groups (the Flats-2 pattern). If a dedicated radio row is wanted in tables, add it to the library.
- **Enlarged hover view for the Workbench ROI strip** (owner request, 2026-09-24): a tile in the pinned strip enlarges on hover. Needs a design (overlay size, position) and a component state.

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
