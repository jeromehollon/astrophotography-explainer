# Review: Light frames 2 (Review the exposures) and Workbench

Date: 2026-09-24. Branch reviewed: `main` at e177c6c. Figma is the source of truth: file `jtYi1LQf1fVyUAUfAgthP5`, frames "P8 Light frames 2 — A average" 121:2, "B median" 133:7083, "P9 Workbench — A default scenario" 126:4081, "B stacking" 133:4088. Reference reading: SPEC §3, §4.5, §4.6, §6.1, §6.6, §7 P8/P9; docs/design-notes.md §3 and §5 items 26–38.

Method: Vite on :5194 with the API on :8194 (`ASTRO_DATA=data/derived/runtime`), Chromium 1440×900 via Playwright (`e2e/review-wb.mjs`, `e2e/review-wb2.mjs`). "Settled" means no tile shows "Result pending" or "Stacking…" and every live view holds a canvas (not the bundled fallback PNG). Timings are wall-clock from click to settled; "warm" means the pipeline cache already holds the result. Screenshots were compared band by band against Figma renders at 1:1 (Pillow crops, same page coordinates).

Severity: **blocker** = wrong content, missing element, broken interaction; **major** = layout/size off > 8 px, wrong colour/type, timing > 2 s warm, visibly wrong image; **minor** = everything else.

## Summary

Both pages are structurally faithful to Figma: every section, control, table column, row and text string is present, in the right order, at the Figma x/y positions within 2 px, and the live pipeline drives every image. All interactions work and every measured update is under 1 s (warm 100–140 ms, cold 275–900 ms). No blockers.

The one major finding is visual: every live image (ROI strip, wide galaxy view, whole-frame viewer, viewer ROIs) is rendered noticeably flatter and greyer than the Figma stand-ins. The code uses SPEC §4.5's AutoSTF (target background 0.25, clip −2.8·MADN); the design assets were made with 0.30 / −1.8. Measured on the same pixels, the live wide view has a 5–95 percentile spread of 63–73 grey levels against 63–97 in Figma; the galaxy ROI 62–81 against 51–128. The faint outer disc, the trail and the background texture that the lessons talk about are much harder to see. Either the SPEC parameters or the design assets need to change; the page should not ship with two different looks between the lesson art and the live tiles.

Everything else is minor: a page-transition flicker to the bundled PNG with no Pending marker on the review page (the `Render` component drops its `className`), an extra note under "Bias" that is not in the Figma frame, the workbench back button label, arrow keys not moving between chips, focus not moving to Cancel, and a Figma-side artefact that makes the report section sit 76 px higher in the app than in the frame.

## Timings (Chromium, localhost, 20-core pool)

| Action | Cold | Warm | Target |
|---|---|---|---|
| Review page first paint → live wide view + 4 viewer ROIs | 2.0 s networkidle + 0.7 s | – | < 2 s render (P0 AC); ok |
| Review: Median ↔ Average | 631 ms | 105 ms | < 1 s (P8 AC) PASS |
| Review: untick one frame | 541 ms | – | < 1 s PASS |
| Review: Next frame (whole frame bin 4 + 4 ROIs) | 334 ms | – | PASS |
| Workbench: scenario Naive (24 frames, average) | 818 ms | 139 ms | < 1 s (P9 AC) PASS |
| Workbench: Satellite / Cloud / Tracking / Default | 275 / 328 / 320 / 122 ms | 107 ms | PASS |
| Workbench: untick frame 0003 | 121 ms | 102 ms | PASS |
| Workbench: Flat 85 % / No flat | 896 / 846 ms | – | PASS |
| Workbench: Kappa-sigma clipping | 770 ms | – | PASS |
| Download PNG (6224×4168, 20 frames, median, bin 1) | 14.6 s, progress visible after < 1.5 s | – | progress + cancel required; PASS |

## P8 Light frames 2: Review the exposures (`#/light-frames/review`)

Live page height 3702 px vs Figma 3703. Section tops (title 196, "Your selected stack" 342, stack image 486, "Examine the images" 1438, columns 1568, teaser 3468) match Figma within 1 px.

