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
| ROITile image wells on P2 Bias | real crops from `assets/bias/` (script `tools/assets/bias_page.py`); the shared STF is computed on the bias-subtracted crop so the raw tile reads as lifted rather than the corrected tile clipping to black | `/api/roi` crops at runtime |
| P2 full master bias | `assets/bias/bias_full.png` (every 5th pixel, no averaging, linear stretch 158–164 DN) | Stage D static art; must subsample, not bin, or the grain disappears |
| P2 average-brightness bars | drawn rectangles sized from `assets/bias/stats.json` (raw 1,233, computed 1,073, bias 161 in the ROI) | live ROI means from the pipeline |
| P0 Welcome image wells | real full-field images from `assets/welcome/` (script `tools/assets/welcome_page.py`): f07 sub, WBPP master, colour composite | Stage D static art |
| Every other ROITile image well | "PLACEHOLDER · real ROI crop" | `/api/roi` crops, reference-frame STF (SPEC §4.5) |
| P1 Noise & Defects image wells (problem crop and the 8 tour crops) | real crops from `assets/noise/` (script `tools/assets/noise_page.py`, numbers in `stats.json`) | Stage D static art; the flat and cloud crops are whole-field ×8 and quarter-field ×4, the rest native pixels |
| P4 full-field flat and before/after frame | `assets/flats-1/flat_full.png`, `frame_before.png`, `frame_after.png` (binned ×5) | Stage D static art |
| Histogram and Histogram/Mini | "PLACEHOLDER" bar shape | `histograms.json` |
| P5 Flats-2 image wells | real crops from `assets/flats-2/` (script `tools/assets/flats_page2.py`): 85 % ROI in the problem slot, three full-field master flats on one shared linear stretch, stage tiles at the Flats-1 crop and STF (target bg 0.30, clip −1.8 MADN) | `/api/roi` crops at runtime; the full-field flats are Stage D static art |
| P5 histogram chart | vectors drawn from `assets/flats-2/histograms.json` (one raw flat per level, frame 0000, 256 bins over 0–65,535, counts normalised so every peak is the same height) | `histograms.json` for the flats, or the same asset file |
| FrameCard thumbnail | solid navy rect | bin-8 thumbnails |
| Flats-1 stage | none (readouts removed) | — |
| Copy numbers marked `[PLACEHOLDER: …]` in `docs/copy.md` | FWHM, star counts, background spreads, noise ratios | `stars.json`, `histograms.json`, pipeline |
| Illustration stars | drawn dots | none (illustrative, labelled so) |

## 5. Proposed spec changes and items to reconcile

1. **P4 Flats-1 layout (owner direction, 2026-09-24).** Reading column: intro on the optical path → the real master flat, full field → "Reading the flat as a correction map" with a one-pixel side panel (600 ÷ 0.75 = 800) → whole-image before/after → why the flat needs dark flats. So this page does show two full-field views (the flat, and the frame before/after); ROIs-only still applies to the Try-it tiles. Tiles are **Raw / Computed / What was removed**; every tile is populated in every toggle state and carries an owner-written caption. Experiment 2's tiles are the same light-frame ROI: Raw = divided by the flat as shot, Computed = divided by the dark-flat-calibrated flat, removed = their difference (about 0.4 DN at the mote core; the raw noise cancels because both tiles divide the same frame, so on its own symmetric stretch it shows a clean donut much like experiment 1's; `stats.json` has the numbers). The optical-path SVG and its prose share a cream bounding box with the real flat to its right; the before/after pair sits in a dark box. The "bias only" flat variant (`flat_50_bias`) is not exposed on this page. The "bias only" flat variant (`flat_50_bias`) is not exposed on this page; it remains available in the workbench.
2. **"What was removed" view.** Lesson stages show `computed − raw` centred on mid grey (lighter = the correction added brightness, darker = it removed some); the tile shows that difference in every toggle state; only the Computed tile follows the switch. This is a display-side computation not in `StackResult`; the pipeline or the section needs a difference helper. SPEC P4 already lists a difference view as a candidate.
3. **Under- vs over-correction with an uncalibrated flat.** SPEC P4 says over-correction toward the corners; with a dark-subtracted light and the flat's own offset left in, the expected effect is under-correction (the map is flatter than the truth). Verify the sign with `flat_check.json` before the caption ships.
4. **Top bar shows sub-steps** (4 in Calibration, 2 in Light frames). The shell needs the section registry to expose chapter → pages so markers can be drawn. The page counter was removed on purpose.
5. **Lesson ROI tiles carry no readout and no bin tag.** SPEC §4.5's noise readout stays a workbench feature (NoiseReadout component) and, per copy, appears in the Alignment lesson under the average tile. Decide whether Noise & Defects shows a number (SPEC P1 AC expects a readout falling as 1/√N).
6. **FrameCard columns** are checkbox · number · thumbnail · histogram · FWHM · note. Star count is not shown in the list; it is quoted in the Light Frames prose. If the owner wants it back, add a column.
7. **Illustrations are full width (1200×360)** above the first section; a 440×330 ROI image slot sits beside "The problem you can see" on every lesson page. Stage D (static art) should produce those ROI crops at 2× for the illustration slot.
8. **Amp-glow example** on Darks (display-only old-camera dark) conflicts with "ROIs only". Owner decision pending (see copy.md P3).
9. **P2 Bias replaces SPEC P2's histogram, sample-pixel readout and SVG peel-away (owner direction, 2026-09-24).** The Try-it stage is a Raw / Computed / What was removed ROI with one Bias toggle and a two-bar chart of the average pixel brightness in the ROI (raw vs computed, bias share marked as a cobalt segment with a circle marker). No histogram, no per-pixel readout, and the illustration is static. The lesson holds `dark=false` so the bias is actually applied (SPEC §6.1 drops it when a dark is on); that rule is taught on Darks. The master bias is shown whole-field in the reading column (owner asked to see the grain), a further exception to "ROIs only". SPEC P2's AC ("histogram shift equals the master bias median within 1 ADU") should become "the drop in ROI average equals the ROI mean of the master bias".
10. **Prototype flow across Figma pages.** Prototype links cannot cross pages, so the final flow is assembled on the "Prototype" page by moving one frame per app page there and wiring Next/Previous. Page agents build on their own pages first.

