# Review: reading-only lesson pages vs Figma (P0, P1, P6, P8)

Reviewed 2026-09-24 against Figma file `jtYi1LQf1fVyUAUfAgthP5`, frames "P0 Welcome A" 57:619, "P1 Noise & Defects A" 61:1149, "P6 Alignment A" 73:2 and "P8 Light frames A" 94:46, at commit `aecaa92` (main). Method: full-page Playwright screenshots at 1440 px (`node e2e/shot.mjs`) set beside full-size Figma renders band by band; a DOM dump of every text node and image (position, size, computed font, colour) compared with the Figma node metadata; interactions driven with Playwright. Figma is the source of truth; SPEC §7 and `docs/design-notes.md` §3–5 give the intended behaviour.

Severity: **blocker** = wrong content or missing element; **major** = layout/size off by more than 8 px, wrong colour or type; **minor** = 8 px or less, or wrapping from font metrics.

Summary: all four pages carry the Figma copy verbatim, every image well holds the right asset at the right size, and every landmark sits within 2 px of its Figma position until the first font-metric wrap. Two page defects need fixing: the Noise light-path illustration hides its converging light rays behind the telescope and camera (major), and the enlarged view of the "Dark" tour thumbnail is only 360×240 (minor, asset). The shell differences (TopBar rows, BottomNav labels and height, no scroll-to-top on navigation, no "Light frames, continued" next page) are foundation-owned and listed separately.

---

## P0 Welcome (`/welcome` ↔ 57:619)

| # | Feature (from the frame) | Verdict | Detail |
|---|---|---|---|
| 1 | Eyebrow "Welcome" (Jost 13/16, 1.5 tracking, uppercase, text/link) | PASS | Exact text and style; y 170 vs Figma 168 (+2, from the shell TopBar). |
| 2 | H1 "Astrophotography Calibration and Stacking, Explained." (Jost 40/46 semibold, 900 wide, two lines) | PASS | 900×92, wraps identically. |
| 3 | Subtitle "Why every deep-sky photo starts with pictures of nothing." (Jost 24/32 medium, text/secondary) | PASS | Present, 900×32, same style. |
| 4 | Lede (Public Sans 18/28, text/secondary, 680 wide, 5 lines) | PASS | Verbatim, 680×140. |
| 5 | Triptych: dark stage box (surface/stage, radius 6, 24 padding), three 368×247 wells with 24 gap | PASS | Box 1200×327 at (120, 518); wells 368×247; assets `sub_full`, `master_full`, `colour_full` match the Figma renders. |
| 6 | Triptych captions "One exposure, 300 seconds" / "Stack of twenty exposures" / "Color photograph" (14/20, text/on-stage-muted) | PASS | Verbatim, colour rgb(213,198,174). |
| 7 | Two-column row: observatory prose (680) + cream side panel (440, surface/card, 24 padding) | PASS | h2 "An image you can experiment with, from my observatory" wraps to two lines (68 px) as in Figma; both paragraphs verbatim. |
| 8 | Side panel h3 "From a monochrome stack to a finished photograph" (Jost 22/28) + paragraph | PASS | 392×56 h3 at (872, 901); paragraph verbatim. |
| 9 | Two-column row: galaxies prose (472) + 680×457 photo with caption "NGC 7331 and its neighbors" | PASS | Prose 472 wide, four paragraphs verbatim (US spelling "neighbors", "center" kept); photo 680×457; caption 14/20 text/secondary. |
| 10 | Credit line "Photographs by Jerome Hollon · Stella Venator Observatory" (14/20, text/secondary, 1200 wide) | PASS | At (120, 1739) vs 1737. |
| 11 | BottomNav: single primary "Start: Noise & Defects →", Previous hidden | PASS (page) / see shell | Primary button present, Previous hidden. Label renders "Start: Noise & Defects" + chevron icon instead of the "→" glyph; nav is 96 px tall vs 88 (shell-owned, see below). |
| 12 | Interaction: Start goes to `#/noise` | PASS with caveat | Hash becomes `#/noise`; browser back returns to `#/welcome`. The new page opens scrolled to y = 1020 (the scroll position of the Start button carries over) because the router never scrolls to top — shell item S4. |
| 13 | Total page height 1909 | minor | 1920 (+11: TopBar +2, BottomNav +8, border). Shell-owned. |

## P1 Noise & Defects (`/noise` ↔ 61:1149)

