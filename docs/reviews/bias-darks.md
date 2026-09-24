# Review: Bias and Darks lesson pages against Figma

Date: 2026-09-24. Reviewer branch `review/calibration`, built from `main` at 7a28949 (Merge core/lessons-b).
Figma file `jtYi1LQf1fVyUAUfAgthP5`. Bias: "P2 · Bias — A · bias off" 60:1200, "B · bias on" 99:260 (page 8:5). Darks: "P3 · Darks — A · dark off" 78:2, "B · dark on" 103:2179 (page 8:6; `docs/figma-state.json` still lists the older B id 88:2220).

Method. Vite dev server on port 5191, full-page screenshots at 1440 px with `e2e/shot.mjs` (state A) and `e2e/shot2.mjs … 1` (state B, first `role=switch` clicked). Every text node, image, toggle and bar was measured in the DOM (bounding box, computed font, colour) and compared with `get_metadata` / `get_design_context` for the same nodes; screenshots were compared band by band. Every raster asset in the frames was downloaded and diffed against the file the page ships (`src/sections/{bias,darks}/assets/`). Reference: SPEC §7 P2/P3 and `docs/design-notes.md` §5 items 9–13.

Severity: **blocker** = wrong content or missing element; **major** = layout or size off by more than 8 px, wrong colour or type; **minor** = 8 px or less, or wrapping from font metrics.

Coordinates below are page y at 1440 px. The app TopBar is 106 px tall against Figma's 104, so every app y is +2 relative to the frame; that offset is ignored in the verdicts.

## Summary

Both pages match their frames in content, order, geometry, type and colour. All prose, captions, labels and numbers are verbatim. All eleven raster assets are pixel-identical to the Figma fills (the amp-glow image is a faithful downscale). The two interactions (toggle, bar chart / tile swap) behave as frames A and B show, and each page writes its own store field.

No blockers. No page-owned majors. Four minors (two on Darks, all wrapping from font metrics; two cosmetic). One **major in a shared component** (the Foundation `Toggle` does not look like Figma 9:117), which is visible on both pages. Shell (TopBar / BottomNav) differences are listed separately at the end.

## Page: Bias (`/calibration/bias`, `src/sections/bias/`)

### Feature list and verdicts