10. **P0 Welcome has no "Try it" stage and no ROI tiles (owner direction, 2026-09-24).** The page skeleton in §1 lists a dark stage on every lesson page; Welcome is the exception. Its reading column is: page head → illustration "Welcome / From one exposure to a photograph" (1200×360) → observatory prose → the hook, a dark box with three full-field images (one 300 s sub f07, the WBPP master, the colour composite) → the colour composite at column width with the galaxies prose → BottomNav with a single "Start: Noise & Defects →" button (Previous hidden). SPEC P0 stands; the skeleton rule needs the exception written down. Full-field views are allowed on Welcome per §5.1.
11. **Welcome prose does not define its terms.** SPEC §9 asks that light, stack, calibration and similar words be defined on first use. The owner's Welcome text uses "calibration frames", "stacking" and "stack" without definitions and is kept verbatim; the definitions land on Noise & Defects. Reconcile §9 or the Welcome copy.
12. **Deer Lick Group claim.** The Welcome prose says the four galaxies above NGC 7331 are gravitationally bound to it and will merge within 1–3 billion years. Published redshift distances place NGC 7335, 7336, 7337 and 7340 roughly ten times farther away, so they are a line-of-sight grouping. Kept verbatim at the owner's direction; flagged for a fact check before launch.
13. **Spelling on Welcome.** The owner's prose uses American spelling ("color"); captions and the illustration label on that page follow it ("Color photograph"). The rest of the file uses British spelling ("colour"). Pick one before the copy is final.

10. **P1 Noise & Defects is a reading-only introduction (owner direction, 2026-09-24).** No Try-it stage, no ink rule, no state variants. SPEC P1's interactive layer-selectable sensor SVG and the 1 → N averaging control with a 1/√N noise readout are not on the page; the illustration is the shared "Noise & Defects / Light path" component unchanged, and "why we stack" is explained in prose (four frames halve the random variation, sixteen quarter it). Item 5 above is therefore settled for this page: no readout. If the owner wants the averaging demo back, it belongs on the Alignment page (which already shows the √2 drop) or in the workbench.
11. **P1 survey vs "one idea per page".** The owner asked this page to tour every error source (random variation, readout offset, dark signal and hot pixels, uneven response, misalignment, satellites, clouds and tracking) with its fix, so it deliberately touches the topics of every later lesson, in one short block each with a real crop. The crops are provisional: the owner may remove them and keep badges and prose only. The whole-field flat and quarter-field cloud crops are static reading-column images, allowed under the ROIs-only rule's static-area exception.
12. **"Fix" lines in the P1 tour** are plain label text ("Removed with a dark frame."), not links or controls. They are set in label/md, text/primary.

14. **P5 Flats-2 layout and teaching choices (owner direction, 2026-09-24).** The illustration slot holds a histogram chart of the three raw flats instead of an optical-path drawing. The peaks are drawn at equal height (counts normalised per flat) on one linear brightness axis from black to the brightest value a pixel can report, with a grey band from the 85 % curve to the right edge labelled "Pixels are full: extra light spills over". Teaching beats exact counts here; the true counts are kept in `assets/flats-2/histograms.json`. The full-well limit is kept vague on purpose (no number) and lives in a Note aside, not in the core prose; SPEC P5 wanted it as the core explanation. The chart reuses cobalt / ochre / red as series colours with a text label at every peak, so colour is not the only carrier, but those tokens also mean bias / flat / dark elsewhere; revisit if it confuses.
15. **P5 stage is a four-way chip group, not a toggle.** States: No flat (default, frame A), 10 %, 50 %, 85 %. The Computed tile and its caption follow the chips; the "What was removed" tile shows the difference for the chosen flat, and in the No-flat state it shows the 50 % difference so the tile is never blank. The owner should confirm that last choice; the alternative is a neutral grey "nothing removed" tile.
16. **P5 claim that the 10 % flat leaves a trace of the dust shadow.** `flat_check.json` gives a residual mote contrast of −0.54 % with the 10 % flat and +0.36 % with the 50 % flat, so the numbers are nearly equal and of opposite sign. The prose says a trace survives with the 10 % flat (owner direction: let the example show it). Check the tiles in the built app; if the difference is not visible, soften the sentence.
17. **P5 shows three full-field views** (the master flats) in a static reading-column box, the same exception to "ROIs only" as Flats-1's real flat and before/after pair.

## 6. Figma API gotchas recorded for other agents

- `figma.createAutoLayout()` frames get a default opaque white fill: set `fills = []` on every container.
- `resize()` on a TEXT node after `textAutoResize = 'HEIGHT'` resets it to `NONE`; set HEIGHT after resize.
- Font style strings in this file: Jost "SemiBold"; Public Sans "SemiBold"; Inter "Semi Bold" (with a space).
- Text nodes wired to a TEXT component property show the property default in instances; don't rely on per-variant characters for wired text.
- Concurrent `use_figma` calls are fine on different pages; same-page writes are sequential.