| # | Feature | Verdict | Detail |
|---|---|---|---|
| 1 | Page head: eyebrow "Chapter 2 · Noise & Defects", H1 "What a single photo of the sky contains", 5-line lede | PASS | Verbatim; 680×140 lede. |
| 2 | Illustration "Noise & Defects / Light path" 1200×360: star, label "Light from a star", three rays, telescope tube with end rings, lens, mount, pier, focuser, camera body, filter, sensor chip with Pixel Grid / Amplifier / ADC, arrows, leader lines, bracket, "Layered Camera Sensor" | **FAIL – major** | All shapes and the seven labels are present and placed within 1 px. But the three light rays stop at the lens: the converging segments (x 266 → 740, ending on the pixel grid) are invisible because `src/sections/noise/LightPath.tsx` draws the ray `<g>` first and then paints the tube (`fill="#F7F2EA"`), focuser, camera body and chip on top of them. In Figma the rays cross the tube and end at the sensor. |
| 3 | Problem section, left column: "The problem you can see" (3 paragraphs) then "Why we stack" (2 paragraphs), 32 gap between the two prose blocks | PASS | Verbatim, gap 32, h2 positions within 2 px. |
| 4 | Image column: 440×330 single-exposure crop, caption-title "One five-minute exposure" (14/20 medium, primary), caption (14/20, secondary), 12 px gap, 440×330 master crop with its two captions | PASS | Both `problem_galaxy.png` / `problem_master.png` are 440×330 native and match the Figma renders. |
| 5 | Tour section: h2 "Where each error comes from" (900 wide), intro paragraph (680) | PASS | Verbatim. |
| 6 | Table header "Example / Cause / What you see / What deals with it" (label/sm, text/secondary) at column x 0/144/428/832, 1 px rule (border/default) | PASS | Widths 120/260/380/320 with 24 gaps; rules 1152 wide. |
| 7 | 8 rows, each 104 tall: 120×80 thumbnail, Badge + cause label (label/md), "see" text (body/md, 380), "fix" text (body/md, 320), rule after each row | PASS | Row pitch 105; all text verbatim: Photons and sensor readout / Readout offset / Dark signal and hot pixels / Uneven response / Frames that do not line up / Satellites and aircraft / Clouds / Tracking errors, with the eight "see" and "fix" strings identical to Figma. Fix lines are plain text, not links (design-notes §5 item 12). |
| 8 | Badges: Random noise (grey diamond), Bias (cobalt circle), Dark (red square), Flat (ochre triangle), Outside the camera ×4 (violet pentagon); soft fill + 1 px source-colour border, radius 2, 12 px glyph, label/sm | PASS | Colours and glyphs match; widths 120/63/66/62/151 within 1 px. |
| 9 | Thumbnails carry the same crops as Figma (noise, bias stripes, hot pixels, flat, doubled stars, streak, cloud, dashes) | PASS | Visually identical at 120×80. |
| 10 | Interaction: thumbnail click opens a plain overlay with the full crop; closes on click or Escape (design-notes §3) | PASS, one minor | 8 buttons (`aria-label="Enlarge: …"`); overlay `role=dialog`, dimmed backdrop, image at natural size centred (720×480 for 7 rows); closes on Escape, on backdrop click and on image click. **minor (asset):** the Dark row enlarges to only 360×240 because `assets/noise/tour_dark.png` is generated as a 360×240 patch "shown 1:1" (`tools/assets/noise_page.py`), while design-notes §3 says the full crop is 720×480. Not a Figma difference (the overlay is not drawn there); flag for the asset owner. |
| 11 | Calibration section: h2 "What calibration measures" + 3 paragraphs (680) beside a Note callout (440, surface/panel, 4 px accent left border, eyebrow "NOTE", title "Calibration frames are stacked too", body) | PASS | Verbatim; callout 440 wide at x 848, title at y 2839 vs 2837. |
| 12 | BottomNav "← Welcome" (secondary) / "Bias →" (primary) | see shell | App: "Previous: Welcome" ghost / "Next: Bias" secondary. Shell-owned S2/S3. |
| 13 | Interaction: browser back from `/noise` returns to `/welcome` | PASS | Verified. |
| 14 | Page height 3319 | minor | 3330 (+11, shell). |

## P6 Alignment (`/alignment` ↔ 73:2)

