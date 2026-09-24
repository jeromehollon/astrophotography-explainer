# TODO

Library requests from section agents (the library owner decides; sections work around them with instance overrides or drawings until then).

- **Checkbox component.** The Workbench calibration table needs a standalone checkbox (18 px, `border/strong` outline, `accent/primary` fill with `Icon/check` when checked). FrameCard has one inside it but it is not a component. P9 draws its own for now (`section-calibration` › `cell-choice` › `checkbox-checked`).
- **Data-driven Histogram and Histogram/Mini.** Bars inside an instance can be resized but not moved, so a bar can only grow downward from the top; the components cannot show real data from an instance, and Histogram carries a visible "PLACEHOLDER" label. Options: bottom-anchored bars (a vertical auto-layout with `primaryAxisAlignItems = 'MAX'` per bar column), or accept per-page drawn charts as Flats-2 and the Workbench do. Until then FrameCard mini histograms show the placeholder shape everywhere.
- **Radio-style selector.** Flat level and combination method are one-of-many choices; both pages use Chip groups (the Flats-2 pattern). If a dedicated radio row is wanted in tables, add it to the library.
- **Enlarged hover view for the Workbench ROI strip** (owner request, 2026-09-24): a tile in the pinned strip enlarges on hover. Needs a design (overlay size, position) and a component state.

## Shared UI vs Figma (lessons-a, 2026-09-24)

Differences between `src/shared/ui` and the Figma lesson frames (57:619, 61:1149, 73:2, 94:46) found while building Welcome, Noise & Defects, Alignment and Light frames. The four pages use the shared `LessonPage` chrome and keep Figma-exact local primitives in `src/sections/lessons-a-shim/ui.tsx` until these are settled; then they swap to the shared ones by changing one import.

- **TopBar.** Figma: current chapter has a 3 px `accent/primary` indicator and other chapters are `text/link` cobalt; row 2 (40 px, `surface/panel`, 1 px `border/default` bottom) shows the chapter's pages with the same 3 px indicator, and single-page chapters show their one page. Shared: ink indicator, secondary-text chapters, row 2 is an underline on cream and hides pages with an empty label.
- **BottomNav.** Figma: 88 px, 1 px `border/default` top; Previous is a Secondary button "← Flats, continued", Next is Primary "Algorithms →"; Welcome shows only "Start: Noise & Defects →". Shared: 96 px, strong border, ghost "Previous: …" with chevron icons, secondary "Next: …".
- **Reading.** Figma gap is 32 px (`space/8`) between blocks, padding 64 px; shared uses 48.
- **PageHead.** Figma: eyebrow in `text/link`, lede in `text/secondary`, gap 12; Welcome adds a Jost Medium 24/32 subtitle in `text/secondary` with −0.5 tracking; h1 tracking −0.5. Shared: eyebrow and lede colours differ, gap 16.
- **Prose.** Figma h2 → p spacing is the 24 px gap only; shared adds `margin-top: 16px` on h2.
- **Callout.** Figma Note: `surface/panel`, 4 px cobalt left border, eyebrow word "Note" (`text/secondary`) then a label/md title and body/sm text, 24/16 padding. Why?: `surface/card`, 1 px `border/strong`, eyebrow "Why?" in `text/link`. Shared: card background, 6 px bar, icon + title in the eyebrow row, body/md, no kind word.
- **Badge/Source.** Figma labels are "Bias", "Dark", "Flat", "Random noise", "Outside the camera", with a 1 px border in the source colour, 12 px glyph and 8/4 padding. Shared: "Dark signal", "Flat-field", no border, 10 px glyph.
