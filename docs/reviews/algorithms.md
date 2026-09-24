# Review: P7 Algorithms page against Figma

Date: 2026-09-24. Reviewer: automated design review (screenshots + DOM measurement). Figma is the source of truth.

- Figma: file `jtYi1LQf1fVyUAUfAgthP5`, frames "P7 · Algorithms — A · average" (84:2) and "B · median" (114:242), both 1440 × 8054.
- Page: `#/algorithms` at 1440 px, Chromium via Playwright (`e2e/shot.mjs`, `e2e/shot-median.mjs`), full page 1440 × 8064.
- Method: full-frame screenshots of both states compared band by band against the Figma renders; every text node checked verbatim against `get_design_context`; element boxes read from the DOM and compared with `get_metadata` positions; computed colours read from the DOM.

Verdict: **the page matches the frames.** Every element and every string in both frames is present, in the right order, at the right size and colour. Two page-level items need fixing (one interaction, one table geometry); the rest are sub-pixel or font-metric differences. The shell (TopBar, BottomNav) differs from the frames but is foundation-owned and listed separately.

Severity: blocker = wrong content or missing element; major = layout/size off by more than 8 px, wrong colour or type, or a specified interaction that does not work; minor = 8 px or less, or wrapping from font metrics.

## 1. Feature list with verdicts

The vertical offset between page and Figma is a uniform +2 px from the TopBar (106 px tall on the page, 104 in Figma); positions below are quoted with that offset already removed unless stated.

### Page head (Figma 84:4 / 84:5)

| # | Feature | Figma | Page | Verdict |
|---|---|---|---|---|
| 1 | Eyebrow "Chapter 6 · Algorithms", Jost 13/16 medium, 1.5 px tracking, uppercase, `text/link` cobalt | 194 × 16 at (120, 168) | 198 × 16, rgb(31,74,168), same font | PASS (minor: +4 px width, font metrics) |
| 2 | H1 "Keeping a useful exposure when a satellite passes", Jost 40/46 semibold, −0.5 px, 900 wide | 900 × 46 | 900 × 46, Jost 600 40 px, −0.5 px | PASS |
| 3 | Lede, Public Sans 18/28, `text/secondary`, 680 wide, verbatim | 680 × 112 (4 lines) | 680 × 112, verbatim | PASS |
| 4 | 6 px ink rule across the page | y 430, 1440 × 6 | 1440 × 6 at y 432 | PASS |

### Try-it stage (84:44)

| # | Feature | Figma | Page | Verdict |
|---|---|---|---|---|
| 5 | Dark stage `surface/stage` #0f1220, 120 px side padding, 48 px vertical, 40 px gap between head, experiment and callout | 1440 × 1487 | 1440 × 1486, rgb(15,18,32) | PASS (minor: −1 px, see #9) |
| 6 | Stage head: eyebrow "Try it" (muted), title "Stack four frames two ways" Jost 28/34, instructions 680 wide verbatim | title 900 × 34 | 900 × 34, text verbatim | PASS |
| 7 | Experiment header: H3 "Combining the frames" Jost 22/28 medium, 24 px gap to chip group | title 215 × 28; chips at x 239 | 216 × 28; chips at x 240 (page x 360) | PASS |
| 8 | Two-Chip single-choice group "Average" / "Median", 8 px apart, 999 px radius, 16/8 padding, 1.5 px border; selected = cobalt fill, white label; unselected = cream `surface/card` fill, ink border, ink label | 89 × 39 and 84 × 39 | 89 × 38 and 83 × 38; selected rgb(31,74,168)/white, unselected rgb(247,242,234)/ink; border renders 1 px | PASS (minor: Chromium rounds the 1.5 px border to 1 px at DPR 1, so chips are 1 px shorter and the whole stage 1 px shorter) |
| 9 | Chip keyboard behaviour per the library description: "Arrow keys move between chips; the group has one tab stop" | Component doc on Chip 9:130 | `role=radiogroup` with two `role=radio` buttons, aria-checked correct, but both chips are tab stops (`tabIndex 0`) and ArrowLeft/ArrowRight do nothing | **FAIL, major** |
| 10 | Chip A state: Average selected on load, regardless of the store (store default is `median`) | Frame A | Page opens on Average with the store at `median` | PASS |
| 11 | Chip B state: clicking Median selects it, deselects Average | Frame B | aria-checked flips to [false, true]; matches frame B | PASS |
| 12 | Two ROITiles 576 × 676, 48 px apart, `surface/stage-raised` #181c2e fill, `border/on-stage` #2a3050 1 px border, header bar (12/10 padding, label/md on-stage), image well, caption strip (body/sm muted) | tiles at x 0 and 624, 576 × 676 | 576 × 676 at page x 120 and 744; rgb(24,28,46) fill, rgb(42,48,80) border; image well 574 × 574 | PASS |
| 13 | Raw tile: title "Raw", image = Frame 3 ROI, caption "Frame 3 on its own, calibrated and aligned. The satellite trail runs from the upper right to the lower left." | | `roi_f03.png`, caption verbatim, 2 lines | PASS |
| 14 | Computed tile, state A: title "Computed", image = four-frame average, caption "Average of the four frames. The trail is still there at a quarter of its brightness, because the average counts every value." | | `stack4_average.png`, caption verbatim | PASS |
| 15 | Computed tile, state B: image = four-frame median, caption "Median of the four frames. At most pixels the trail value is the largest of the four, so the median leaves it out and the trail almost disappears." | | `stack4_median.png`, caption verbatim; the trail is visible in A and gone (faint remnant) in B, satisfying the SPEC P7 acceptance criterion | PASS |
| 16 | "The four frames in the stack" label (label/md muted) 16 px under the tiles, then four 132 × 132 thumbnails 16 px apart with labels "Frame 3", "Frame 2", "Frame 4", "Frame 5" (in that order) 8 px below | thumbs at x 0/148/296/444 | thumbs at page x 120/268/416/564, 132 × 132, labels in that order | PASS |
| 17 | Why callout inside the stage, 680 wide, cream `surface/card`, 1 px ink border, 24/16 padding, eyebrow "Why?" in cobalt, title "Why does a faint trace of the trail survive the median?", body verbatim (28, 12, 86 %) | 680 × 226 at (120, 1213) | 680 × 226 at (120, 1650 = 438 + 1212); rgb(247,242,234) fill, ink border; text verbatim | PASS |