| # | Feature | Verdict | Detail |
|---|---|---|---|
| 1 | Page head: "Chapter 5 · Alignment", "Bringing the same stars together", 6-line lede | PASS | Verbatim, 680×168. |
| 2 | SNR chart illustration 1200×360, two 560-wide panels at x 40 and 640: titles "Random noise present in final image" / "Signal from galaxy in the image" (Jost 22/28 at (80, 8)), 2 px ink axes (x 80–480 at y 256, y 56–256), 400×175 curve, marks at N = 1, 4, 16, 64 with ticks and y guides, x labels 1/4/16/64 (mono 12), y labels 1, 1/2, 1/4, 1/8 and 1×, 2×, 4×, 8×, "Exposures averaged" centred under each | PASS | All labels verbatim and at the Figma positions (nudged 1/4 x-labels reproduced); grey 1/√N and cobalt √N curves with 12 px marks match the Figma vectors. |
| 3 | "Why collect more than one photograph?" prose (2 paragraphs) beside a Why? callout (440, surface/card, 1 px ink border, eyebrow "WHY?" in text/link, title "Where the square root comes from", two-paragraph body with a blank line) | PASS | Verbatim including "N ÷ √N = √N"; blank line preserved via `whitespace-pre-line`; one line wraps a word earlier (font metrics, minor, no height change that moves later content). |
| 4 | "The problem you can see" h2 + paragraph | PASS | Verbatim. |
| 5 | Stack box (1200×300, surface/stage, radius 6, 24 padding) with equation row: 330×220 Frame 5 · "+" · 330×220 Frame 2 · "=" · 330×220 average; operators Jost 28/34 on-stage in 33-wide columns centred on the 220 well; captions "Frame 5", "Frame 2", "Average, not aligned" (14/20 on-stage-muted) | PASS | Box at (120, 1404) vs 1402; assets `frame05`, `frame02`, `naive_average` match Figma (doubled stars visible in the average). |
| 6 | "Use the stars to bring the views together" h2 + paragraph | PASS | Verbatim ("The red circles mark three examples…"). |
| 7 | Align box (1200×360) with the aligned row: Frame 5 and Frame 2-aligned wells each carrying three 24 px red circles (red/600, 2 px stroke) on the same three stars; captions "Frame 5. Alignment stars circled." / "Frame 2, moved to match frame 5." / 4-line "Average after alignment, note the smoother background, this is why we stack. What’s not apparent yet is the increase in signal in the galaxy. Stack more to see this." | PASS | Circles at the Figma positions (crop coordinates scaled 1200×800 → 330×220, centres within 1 px of the Figma 24 px markers); captions verbatim; the aligned average shows single stars. |
| 8 | BottomNav "← Flats, continued" / "Algorithms →" | see shell | App: "Previous: Darks" / "Next: Algorithms" (the Flats pages are not registered yet; label style is shell-owned). |
| 9 | Page height 2448 | minor | 2459 (+11, shell). |

## P8 Light frames (`/light-frames` ↔ 94:46)

