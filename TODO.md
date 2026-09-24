# TODO

Library requests from section agents (the library owner decides; sections work around them with instance overrides or drawings until then).

- **Checkbox component.** The Workbench calibration table needs a standalone checkbox (18 px, `border/strong` outline, `accent/primary` fill with `Icon/check` when checked). FrameCard has one inside it but it is not a component. P9 draws its own for now (`section-calibration` › `cell-choice` › `checkbox-checked`).
- **Data-driven Histogram and Histogram/Mini.** Bars inside an instance can be resized but not moved, so a bar can only grow downward from the top; the components cannot show real data from an instance, and Histogram carries a visible "PLACEHOLDER" label. Options: bottom-anchored bars (a vertical auto-layout with `primaryAxisAlignItems = 'MAX'` per bar column), or accept per-page drawn charts as Flats-2 and the Workbench do. Until then FrameCard mini histograms show the placeholder shape everywhere.
- **Radio-style selector.** Flat level and combination method are one-of-many choices; both pages use Chip groups (the Flats-2 pattern). If a dedicated radio row is wanted in tables, add it to the library.
- **Enlarged hover view for the Workbench ROI strip** (owner request, 2026-09-24): a tile in the pinned strip enlarges on hover. Needs a design (overlay size, position) and a component state.