| # | Feature (Figma) | Verdict | Notes |
|---|---|---|---|
| 1 | TopBar with "Light frames" current and second row "Image Worthiness / Review the Exposures" | PASS | Matches 121:3. |
| 2 | Page head: eyebrow "Chapter 7 · Light frames", h1 "Review the exposures", lede "Move through the photographs, compare the fixed galaxy view, and choose what contributes to your stack." | PASS | Verbatim; eyebrow link-blue, lede secondary, widths 900/680. |
| 3 | h2 "Your selected stack" | PASS | |
| 4 | "Stack algorithm" (h3) + Chip group Average / Median, exactly one selected | PASS | Live default is Median (store default, SPEC Default scenario) = Figma frame B; Average = frame A. `role=radiogroup`, `aria-checked` on chips. |
| 5 | Dark stack box 1200 wide, 24 px padding, 1152×864 image well, caption body/sm muted | PASS | Well measures 1152×864 at x 144. |
| 6 | Wide view is a live stack of the ticked frames, Noise & Defects region 2400×1800 at bin 2, master orientation | PASS (content) / **major** (stretch) | Same region and orientation as Figma (galaxy centred, two small galaxies above). Stretch is visibly flatter: live p5/p50/p95/p99.5 = 63/67/73/114 vs Figma 63/75/97/175. See "Stretch" below. |
| 7 | Caption "Average of the twenty ticked photographs: the galaxy, its faint outer disc, and the two small galaxies above it." / "Median of …" | PASS | Verbatim, count word follows the selection ("nineteen" after one untick, "five" for the Cloud scenario). |
| 8 | Median vs Average changes the wide view | PASS | Canvas hash changes; 631 ms cold, 105 ms warm. |
| 9 | Pending state while the stack recomputes | **minor** | For ~600 ms the wide view swaps to the bundled `stack_wide_<method>.png` (design stretch, brighter) and then to the live canvas: a visible flicker between two looks. The `pending && 'opacity-60'` class is passed to `Render`, which ignores `className`, so no Pending marker ever shows (design-notes §3: inputs changed → Pending). |
| 10 | h2 "Examine the images" + paragraph "The shaded rows show which photographs contribute to the stack. Click a row to look more closely at that photograph, or use its checkbox to compare the result with and without it." | PASS | Verbatim. |
| 11 | Frame list header row: Frame / Image / FWHM / Note / Histogram at x 42 / 94 / 189 / 273 / 452, 2 px rule | PASS | Measured 162/214/309/393/572 page-x = 120 + Figma x. |
| 12 | 24 FrameCards 560×72, gap 4: 20 raw (Selected, `source/bias-soft` fill) then f11_tracking, f14/15/16_cloud (Default, cream) | PASS | 24 rows, 72 px tall, checked rows rgb(199,214,242), unchecked rgb(247,242,234). |
| 13 | Card columns: checkbox · number (mono) · 83×56 thumbnail · FWHM label + value · note (purple label/sm) · drawn 96×40 histogram at x 452 | PASS | Numbers 0000–0019, copies keep their original's number (0011, 0014, 0015, 0016). FWHM values match Figma for all 24 (8.9, 8.9, 8.1, 9.6, 8.4, 8.2, 8.7, 8.5, 8.3, 8.0, 8.4, 8.2, 8.2, 8.1, 8.3, 8.2, 9.1, 9.2, 9.2, 8.6, 8.6, 8.3, 8.1, 9.1). Notes "Satellite trail", "Tracking error example", "Cloud cover example" as in P8-2. Histograms are full-range spikes in the second bar as Figma draws them. |
| 14 | Ticking a checkbox changes the stack, not the viewer; clicking a row shows that frame | PASS | Untick 0003 → row turns cream, wide view changes, caption says nineteen. Row click → viewer "Frame 0011" with the tracking caption. Rows are `role=button` with Enter/Space. |
| 15 | Viewer nav: Ghost "← Previous frame", h3 "Frame 0003", Ghost "Next frame →", 616 wide | PASS | Wraps around the list (Previous from the first copy goes to 0019). |
| 16 | Dark frame box 616 wide, 584×391 well, caption "Frame 0003, the whole photograph. The satellite trail crosses the upper left." | PASS | Verbatim. Other frames: "Frame 0004, the whole photograph."; copies: "… A copy of frame 0011 with a tracking error: the stars are trailed." / "… with patchy cloud." (not in Figma; reasonable). |
| 17 | Whole frame is live (calibrated, bin 4, master orientation) | PASS (content) / **major** (stretch) | Same orientation and trail position as Figma. Live p5–p95 = 57–70 vs Figma 34–86: the vignetting/gradient and the trail are barely visible. |
| 18 | 2×2 ROITile grid 300×241 (298×199 wells): Satellite trail, Central galaxy, Galaxy group, Dust mote; live at bin 2 | PASS (content) / **major** (stretch) | Titles and sizes exact; ROIs show the same regions as Figma. Trail ROI live p5–p95 61–73 vs Figma 46–100; galaxy 62–81 vs 51–128. |
| 19 | Previous/Next update the whole frame and the four ROIs | PASS | 334 ms. |
| 20 | Teaser: h2 "Next: the workbench", p "Try sigma clipping and the other methods alongside calibration in the workbench." | PASS | Verbatim. |
| 21 | BottomNav "← Light frames" (Secondary) / "Workbench →" (Primary) | PASS | |
| 22 | Store carries state to the workbench | PASS | After unticking 0003 and picking Median: workbench reports "Custom", "19 of 24 ticked", Method Median, 0003 unticked, calibration unchanged. Cloud Challenge chosen on the workbench → review shows Average, five frames ticked (0009, 0013, 0014/15/16 copies), "Average of the five ticked photographs". |
| 23 | Store with a method the review page cannot show (winsorized) | minor | The review page shows Median selected and stacks a median; the store still holds winsorized and the workbench shows it on return. Acceptable given two chips, but the review caption then describes a median the learner did not choose. |

