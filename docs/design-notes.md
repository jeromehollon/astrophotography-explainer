# Design notes: interaction, state, and reconciliation log

Working document for the Figma phase. Companion to `docs/copy.md` (prose) and `docs/figma-state.json` (node and token ids). Sections 3–5 become the handoff.

Figma file: https://www.figma.com/design/jtYi1LQf1fVyUAUfAgthP5/Astrophotography-Explainer

## 1. Approved direction (2026-09-24)

- Light theme on cream (`surface/page` = cream/100 #F2EBE0); space-themed Bauhaus: geometric primitives, cobalt / red / ochre pulled toward space, violet for "outside the camera", ink rules. No gradients, no glow.
- Type: Jost (headings, SemiBold/Medium), Public Sans (body 16/24, lede 18/28, 680 px measure), IBM Plex Mono (every number the pipeline produces).
- Wizard: one hash route per page, browser back/forward work. Page order per SPEC §7: Welcome → Noise & Defects → Bias → Darks → Flats (2) → Alignment → Algorithms → Light Frames (2) → Workbench.
- Page skeleton: TopBar → reading (page head, full-width illustration, section 1 with an ROI image, further prose) → 6 px ink rule → dark "Try it" stage → BottomNav.
- Teaching rules: one idea per page; ROIs only until the workbench; calibration pages show raw / corrected / what-was-removed; nothing collapses; no page counters; no binning labels; no success signal.
- Voice: neutral narrator, conversational blend of enthusiastic expert and textbook; no pithy declaratives; Figma text is authoritative and the owner edits it directly.

## 2. Colour and shape semantics (never colour alone)

| Meaning | Token | Shape | Where it appears |
|---|---|---|---|
| Bias | `source/bias` cobalt | circle | badge, illustration, toggle label icon |
| Dark signal / hot pixels | `source/dark` red | square | badge, illustration |
| Flat-field response | `source/flat` ochre | triangle | badge, illustration, reference-frame star |
| Random noise | `source/noise` grey | diamond | badge, illustration |
| Outside the camera | `source/external` violet | pentagon | badge, frame notes |
| Light frame | `ink/shape` | 4-point star | badge |

## 3. Interaction and state-preservation notes

- **One store, two views.** Lesson pages and the workbench read and write the same state: `calibration` (bias, dark, darkFlat, flat level), `frames[]`, `reference`, `algorithm` + params, and the four ROI ids. Lesson pages show a subset of controls; controls a page does not show keep their current value. Entering the workbench never resets anything.
- **Lesson pages lock what they do not teach.** E.g. Flats-1 forces `bias=false, dark=true`? — no: it applies whatever calibration the store holds *except* it forces `flat=50` on and off with the toggle and `darkFlat` with the second toggle. See §5 for the open question on defaults.
- **Stale vs pending.** Changing any input marks ROI tiles *Pending* until the worker returns (`ROITile State=Pending`, message "Result pending"). The full-image result is invalidated separately and shows "Result pending — press Stack".
- **Keyboard.** Tab order per page: top bar (brand, chapters, workbench) → reading-column links/callouts (none focusable) → stage controls in reading order (toggles, chip groups as one radio-group tab stop with arrow keys, sliders with arrow/PageUp/PageDown) → bottom nav. Focus ring: 3 px `border/strong` outside on cream; 3 px `accent/focus-on-stage` (ochre) outside on the stage. Toggle: Space. Chips: arrows. Scenario buttons: plain buttons.
- **Full stack.** Button → ProgressBar (percent, frames done, Cancel keeps focus) → result view → export buttons. Cancel returns to the previous result if any.
- **Export.** FITS (float32, linear, header per SPEC §4.6) and PNG (8-bit, current stretch). Filename pattern `ngc7331_stack_<n>f_<method>_<calib>.<ext>`.

## 4. Placeholders in the design

| Where | Placeholder | Real source |
|---|---|---|
| ROITile image wells on P4 Flats-1 | real crops from `assets/flats-1/` (script `tools/assets/flats_page1.py`) | `/api/roi` crops at runtime; the Figma crops define the stretch (STF target bg 0.30, clip −1.8 MADN) |
| Every other ROITile image well | "PLACEHOLDER · real ROI crop" | `/api/roi` crops, reference-frame STF (SPEC §4.5) |
| P4 full-field flat and before/after frame | `assets/flats-1/flat_full.png`, `frame_before.png`, `frame_after.png` (binned ×5) | Stage D static art |
| Histogram and Histogram/Mini | "PLACEHOLDER" bar shape | `histograms.json` |
| FrameCard thumbnail | solid navy rect | bin-8 thumbnails |
| Flats-1 stage | none (readouts removed) | — |
| Copy numbers marked `[PLACEHOLDER: …]` in `docs/copy.md` | FWHM, star counts, background spreads, noise ratios | `stars.json`, `histograms.json`, pipeline |
| Illustration stars | drawn dots | none (illustrative, labelled so) |

## 5. Proposed spec changes and items to reconcile

1. **P4 Flats-1 layout (owner direction, 2026-09-24).** Reading column: intro on the optical path → the real master flat, full field → "Reading the flat as a correction map" with a one-pixel side panel (600 ÷ 0.75 = 800) → whole-image before/after → why the flat needs dark flats. So this page does show two full-field views (the flat, and the frame before/after); ROIs-only still applies to the Try-it tiles. Tiles are **Raw / Computed / What was removed**; every tile is populated in every toggle state and carries an owner-written caption. Experiment 2's tiles are the same light-frame ROI: Raw = divided by the flat as shot, Computed = divided by the dark-flat-calibrated flat, removed = their difference (about 0.4 DN at the mote core against 45 DN of noise, so the tile is mostly noise; `stats.json` has the numbers). The optical-path SVG and its prose share a cream bounding box with the real flat to its right; the before/after pair sits in a dark box. The "bias only" flat variant (`flat_50_bias`) is not exposed on this page. The "bias only" flat variant (`flat_50_bias`) is not exposed on this page; it remains available in the workbench.
2. **"What was removed" view.** Lesson stages show `computed − raw` centred on mid grey (lighter = the correction added brightness, darker = it removed some); with the switch off the tile is uniform grey. This is a display-side computation not in `StackResult`; the pipeline or the section needs a difference helper. SPEC P4 already lists a difference view as a candidate.
3. **Under- vs over-correction with an uncalibrated flat.** SPEC P4 says over-correction toward the corners; with a dark-subtracted light and the flat's own offset left in, the expected effect is under-correction (the map is flatter than the truth). Verify the sign with `flat_check.json` before the caption ships.
4. **Top bar shows sub-steps** (4 in Calibration, 2 in Light frames). The shell needs the section registry to expose chapter → pages so markers can be drawn. The page counter was removed on purpose.
5. **Lesson ROI tiles carry no readout and no bin tag.** SPEC §4.5's noise readout stays a workbench feature (NoiseReadout component) and, per copy, appears in the Alignment lesson under the average tile. Decide whether Noise & Defects shows a number (SPEC P1 AC expects a readout falling as 1/√N).
6. **FrameCard columns** are checkbox · number · thumbnail · histogram · FWHM · note. Star count is not shown in the list; it is quoted in the Light Frames prose. If the owner wants it back, add a column.
7. **Illustrations are full width (1200×360)** above the first section; a 440×330 ROI image slot sits beside "The problem you can see" on every lesson page. Stage D (static art) should produce those ROI crops at 2× for the illustration slot.
8. **Amp-glow example** on Darks (display-only old-camera dark) conflicts with "ROIs only". Owner decision pending (see copy.md P3).
9. **Prototype flow across Figma pages.** Prototype links cannot cross pages, so the final flow is assembled on the "Prototype" page by moving one frame per app page there and wiring Next/Previous. Page agents build on their own pages first.

## 6. Figma API gotchas recorded for other agents

- `figma.createAutoLayout()` frames get a default opaque white fill: set `fills = []` on every container.
- `resize()` on a TEXT node after `textAutoResize = 'HEIGHT'` resets it to `NONE`; set HEIGHT after resize.
- Font style strings in this file: Jost "SemiBold"; Public Sans "SemiBold"; Inter "Semi Bold" (with a space).
- Text nodes wired to a TEXT component property show the property default in instances; don't rely on per-variant characters for wired text.
- Concurrent `use_figma` calls are fine on different pages; same-page writes are sequential.