### Reading column (87:72), 64 px top padding, 48 px between sections

| # | Feature | Figma | Page | Verdict |
|---|---|---|---|---|
| 18 | H2 "What happens at one pixel" (Jost 28/34, 680) and intro paragraph verbatim | | verbatim | PASS |
| 19 | One-pixel box 1200 wide, `surface/card` fill, 1 px `border/default`, 24 px padding, eyebrow "Brightness of one pixel in each frame" | 1200 × 360 | 1200 × 360 | PASS |
| 20 | Four value cards 264 wide, 24 px apart, 20/16 padding: Frame 3 = 985 "satellite trail" on `source/external-soft` #dccdef; Frames 2, 4, 5 = 908, 903, 909 "plain sky" on `surface/panel` #e7dccb; value in IBM Plex Mono 22/28 medium | 264 × 116 | 264 × 116, rgb(220,205,239) and rgb(231,220,203), Plex Mono loaded | PASS |
| 21 | Two result cards 564 wide, 1 px border: "Average" / "(985 + 908 + 903 + 909) ÷ 4 = 926.25" / explanation; "Median" / "sorted: 903, 908, 909, 985. Median: 908.5" / explanation | 564 × 130 and 564 × 110 | 564 × 130 and 564 × 110, text verbatim | PASS |
| 22 | H2 "Five ways to combine a stack" and intro verbatim | | verbatim | PASS |
| 23 | Methods table 1200 wide: header row (label/md, `text/secondary`, 2 px ink bottom rule), five rows (Average, Median, Kappa-sigma clipping, Winsorized sigma clipping, Robust Chauvenet rejection) with 1 px `border/default` rules, 12 px vertical padding, all cell text verbatim, row heights 46/65/105/85/105/105 | total 511 tall | 511 tall; rows 45/66/105/85/105/105; all twenty cells verbatim | PASS |
| 24 | Table column geometry: columns 200 / 180 / 372 / 376 wide with 24 px gaps, so text starts at x 0 / 224 / 428 / 824 | | `<table>` auto layout redistributes the widths to 189 / 167 / 372 / 400 (cells 213 / 191 / 396 / 400 including the 24 px right padding); text starts at 0 / 213 / 404 / 800, i.e. −11, −24 and −24 px | **FAIL, major** (row heights happen to match because the wrapping columns are still 372 wide) |
| 25 | Kappa-sigma section: H2 and one paragraph verbatim | | verbatim | PASS |
| 26 | Worked-example box (×3): 1200 wide, `surface/card`, 1 px `border/default`, 24 px padding, 20 px gaps; eyebrow "The same trail pixel across fifteen frames" | 1200 × 484 / 512 / 544 | 1200 × 484 / 512 / 544 | PASS |
| 27 | Fifteen value cards 69.3 wide, 8 px apart, 8/10 padding, label/sm "Frame 0" … "Frame 14" in `text/secondary`, mono/md values 903 913 908 985 903 909 901 918 904 916 905 905 915 920 907 | cards 60 tall, median card 64 | 69 × 60, median card 69 × 64; values verbatim | PASS |
| 28 | Card shading: Frame 2 (median, 908) = `cream/300` #d5c6ae with 2 px ink outline; Frame 3 (rejected, 985) = `source/dark-soft` #f3cdc5; the other thirteen = `surface/panel` #e7dccb (Figma's render shows them grey; the token is cream and the page is right) | | rgb(213,198,174) + 2 px rgb(28,26,23); rgb(243,205,197); rgb(231,220,203) | PASS |
| 29 | Legend row: 16 px swatch (cream/300 with 2 px ink) "Median", 24 px gap, 16 px swatch (dark-soft with 1 px default border) "Rejected", label/md `text/secondary` | 180 × 20 | 181 × 20 | PASS |
| 30 | Numbered steps: "1." … in label/md secondary, 24 px wide, 16 px gap, text in IBM Plex Mono 14/20, 1112 wide; kappa-sigma four steps, winsorized five, RCR four; all step text verbatim including the double space in step 2 of kappa-sigma | kappa steps 124 tall (20/20/20/40) | 124 tall (20/20/20/40); all thirteen steps verbatim | PASS |
| 31 | Result card 1152 wide, 1 px border, 20/16 padding: "Result: 909.1", the 14-term equation, explanation (three different explanations, verbatim) | 1152 × 130 | 1152 × 130 | PASS |
| 32 | Winsorized section: H2 and two paragraphs verbatim (8 %, 33 %) | | verbatim | PASS |
| 33 | RCR section: H2 and two paragraphs verbatim (0.1, 48 %, 46 %) | | verbatim | PASS |
| 34 | H2 "The same region from fifteen frames" and intro verbatim | | verbatim | PASS |
| 35 | Fifteen-frame box 1200 wide, `surface/stage` fill, 24 px padding; six tiles 564 × 564 in three rows of two, 24 px gaps, 12 px to caption (body/sm on-stage): "Frame 0003 on its own", "Average", "Median", "Kappa-sigma clipping", "Winsorized sigma clipping", "Robust Chauvenet rejection" | 1200 × 1884; tiles at (24, 24), (612, 24), rows every 620 | 1200 × 1884; tiles at page (144, 6043), (732, 6043), rows every 620; captions verbatim and in order; images are the `stack15_*` assets | PASS |