## P9 Workbench (`#/workbench`)

Live page height 6121 px vs Figma 6193. Section tops match Figma within 2 px (title 497, Scenarios 699, Calibration 933, Flat calibration 1924, Light frames 2978, Combination method 5056) except "Your master" (live 5547, Figma 5623): the Figma report header contains an empty 100×100 `lesson-links` frame that pushes its h2 down 73 px. The app's spacing is the consistent one; Figma should drop the empty frame.

| # | Feature (Figma) | Verdict | Notes |
|---|---|---|---|
| 1 | TopBar with "Workbench" current | PASS | |
| 2 | ROI strip: dark bar 1440×301 directly under the top bar, padding 16/120, four ROITile 282×269 at x 120/426/732/1038, titles Satellite trail / Central galaxy / Galaxy group / Dust mote, no caption | PASS | Measured exactly. Figma has no caption on the strip tiles (design-notes item 31 mentions one; the frame does not). |
| 3 | Strip stays visible while the page scrolls ("fixed under the top bar") | PASS / minor | `position: sticky; top: 0`. The TopBar is static and scrolls away, so when scrolled the strip sits at the very top of the viewport rather than under the top bar. Acceptable if the top bar is meant to scroll; otherwise make the TopBar sticky and set `top: 104`. |
| 4 | Strip tiles are live stacks of the current selection, bin 2, master orientation | PASS (content) / **major** (stretch) | Regions and orientation match Figma (galaxy group's companion at right, trail region with no trail under the median). The 3:2 ROI is cover-fitted into the 280×227 well (18 % cropped left/right), same as Figma. Live p5–p95 65–68 / 65–83 / 65–69 / 59–63 vs Figma 68–81 / 71–123 / 68–84 / 43–62. |
| 5 | Hover enlarge of a strip tile (owner request in design-notes item 31, not in Figma) | not built | No change on hover. Not in the Figma frame; leave until the owner adds it. |
| 6 | Page head: eyebrow "Workbench", h1 "Build your own master", lede (five sentences) | PASS | Verbatim. |
| 7 | "Preconfigured Scenarios" + "Lesson: Algorithms →" right | PASS | |
| 8 | Five Buttons, Default Primary, others Secondary, gap 12: Default / Naive / Satellite Trail Challenge / Cloud Challenge / Tracking Error Challenge | PASS | Widths 101/90/212/160/219 vs Figma 97/89/210/160/216 (font metrics); heights 48. Selected scenario is Primary; when the state matches none, all are Secondary and the description says "Custom". |
| 9 | Description: name line + text, 1200 wide, body/md | PASS | Default text verbatim. Naive / Satellite / Cloud / Tracking descriptions follow the SPEC table and do not mention pier side. |
| 10 | Hover swaps the description to the hovered scenario and back on leave | PASS | Hovering Naive while Default is selected shows Naive; leaving restores the selected one. |
| 11 | Each scenario sets frames + method + calibration in one click, strip updates < 1 s | PASS | Naive → 24 frames, Average; Satellite → 5 frames; Cloud → 5; Tracking → 3; Default → 20, Median. All calibration full. Timings above. |
| 12 | "Calibration" table: header Calibration frame / Lesson / Master frame / Histogram (280/152/400/320), 2 px rule; rows Bias, Dark, Dark flat with FrameCard-style checkbox, h3 title, lesson link (Bias → / Darks → / Flats →), 376×252 master image, drawn 280×100 histogram | PASS | Layout, widths, links and histograms match. Dark flat uses the Figma-bundled darker render. |
| 13 | Bias row note | minor | Live shows "Already inside the dark; not applied on its own." under Bias (and "…; used for the flats only." when dark flats are off; nothing when the dark is off). The Figma A frame has no note text (labels frame holds the title only). design-notes item 36 asks for the sentence, so Figma and the notes disagree; Figma wins unless the owner adds the note to the frame. |
| 14 | "Flat calibration" + links "Lesson: Flats →", "Lesson: Flats, continued →" | PASS | |
| 15 | Flat table: header Flat / Master flat / Histogram (280/400/320); rows No flat ("No master flat", "No histogram"), Flat 10 %, Flat 50 %, Flat 85 % with checkbox, image, histogram; single choice | PASS | Exactly one row checked; ticking another moves the tick; unticking the ticked "No flat" keeps it ticked (a choice is always made). Histograms match Figma bar positions. |
| 16 | Changing the flat changes the strip (mote tile) | PASS | Flat 85 % and No flat each change all four tile hashes (896 / 846 ms). Note: at this stretch the mote itself is not visible in any state, as in Figma. |
| 17 | "Light frames" + links "Lesson: Light frames →", "Lesson: Alignment →" + paragraph | PASS | Paragraph verbatim ("Tick the photographs to combine. Step through them …"). |
| 18 | The P8-2 examine block (list + viewer) | PASS | Same component as the review page; the viewer's whole frame and ROIs use the workbench calibration. Figma P9 writes the copy note as "Tracking Error Example" while P8-2 writes "Tracking error example"; live uses the latter on both pages (Figma inconsistency, minor). |
| 19 | Unticking a frame changes the strip | PASS | 121 ms; description switches to "Custom", report "19 of 24 ticked". |
| 20 | "Combination method" + "Lesson: Algorithms →"; table Method / How it combines the pixel values / Suggested number of photographs (320/560/288); five rows with Chip + text + mono count | PASS | All ten strings verbatim; Median selected in Default. `role=radiogroup`. |
| 21 | Chip group keyboard: one tab stop, arrows move | minor | Each chip is its own tab stop and ArrowDown/Right do nothing (Chip component description: "Arrow keys move between chips; the group has one tab stop"). Same on the review page. |
| 22 | "Your master" + paragraph | PASS | Verbatim. |
| 23 | Report panel `surface/panel`, 24 px padding, rows Scenario / Calibration / Photographs / Method / Output (160/640/320) with mono values and lesson links | PASS | "Default", "Bias · Dark · Dark flat · Flat 50 %", "20 of 24 ticked", "Median", "6224 × 4168 pixels, 8-bit PNG with the stretch shown on screen"; links as Figma ("Lessons: Bias → Darks → Flats →"). Values follow the state (Custom, Kappa-sigma clipping, etc.). |
| 24 | "Download PNG" Primary button; state B: button disabled, ProgressBar "Stacking the full image…" + "N% · n of 20 frames", ochre fill, Cancel | PASS | Progress visible within 1.5 s ("11% · 2 of 20 frames"), button greyed as in 133:4088. Strip tiles go to Processing "Stacking… 11%" with the 4 px ochre bar (Figma 133:4090 shows "Stacking… 62%"). |
| 25 | Cancel returns to the previous result | PASS | Progress bar disappears, button re-enabled, tiles back to their live result. |
| 26 | Cancel keeps keyboard focus while the job runs | minor | After pressing Download PNG the button is disabled and focus falls to `body`; focus is not moved to Cancel (ProgressBar description). |
| 27 | A PNG downloads with the on-screen stretch and the settings in the filename | PASS | `ngc7331_stack_20f_median_bias-dark-darkflat-flat50.png`, 6224×4168, 30 MB, master orientation, full frame (uncropped edges). Filename matches design-notes §3 pattern. |
| 28 | BottomNav: "← Light frames" only, Next hidden | minor | Live reads "← Review the exposures" (previous page title). Figma 126:4146 says "← Light frames". Target is right (`#/light-frames/review`). |
| 29 | Strip Pending text | minor | While recomputing, strip tiles say "Result pending — press Stack". There is no Stack button on P9 (design-notes item 34 replaced it with Download PNG); the ROITile Pending copy should read "Result pending" here. |
| 30 | Tab order: scenarios → calibration checkboxes/links → flat checkboxes → lights list (row, checkbox, …) → viewer → chips → report → bottom nav | PASS | Follows reading order. |

## Stretch: live tiles vs design assets

`src/shared/pipeline/stf.ts` implements SPEC §4.5 (target background 0.25, shadows clip −2.8·MADN, linked, parameters from the reference frame's precomputed median/MADN for the active calibration state). `assets/light-frames-review/stats.json` records that the page art was made with `target_bg 0.3, shadows_clip −1.8`. The difference is large on screen:

| View (same pixels, 8-bit grey) | Figma p5 / p50 / p95 / p99.5 | Live p5 / p50 / p95 / p99.5 |
|---|---|---|
| Wide galaxy view (review) | 63 / 75 / 97 / 175 | 63 / 67 / 73 / 114 |
| Viewer whole frame 0003 | 34 / 67 / 86 / 135 | 57 / 65 / 70 / 91 |
| Viewer ROI Satellite trail | 46 / 74 / 100 / 138 | 61 / 67 / 73 / 90 |
| Viewer ROI Central galaxy | 51 / 82 / 128 / 205 | 62 / 68 / 81 / 137 |
| Strip Central galaxy (median of 20) | 71 / 81 / 123 / 203 | 65 / 68 / 83 / 142 |

The live result is not wrong (the stack is real, the region and orientation are right, the median has removed the trail), but it reads as a dull grey field where the lessons promise a visible outer disc, trail and vignette. Decision needed: adopt 0.30 / −1.8 in SPEC §4.5 and the pipeline (matches every static lesson asset), or regenerate the assets with 0.25 / −2.8. The reviewer's recommendation is the former: the lesson pages are already built on that look.

## Fix list for the implementer (ordered)

1. **Stretch (major).** Align the live AutoSTF with the design assets: change `autoStf` defaults (and SPEC §4.5) to target background 0.30, clip −1.8, or regenerate all P8-2/P9 assets at 0.25 / −2.8 and get the owner to accept the flatter look in Figma. Re-check with the numbers above. Until then the review page flickers between two looks (item 2).
2. **Pending marker on the review page (minor, visible).** `src/sections/workbench/Render.tsx` declares `className` but never applies it, so the `opacity-60` pending style never shows and the wide view flashes the bundled PNG for ~600 ms. Apply the class (or render the ROITile Pending state) and consider keeping the last live canvas instead of swapping to the bundled image once a live result has been shown.
3. **Bias row note (minor).** Remove the sentence under "Bias" or get it added to Figma 127:1091 (design-notes item 36 vs frame 126:4081 disagree). If it stays, the state-dependent wording needs owner copy.
4. **BottomNav label (minor).** Workbench back button should read "← Light frames" (Figma 126:4146), target unchanged.
5. **Strip Pending copy (minor).** "Result pending — press Stack" → "Result pending" on the workbench strip and the viewer tiles; keep "— press Stack" only where a Stack button exists.
6. **Chip keyboard (minor).** Make each Chip group a roving-tabindex radiogroup (one tab stop, arrows move and select) on both pages.
7. **Focus on Cancel (minor).** When Download PNG starts, move focus to the ProgressBar's Cancel button; return it to Download PNG on finish or cancel.
8. **Strip position (minor, needs owner call).** Decide whether the TopBar is sticky on P9. If yes, make it sticky and set the strip's `top` to 104; if no, current behaviour is fine.
9. **Figma housekeeping (not code).** Remove the empty 100×100 `lesson-links` frame in 128:1312 (it pushes "Your master" down 73 px); unify the copy note capitalisation ("Tracking error example") between P8-2 and P9; note that the strip tiles have no caption.
10. **Review page with a rejection method in the store (minor, owner call).** Either show a third disabled state ("Median" shown because the page has two methods) or add a one-line hint so the caption does not claim a method the learner did not pick.