| # | Feature | Verdict | Detail |
|---|---|---|---|
| 1 | Page head: "Chapter 7 · Light frames", "Choosing the photographs worth combining", 4-line lede | PASS | Verbatim, 680×112. |
| 2 | No top illustration, no problem slot (design-notes §5 item 26) | PASS | First section starts at y 400 vs Figma 398. |
| 3 | Clouds section: h2 "Look for changes across the whole field", paragraph; dark box (1200×326, 24 padding, square corners) with three 368×246 whole-field wells + captions "Frame 14, cloud copy" / "Frame 15, cloud copy" / "Frame 16, cloud copy"; trailing paragraph "These cloud examples are deliberately altered copies of Frames 14–16…" | PASS | Verbatim; `cloud_f14/15/16.png` match the Figma renders (same STF). |
| 4 | Tracking section: h2 "Distinguish a passing satellite from blurred stars", two paragraphs (em dashes kept); dark box with two 564×376 wells, captions "Frame 11" / "Frame 11, tracking-error copy"; trailing paragraph "This supplied tracking example…" | PASS, one minor | Verbatim; wells and crops match. **minor (wrap):** the trailing paragraph is 3 lines (72 px) in the app and 2 lines (48 px) in Figma at the same 680 width, so everything below shifts down by 24 px (all later landmarks read +26 including the shell's +2). Font-metric wrap, no fix expected. |
| 5 | FWHM section prose: h2 "Measuring the width of a star" + two paragraphs (8.6 / 8.2 px, 179 / 74 stars) | PASS | Verbatim. |
| 6 | FWHM drawing 1200×360: panels "Round star" (x 0) and "Trailed star" (x 620), 580 wide; ochre band (source/flat-soft) 92×240 at x 185 / 174; 33 ink bars 9 wide on an 11 px pitch from x 56 with the Figma heights; 2 px axes (x 52–421 at y 300, y 60–300); dotted "Peak" line and dashed ochre "Half of the peak" line; labels "Peak", "Half of the peak" at x 429, "Width at half the peak" (label/sm centred under the band), "Pixels across the star" (centred), rotated "Brightness" | PASS | Bars are generated from `fwhm_star.json` with the same 1000 DN = 200 px scale and land at the Figma heights (peak 199 px round, 123 px trailed); half-peak lines at y 200 / 238 as in Figma; labels verbatim and positioned. |
| 7 | Star box (648×428) with two 288×288 wells: "Frame 11: the star, 48 pixels across, enlarged 8 times. FWHM 8.1 pixels." and "This is the image with the tracking error. Here you can see a wider star that is measured at a FWHM 11.7 pixels: 17.0 along the trail, 8.1 across it." | PASS, minor wrap | Verbatim; `star_f11.png` / `star_f11_tracking.png` (384×384 → 288) match. Captions wrap one word differently (2 vs 2 lines and 4 vs 4 lines, same heights). |
| 8 | Teaser: h2 "Next: try keeping and excluding an exposure" + paragraph (Previous frame / Next frame, Average vs Median) | PASS | Verbatim. |
| 9 | BottomNav "← Algorithms" (secondary) / "Light frames, continued →" (primary) | see shell | App shows "Previous: Algorithms" only; there is no Next button because the "Review the Exposures" page is not in `src/shell/sections.ts` yet. Shell item S5. |
| 10 | Page height 3480 | minor | 3515 (+11 shell, +24 wrap). |

---

## Shell (foundation-owned) differences, not counted as page defects

- **S1 TopBar.** Figma TopBar (104 px) shows the chapters "Welcome · Noise & Defects · Calibration · Alignment · Algorithms · Light frames · Workbench" in text/link blue with the active one underlined in ink, plus a second row naming the current page ("Welcome", "Noise & Defects", "Alignment", and on P8 "Image Worthiness · Review the Exposures"). The app has no "Workbench" chapter, chapter links are text/secondary, the second row is empty on single-page chapters and shows only "Image Worthiness" on P8, and the bar is 106 px (so every page landmark sits +2 px).
- **S2 BottomNav labels.** Figma: "← Welcome", "← Flats, continued", "← Algorithms" (secondary, 2 px ink border) and "Bias →", "Algorithms →", "Light frames, continued →" (primary). App: "Previous: X" as a ghost button with a chevron icon and "Next: X" as a secondary button (only Welcome's Start is primary). Welcome's Start reads "Start: Noise & Defects" + chevron instead of "Start: Noise & Defects →".
- **S3 BottomNav height and rule.** Figma 88 px with a border/default top rule; app 96 px (`h-24`) with a border/strong rule, so every page is 11 px taller than its frame.
- **S4 No scroll-to-top on navigation.** `src/shell/App.tsx` uses `HashRouter` with no scroll restoration, so pressing Start (or any Next) opens the next page at the previous page's scroll offset (Start → `#/noise` lands at y 1020). SPEC P0 AC "Start goes to `#/noise`" is met in the hash sense but the reader does not see the top of the page. This is the most user-visible item in the list; suggest a `useEffect` on `location.pathname` calling `window.scrollTo(0, 0)`.
- **S5 Missing "Light frames, continued".** The second Light-frames page ("Review the Exposures", Figma page "P8 Light Frames 2") is not registered, so P8 has no Next button and its TopBar page row shows a single entry.
- **S6 Unregistered Flats pages** make P6's Previous read "Darks" rather than "Flats, continued".

---

## Ordered fix list for the implementer

1. **(major, `src/sections/noise/LightPath.tsx`)** Move the light-ray `<g>` (the three `M136…` / `M266…` paths) after the sensor chip and arrows so the rays are painted over the tube, focuser, camera body and filter, ending on the pixel grid as in Figma component 35:2. Keep the star glyph and "Light from a star" label where they are.
2. **(minor, asset, `tools/assets/noise_page.py`)** Decide whether the Dark tour thumbnail's enlarged view should be 720×480 like the other rows (design-notes §3) or stay a 360×240 patch shown 1:1; if 720×480, regenerate `assets/noise/tour_dark.png` and copy it to `src/sections/noise/assets/`, and record the command in the commit.
3. **(minor, wrap, P8)** Optional: nothing to change in code; if the 24 px drift after "This supplied tracking example…" matters, the Figma text box could be re-checked at 680 px with the web font, or the paragraph accepted as 3 lines.
4. **(shell, for the foundation owner, in priority order)** S4 scroll-to-top on route change; S5 register the Light-frames review page so P8 gets "Light frames, continued →"; S2 BottomNav label text and variants ("← X" secondary, "X →" primary); S3 BottomNav 88 px with border/default; S1 TopBar chapter colours, Workbench entry and page row; S6 follows once the Flats pages land.