| # | Feature (from the frame) | Verdict | Evidence / difference |
|---|---|---|---|
| B1 | Page head: eyebrow "Chapter 4 · Calibration" (eyebrow style, text/link), H1 "Removing the bias from every pixel" (Jost 600 40/46, −0.5 tracking, 900 wide), lede (Public Sans 18/28, text/secondary, 680 wide, 4 lines) | PASS | Text verbatim. App: eyebrow y 170, H1 y 198 h 46, lede y 256 h 112; Figma: 168 / 196 / 254, h 112. Colours #1F4AA8 / #1C1A17 / #6B655C. |
| B2 | Illustration box: 1200 wide `surface/card` box, 1 px `border/default`, radius 6, 24 px padding, 1152×345.6 "Bias / Where the bias comes from" component (cobalt highlight band over the ADC, ADC layer outlined cobalt, telescope/camera at 35 %) | PASS | Box at (120, 400) 1200×604 (Figma 603.6). SVG 1152×346. Rendered drawing compared side by side with a screenshot of 60:1209: same geometry, labels, band position, colours. |
| B3 | Two prose paragraphs inside the box (body/md, 1152 wide, 24 gap) | PASS | Verbatim including the curly quotes around “bias”. Heights 96 and 72 in both. |
| B4 | "What the master bias looks like" H2 + paragraph (680 wide, both in plain black per the frame) | PASS | Verbatim. App uses `text-black` as the frame does (the frame does not use the `text/primary` token here; a Figma nit, not a page defect). |
| B5 | Master bias full-field box: 1200×819 `surface/stage` box, radius 6, 24 padding, 1152×771 image | PASS | Box at y 1214, image at (144, 1238) 1152×771. `bias_full.png` is byte-for-byte the Figma fill (1245×834, mean abs diff 0.0). Grain and vertical bands visible. |
| B6 | "Taking the bias away" H2 + paragraph (680 wide) | PASS | Verbatim; paragraph 120 tall in both. |
| B7 | Side panel: 440 wide `surface/panel` (#E7DCCB) box, radius 6, 24 padding, eyebrow "Average pixel brightness, region below", mono/lg "1,233 − 161 = 1,073" (with the true minus sign), body/sm explanation 392 wide | PASS (minor note) | Panel at x 848, eyebrow x 872 y 2089, equation y 2117 (IBM Plex Mono 500 22/28), explanation 80 tall. All match Figma (848 / 24 offsets / 80). Note: the frame's panel text inherits pure black from `section-subtract`; the app eyebrow is `text/primary` #1C1A17. Not visible. |
| B8 | Ink rule 1440×6 `ink/900` between reading and stage | PASS | App (0, 2325) 1440×6 #1C1A17; Figma y 2322.6. |
| B9 | Try-it stage: full-width `surface/stage` (#0F1220), 120 side padding, 48 vertical, 820 tall | PASS | App 820 tall at y 2331; Figma 820 at 2328.6. |
| B10 | Stage head: eyebrow "Try it" (on-stage-muted), H2 "Remove the bias" (on-stage), instructions 680 wide, 2 lines, with the double space after "again." | PASS | Verbatim including the double space (rendered with `whitespace-pre-wrap`). Instructions 48 tall in both. |
| B11 | Experiment header: H3 "Removing the bias" (Jost 500 22/28), Toggle "Bias" 24 px right of it, help text 360 wide 3 lines | PASS (see S1 for the toggle's look) | H3 at x 120 w 179 (Figma 178). Track at x 323 (Figma 322), label "Bias" at 379 (44 track + 12 gap). Help at x 431 (Figma 430), 60 tall. Verbatim. |
| B12 | Tiles: two 320-wide ROITiles 24 apart, `surface/stage-raised` (#181C2E) fill, 1 px `border/on-stage` (#2A3050), head strip "Raw" / "Computed" (label/md, 12×10 padding), 318×240 image well, caption strip (body/sm on-stage-muted) | PASS | Tiles at x 120 and 464, 320×322 each (Figma 320×322). Wells 318×240. Head text at (133, 2628). |
| B13 | Tile images. A: both tiles show the raw crop. B: Computed shows the bias-subtracted crop | PASS | `roi_raw.png` and `roi_computed_bias.png` (720×480) are pixel-identical to the frame fills (mean abs diff 0.0 against both A and B frame images). In B the Computed `img.src` switches to `roi_computed_bias.png`; the Raw tile stays. |
| B14 | Tile captions. Raw: "Light frame as recorded". Computed A: "Without the bias removed - Bias toggled off". Computed B: "With the bias removed - Bias toggled on" | PASS | Verbatim in both states, hyphen-minus as in the frame. |
| B15 | Bar chart "Average pixel brightness in this region": eyebrow; row "Raw" = 96 label + 16 gap + bar (84 cobalt/400 bias share + 556 cream/300 rest = 640) + 16 gap + mono/lg "1,233"; row "Computed" | PASS | A: cobalt segment (232, 3009) 84×24 #4A78D6, cream (316, 3009) 556×24 #D5C6AE, value "1,233" at x 888 (Figma 120+768). Computed row identical to Raw in A (bias share 84 + 556, value 1,233), matching frame A. |
| B16 | Bar chart state B: Computed row loses the cobalt share, cream 556 only, value "1,073" moves in to x 684 (+120) | PASS | B: Computed cream at (232, 3049) 556×24, no cobalt; value "1,073" at x 804 = 120 + 684. Raw row unchanged. |
| B17 | Legend: 10 px cobalt/400 disc + label/sm "Bias share: 161 in this region" (on-stage-muted, +0.2 tracking) | PASS | Disc SVG `fill="#4A78D6"` r 5 — identical to the Figma `bias-marker` SVG. Label at (138, 3087), 12/16 Public Sans 500. |
| B18 | Numbers come from `stats.json` (1,233 / 161 / 1,073) and `1,233 − 161 = 1,073` holds | PASS | `roi_mean_raw_dn` 1233.3, `roi_mean_bias_dn` 160.5, `roi_mean_computed_dn` 1072.8; rounding gives 1,233 − 161 = 1,072 arithmetically but 1,073 is the rounded true mean; the page and the frame both show 1,073. Design-notes item 9's revised AC ("the drop in ROI average equals the ROI mean of the master bias") holds to 0.5 DN. |
| B19 | Toggle interaction: click turns Bias on (aria-checked true, cobalt track), click again turns it off; default state on entry is A (off) | PASS | Verified with Playwright: false → true → false. Page effect sets `calibration.bias = false` on mount. |
| B20 | Store write `calibration.bias` | PASS (caveat C1) | `setBias` spreads `calibration` and writes `bias`. Design-notes item 9 says the lesson should also hold `dark = false` so the bias is actually applied under SPEC §6.1; the page does not touch `dark` (store default `true`). With static PNGs this has no visible effect today; it will matter when the tiles come from the pipeline. |
| B21 | BottomNav: "← Noise & Defects" (Secondary) / "Darks →" (Primary), 88 tall | shell | See S2. |

Bias page verdict: every page-owned feature passes. Page height 3248 vs frame 3236.6; the 11.4 px is entirely TopBar (+2) and BottomNav (+9), see shell.

## Page: Darks (`/calibration/darks`, `src/sections/darks/`)

### Feature list and verdicts

| # | Feature (from the frame) | Verdict | Evidence / difference |
|---|---|---|---|
| D1 | Page head: eyebrow "Chapter 4 · Calibration", H1 "What the camera records in the dark", lede 900 wide in three paragraphs (long paragraph, a zero-width-space spacer paragraph, closing paragraph), body/lg text/secondary, 280 tall | PASS (info I1) | Verbatim. Paragraphs 168 + 28 + 84 = 280 tall (Figma 280). The zero-width-space spacer paragraph is reproduced literally, as in the frame. |
| D2 | Light-path box: 800 wide `surface/card` box, 1 px border, 24 padding, 752×225.6 "Darks / Where dark signal comes from" component (red highlight band, Pixel Grid and Amplifier layers outlined red), two paragraphs 752 wide | PASS | Box at (120, 568) 800×460 (Figma 459.6). SVG 752×226. Drawing compared with a screenshot of 78:11: same. Paragraphs verbatim, 96 and 48 tall. |
| D3 | Dark column at x 944: 376×252 image of the master dark, label/md "The dark recorded by the camera", body/sm caption 60 tall | PASS | Image at (944, 568) 376×252, pixel-identical to the Figma fill. Title y 832 (Figma 830), caption y 864 h 60. Verbatim. |
| D4 | Problem section, left column: 320×320 pixel patch shown with nearest-neighbour scaling, then H2 "The problem you can see" (440 wide) and paragraph 120 tall | PASS | `img` 320×320, `image-rendering: pixelated` confirmed in computed style. H2 y 1404 (Figma 1401.6). Paragraph 120 tall. Patch is pixel-identical to the frame fill. |
| D5 | Problem section, right column at x 608: 712×485 amp-glow image, label/md "Amplifier glow on an older camera", body/sm caption 712 wide, 100 tall | PASS | Image (608, 1060) 712×485. `ampglow_full.png` is a 1424×970 downscale of the 4144×2822 Figma fill (correlation 0.98, same mean 78.0); the fan at the right edge reads the same. Caption verbatim, 100 tall (5 lines) in both. |
| D6 | "Matching the dark to the light" H2 + paragraph 680 wide | PASS (minor M1) | Verbatim. Paragraph wraps to 6 lines (144 px) in Chromium vs 5 lines (120 px) in Figma: "one." falls onto its own line. Section height is unchanged (226, set by the callout), so nothing below moves. Font metrics only. |
| D7 | Why callout at x 848: 440 wide `surface/card`, 1 px `border/strong`, 24×16 padding, eyebrow "Why?" in text/link, label/md "Why some grain remains", body/sm body | PASS | Box 440×226 (Figma 226). Eyebrow (873, 1738) #1F4AA8, title 20 tall, body 140 tall (7 lines) — same as the frame. Verbatim. |
| D8 | Ink rule 1440×6 | PASS | (0, 2011); Figma 2008.6. |
| D9 | Stage: `surface/stage`, 120/48 padding, 778 tall in A | PASS | 778 at y 2017 (Figma 778 at 2014.6). |
| D10 | Stage head: "Try it", H2 "Subtract the dark", instructions 680 wide 3 lines | PASS | Verbatim, 72 tall. |
| D11 | Experiment header: H3 "Subtracting the dark", Toggle "Dark", help 360 wide 3 lines | PASS (see S1) | H3 w 198 (Figma 197); track x 342 (Figma 341); label at 398; help at 454 (Figma 453), 60 tall. Verbatim. |
| D12 | Tiles: 320-wide ROITiles with 318×318 pixel wells (`image-rendering: pixelated`); Raw tile 420 tall, Computed tile 400 tall in A | PASS | Figures (120, 2327) 320×420 and (464, 2327) 320×400; wells 318×318 at (121, 2368) and (465, 2368); both `img` elements pixelated. Matches Figma 78:55 / 78:56 exactly. |
| D13 | Tile images. A: Raw = light − bias; Computed = the same (dark off). B: Computed = light − master dark | PASS | `roi_raw.png` and `roi_computed_dark-off.png` are pixel-identical to each other and to both frame-A fills; `roi_computed_dark-on.png` is identical to the frame-B Computed fill (mean abs diff 0.0). In B the Computed `src` switches; Raw stays. |
| D14 | Ochre ring marker (40×40, `ochre/500` #E3A81E stroke 3, r 18.5) centred on the circled hot pixel, on both tiles, both states | PASS | App SVG `circle r=18.5 stroke=#E3A81E stroke-width=3` — identical to the Figma `marker-hot-pixel` SVG. Centres at (282, 2529) and (626, 2529) = well-relative (161, 161) = pixel (32, 32) of 64 at 5× (Figma 162.5 / 626.5 → 161.5 well-relative). Present in A and B. |
| D15 | Captions. Raw: "The light frame. The circled hot pixel reads 1,887; the background around it 607." Computed A: "The light frame · Dark toggled off". Computed B: "Light frame minus the master dark. The circled hot pixel now reads 761 against a background of 607, and blends into the grain. The other hot pixels are dimmer but still there." | PASS (minor M2) | All verbatim (middle dot in A). Raw caption 2 lines (40) in both. The B caption wraps to 4 lines (80 px) in Chromium vs 5 lines (100 px) in Figma, so the Computed tile is 460 tall vs 480 and the stage 818 vs 838. Font metrics only; the frame itself shows the tile growing with the caption. |
| D16 | Caption numbers match `stats.json` | PASS | `raw_dn` 1886.5 → 1,887; `computed_dark_on_dn` 760.6 → 761; `background_median_dn` 607.1 → 607. |
| D17 | Toggle interaction: off → on → off; entry state A | PASS | aria-checked false → true → false. Page effect sets `calibration.dark = false` on mount. |
| D18 | Store write `calibration.dark` only; bias untouched (design-notes item 10: bias is applied to every image and never discussed) | PASS | `setDark` writes `dark` only. Cross-page check: turning Bias on, then opening Darks, leaves Darks in state A and does not touch `bias`. No mention of bias anywhere on the page. |
| D19 | No temperature-mismatch note, no "What was removed" tile, single Dark toggle (design-notes items 10, 11, 13) | PASS | None present, as the owner directed. |
| D20 | BottomNav: "← Bias" (Secondary) / "Flats →" (Primary) | shell | See S2. |

Darks page verdict: every page-owned feature passes; two wrapping minors.

## Shared component (Foundation-owned, visible on both pages)

**S1 — Toggle look does not match Figma 9:117 (major, colour).** Both pages use `Toggle` from `src/shared/ui/controls.tsx` with `onStage`. Figma, from the exported track SVGs on 60:1250 / 99:295:

- Off: 42×22 pill, `cream/50` #F7F2EA fill, 2 px `ink/900` #1C1A17 stroke, `ink/900` knob r 7 at cx 12.
- On: `cobalt/600` #1F4AA8 fill, 2 px `ink/900` stroke, `cream/50` knob r 7 at cx 32.

App on stage: off = `space/800` #181C2E fill, 1 px `cream/300` border, `cream/300` knob r 8; on = cobalt fill with cobalt border, white knob r 8. Size and position (44×24 at the right x) are correct; only fill, stroke and knob colours differ. Same in both states on both pages. The component description says focus is a 3 px ink outline around the track; the app uses `focus-stage` (not checked here).

## Shell (foundation-owned) — TopBar / BottomNav

Listed for the Foundation agent; not counted against the pages.

**S2 — BottomNav (11:28).** Figma: 88 tall, `surface/page`, 1 px `border/default` top, 120 px gutters, "← Noise & Defects" Secondary button (surface/card, 2 px ink border, radius 6, 44 tall) at the left, "Darks →" Primary (cobalt, radius 6) at the right; on Darks "← Bias" / "Flats →". App: 97 tall, 1 px `border/strong` top. On Bias only one button, "Start: Darks ›" (Primary, 40 tall, radius 2) — no Previous because Bias is the first entry in `src/shell/sections.ts` (Welcome and Noise & Defects are not registered). On Darks: "‹ Previous: Bias" as a Ghost button and "Next: Algorithms" drawn as an outlined Secondary rather than Primary cobalt; "Flats" is not registered so Next points at Algorithms. Label pattern "Previous: X / Next: X" differs from Figma's "← X / X →".

**S3 — TopBar (17:1087).** Figma: 104 tall; chapter row lists Welcome · Noise & Defects · Calibration · Alignment · Algorithms · Light frames · Workbench in `text/link` cobalt, current chapter in ink with a 3 px cobalt indicator, 2 px ink rule under the row; page row on `surface/panel` cream with Bias · Darks · Flats · Flats, continued in cobalt, current in ink with a 3 px indicator. App: 106 tall; chapters "Calibration · Algorithms" only (registry), ink text with a 3 px ink indicator and 1 px rule; page row on the page background with Bias · Darks only, current shown by an underline. Brand block, 120 px gutter and the 304 px brand column match.

## Caveats and information

**C1 (Bias, contract).** `docs/contracts.md` says "Lesson pages never reset the store; they read/write only the fields they teach." Both pages reset their own field to `false` on mount so the lesson opens in frame A. That is a write to the taught field, so it is within the letter of the rule, but it is a reset, and on the Bias page it is incomplete: design-notes §5 item 9 says the Bias lesson holds `dark = false` so the bias is actually applied under SPEC §6.1 (bias dropped when a dark is on). With static PNGs nothing is visibly wrong; when the tiles come from the pipeline, a `dark = true` default would make the Computed tile identical to Raw. Decide: either the Bias page sets `dark = false` too, or the pipeline call for this lesson passes an explicit calibration rather than the store's.

**I1 (Darks).** The lede's spacer paragraph is a literal zero-width space in a `<p>`, copied from the frame. Screen readers announce an empty paragraph. Replacing it with a 28 px margin gives the same geometry; optional.

**I2 (both).** The frames set the reading H2s and the side-panel text in plain black rather than `text/primary`; the pages reproduce that. If the library owner tokenises those nodes, the pages should switch to `text-text-primary`.

## Ordered fix list for the implementer

1. **Foundation: restyle `Toggle` to Figma 9:117** (S1, major). Off: `surface/card` fill, 2 px `border/strong` stroke, `ink/900` knob r 7 at x 12. On: `accent/primary` fill, 2 px `border/strong` stroke, `cream/50` knob r 7 at x 32. Keep the 44×24 outer box and the 12 px gap to the label. No page change needed; both pages pick it up.
2. **Foundation: BottomNav to Figma 11:28** (S2): 88 tall, "← {prev}" Secondary / "{next} →" Primary, 44 tall, radius 6, `border/default` top rule; register the missing sections so Bias gets "← Noise & Defects" and Darks gets "Flats →".
3. **Foundation: TopBar to Figma 17:1087** (S3): 104 tall, cobalt chapter and page links, 3 px cobalt indicators, 2 px ink rule, `surface/panel` page row, full chapter and page lists.
4. **Bias page: decide the `dark` field** (C1). Either add `dark: false` to the on-mount write (and note the exception in contracts.md) or keep the store untouched and pass the lesson's calibration explicitly to the pipeline when it lands.
5. Optional, Darks (I1): replace the zero-width-space spacer paragraph with a 28 px gap.
6. No action on M1 / M2 (one-line wrapping differences in Chromium vs Figma's text engine; geometry above and below is unaffected on M1 and the tile grows with the caption on M2 exactly as the frame does).

## Artefacts

Screenshots and DOM measurements used for this review were produced in the reviewer's scratchpad (`rv/bias_a.png`, `rv/bias_b.png`, `rv/darks_a.png`, `rv/darks_b.png`, `rv/m_*.txt`, Figma exports under `rv/fig_*.png` and `rv/figassets/`). They are not committed; rerun `node e2e/shot.mjs` / `node e2e/shot2.mjs` against `#/calibration/bias` and `#/calibration/darks` to reproduce.