### Store write (SPEC / contracts)

| # | Feature | Verdict |
|---|---|---|
| 36 | Choosing a chip writes `algorithm.name` to the shared store and leaves `params`, `calibration`, `frames`, `reference` untouched | PASS: `recordMethod` in `src/sections/algorithms/methods.ts`; `methods.test.ts` passes (`npx vitest run src/sections/algorithms`) |

### Fonts and tokens

| # | Feature | Verdict |
|---|---|---|
| 37 | Jost 500/600, Public Sans 400/500, IBM Plex Mono 400/500 loaded and used where Figma uses them | PASS (all six faces report `loaded`) |

## 2. Shell (foundation-owned), not page defects

These come from `src/shared/ui/layout.tsx` and `src/shell/sections.ts`, not from the Algorithms section.

- TopBar is 106 px tall (Figma 104), so everything below sits 2 px lower than the frame.
- TopBar chapter row shows only "Calibration" and "Algorithms" (the registered chapters); Figma shows Welcome, Noise & Defects, Calibration, Alignment, Algorithms, Light frames, Workbench. The second row (page tabs) is empty on this page; Figma shows "Algorithms" underlined.
- BottomNav: Figma shows a Secondary button "← Alignment" at the left and a Primary button "Light frames →" at the right, 88 px tall bar with a 1 px `border/default` top rule. The page shows a Ghost button "‹ Previous: Darks" at the left (Alignment is not registered yet), no next button (Light frames is not registered yet), a 96 px bar and a `border/strong` top rule.

## 3. Ordered fix list for the implementer

1. **Chip group keyboard model (major, #9).** Make the `ChipGroup` in `src/sections/algorithms/local.tsx` a roving-tabindex radio group: only the selected chip has `tabIndex 0`, the other `-1`; ArrowLeft/ArrowUp and ArrowRight/ArrowDown move selection (and focus) between "Average" and "Median" and call `choose(...)`. Home/End optional. This is the behaviour the library Chip (9:130) specifies and applies to every chip group, so it belongs in the shared component once the shared Chip matches Figma (see `TODO.md`).
2. **Methods table column widths (major, #24).** Give the `<table>` `table-layout: fixed` (or replace it with the same flex rows Figma uses: four `<p>`s 200 / 180 / 372 / 376 wide with `gap 24`, `py 12`, and the header's 2 px ink rule). Target text x positions 0 / 224 / 428 / 824 relative to the 1200 px table; currently 0 / 213 / 404 / 800.
3. **Chip height 38 vs 39 (minor, #8).** Optional: Chromium rounds a 1.5 px border down at DPR 1. If pixel parity matters, use a 1 px border plus 0.5 px extra vertical padding, or accept the 1 px difference (it also accounts for the stage being 1486 instead of 1487 tall).

Everything else on the page, in both states, matches the frames.

## 4. How to reproduce

```
npx vite --port 5190
node e2e/shot.mjs "http://localhost:5190/#/algorithms" algo_a.png
node e2e/shot-median.mjs "http://localhost:5190/#/algorithms" algo_b.png
npx vitest run src/sections/algorithms
```

Figma renders: `get_screenshot` on 84:2 and 114:242 with `maxDimension 8200`; text and tokens from `get_design_context` on 84:4, 84:44, 114:255, 87:73, 87:2253, 87:2287, 87:2291, 87:2295, 87:2493, 84:67; positions from `get_metadata` on 84:2 and 114:242.
