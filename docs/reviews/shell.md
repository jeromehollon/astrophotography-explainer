# Review: shell and shared components on every page

Reviewed 2026-09-24 against the Figma library (file `jtYi1LQf1fVyUAUfAgthP5`): TopBar 17:1087 and its eleven `Current=…` variants, BottomNav 11:28 and the BottomNav instance on every page frame, Toggle 9:117, Chip 9:130, Callout 9:210, ROITile 9:337, Button 9:86. Code under review: `src/shared/ui/layout.tsx`, `src/shared/ui/controls.tsx`, `src/shared/ui/data.tsx`, `src/shared/ui/icons.tsx`, `src/shell/sections.ts`, `src/shell/App.tsx`, `index.html`, `public/favicon.svg`, plus the section-local component copies listed in §3.

Method: the app ran from `main` (commit e177c6c) under Vite at 1440 px; every route was screenshotted full-page and cropped at the top bar and bottom bar; element boxes, computed colours and fonts were read from the DOM with Playwright and compared with `get_metadata` positions and `get_design_context` styles; navigation, scroll, back/forward, tab order, hover and focus were exercised in the browser. Screenshots: `welcome`, `noise`, `calibration-bias`, `calibration-darks`, `calibration-flats`, `calibration-flats-2`, `alignment`, `algorithms`, `light-frames`, `light-frames-review`, `workbench` (full page, `-top`, `-bottom`), `focus-chapter`, `hover-chapter`, `focus-bottomnav`, and per-page component crops; kept in the review session's scratchpad, not committed.

Severity: **blocker** = wrong content or a missing element; **major** = more than 8 px off, wrong colour or type, wrong label, or a specified interaction that does not work; **minor** = 8 px or less, or a font-metric difference.

## Verdict

The rebuilt shell matches the Figma library. TopBar is 104 px on every page with the right brand, chapter row, page row, colours, type and indicators; BottomNav is 88 px with the right rule, button styles and (on nine of eleven pages) the right labels; links navigate, pages open at the top, back/forward work, the tab title and favicon are right. All shell items the earlier page reviews listed (106 px TopBar, missing chapters, empty page row, 96 px ghost-button BottomNav, no scroll-to-top, unregistered pages) are fixed.

Two **majors**, both BottomNav labels: the Light frames page's Next button reads "Review the exposures →" where Figma 94:152 reads "Light frames, continued →", and the Workbench's Previous button reads "← Review the exposures" where Figma 126:4146 reads "← Light frames". No blockers. The rest is minor (2 px chapter-row offset, 4 px taller Primary/Ghost buttons, 1 px shorter chips).

## 1. Shell feature list, verdict per page

Measurements are identical on all eleven routes unless a page is named. "All" = /welcome, /noise, /calibration/bias, /calibration/darks, /calibration/flats, /calibration/flats-2, /alignment, /algorithms, /light-frames, /light-frames/review, /workbench.

### TopBar (17:1087)

| # | Feature | Figma | App | Verdict |
|---|---|---|---|---|
| T1 | Bar 1440 × 104, `surface/page` cream | 104 tall, #F2EBE0 | 104 tall on all 11 routes, rgb(242,235,224) | PASS (all) |
| T2 | Chapter row 64 tall, 120 px gutters, 2 px `border/strong` rule below | 64, px 120, 2 px #1C1A17 | 64, padding 120, border-bottom 2 px rgb(28,26,23) | PASS (all) |
| T3 | Brand: 28 px `Logo/Mark` + "Calibration & Stacking" (Jost Medium 20/22, `text/primary`) over "Astrophotography explained" (Public Sans Regular 12/14, `text/secondary`), 10 px gap, brand frame 236 × 36 at (120, 14) | 236 × 36 | Mark 28 × 28 at (120, 17); wordmark Jost 500 20/22 rgb(28,26,23); subtext Public Sans 400 12/14 rgb(107,101,92); brand 234 × 36 at (120, 13) | PASS (all). minor: wordmark measures 196 wide vs 198 (font metrics), so the brand is 2 px narrower and 1 px higher |
| T4 | Brand is a link to the first page | (tab order: brand first) | `<a href="#/welcome" aria-label="Calibration & Stacking: Astrophotography explained">`; click goes to `#/welcome` | PASS |
| T5 | Chapter tabs Welcome · Noise & Defects · Calibration · Alignment · Algorithms · Light frames · Workbench, label/md (Public Sans Medium 14/20), 28 px apart, starting at x 420 | 7 tabs at x 420, gap 28 | 7 tabs in that order, Public Sans 500 14 px, gap 28, first tab at x 418 | PASS (all). minor: whole row 2 px left of Figma (follows T3) |
| T6 | Non-current chapter tabs are `text/link` cobalt, look clickable, navigate to the chapter's first page | #1F4AA8 | rgb(31,74,168), `cursor: pointer`, underline on hover (`hover-chapter.png`), hrefs `#/welcome`, `#/noise`, `#/calibration/bias`, `#/alignment`, `#/algorithms`, `#/light-frames`, `#/workbench`; clicking "Calibration" from Welcome lands on `#/calibration/bias` | PASS (all) |
| T7 | Current chapter: `text/primary` ink label + 3 px `accent/primary` indicator at y 59 (bottom of row, above the 2 px rule) | ink + 3 px cobalt at y 59 | Current tab rgb(28,26,23), `aria-current="page"`, indicator 3 px rgb(31,74,168) at y 59, width = label width; other indicators transparent. Correct chapter is current on every route (Calibration on the four calibration pages, Light frames on both light-frames pages) | PASS (all) |
| T8 | Page row 40 tall, `surface/panel` fill, 1 px `border/default` rule below, 276 px spacer so pages start at x 424 | 40, #E7DCCB, 1 px #D5C6AE, x 424 | 40 tall at y 64, rgb(231,220,203), border-bottom 1 px rgb(213,198,174), first page label at x 424 | PASS (all) |
| T9 | Page row lists the current chapter's pages; single-page chapters show their one page so the height is constant | Welcome → "Welcome"; Noise → "Noise & Defects"; Calibration → Bias · Darks · Flats · Flats, continued; Alignment → "Alignment"; Algorithms → "Algorithms"; Light frames → Image Worthiness · Review the Exposures; Workbench → "Workbench" | Exactly those labels on each route; row present and 40 tall on all 11 | PASS (all) |
| T10 | Current page: ink label + 3 px cobalt indicator at y 37 within the row (page y 101); other pages cobalt links | label y 11, indicator y 37 | label at page y 75, indicator 3 px rgb(31,74,168) at page y 101; non-current pages rgb(31,74,168) with hrefs, e.g. `#/calibration/flats-2`; clicking "Flats, continued" from Bias lands on `#/calibration/flats-2` | PASS (all) |
| T11 | Tab order: brand, chapters left→right, page tabs, then content, then bottom nav | (component description) | Tab sequence on /calibration/bias: brand, Welcome, Noise & Defects, Calibration, Alignment, Algorithms, Light frames, Workbench, Bias, Darks, Flats, Flats, continued, then the stage toggle, then "← Noise & Defects" | PASS |
| T12 | Focus ring on cream: 3 px `border/strong` outside | design-notes §3 | `outline: 3px solid rgb(28,26,23); outline-offset: 2px` on brand and tab links (`focus-chapter.png`) | PASS |
| T13 | TopBar row height never changes when the page row is empty | 104 on all variants | 104 on all 11 routes | PASS |

### BottomNav (11:28)

| # | Feature | Figma | App | Verdict |
|---|---|---|---|---|
| B1 | Bar 1440 × 88, `surface/page`, 1 px `border/default` top rule, 120 px gutters, previous far left / next far right, nothing between | 88, #D5C6AE top | 88 tall on all 11 routes, rgb(242,235,224), border-top 1 px rgb(213,198,174), padding 120, two flex children | PASS (all) |
| B2 | Previous = Button Secondary: `surface/card` fill, 2 px `border/strong`, radius 6, px 24 / py 12, label/md ink, label "← <title>" | 48 tall (2 px stroke) | rgb(247,242,234), 2 px rgb(28,26,23), 6 px radius, 24/12 padding, Public Sans 500 14/20 rgb(28,26,23), 48 tall, x 120 | PASS (all pages with a Previous) |
| B3 | Next = Button Primary: `accent/primary` fill, no stroke, label/md `text/on-accent`, label "<title> →" | 44 tall | rgb(31,74,168), white label, right edge at x 1320; 48 tall because the shared Button draws a 2 px accent-coloured border on Primary | PASS. minor: 4 px taller than Figma (also true of every Primary and Ghost button on the pages, e.g. Workbench scenario "Default" 48 vs Figma 127:1062 44, Review "← Previous frame" 48 vs 125:939 44) |
| B4 | Hover darkens the fill (Primary → `accent/primary-hover`, Secondary → `surface/panel`) | #173A85 / #E7DCCB | rgb(23,58,133) / rgb(231,220,203) | PASS |
| B5 | Focus: 3 px ink ring outside the button | 9:86 Focus | `outline: 3px solid rgb(28,26,23); outline-offset: 2px` on both buttons (`focus-bottomnav.png`) | PASS |
| B6 | Welcome (57:684): only "Start: Noise & Defects →", Primary, at the right | | Only one button, "Start: Noise & Defects →", Primary, x 1105–1320; goes to `#/noise` | PASS |
| B7 | Noise (61:1240): "← Welcome" / "Bias →" | | "← Welcome" / "Bias →" | PASS |
| B8 | Bias (60:1265): "← Noise & Defects" / "Darks →" | | same | PASS |
| B9 | Darks (78:67): "← Bias" / "Flats →" | | same | PASS |
| B10 | Flats (19:435): "← Darks" / "Flats, continued →" | | same | PASS |
| B11 | Flats, continued (66:67): "← Flats" / "Alignment →" | | same | PASS |
| B12 | Alignment (73:98): "← Flats, continued" / "Algorithms →" | | same | PASS |
| B13 | Algorithms (84:67): "← Alignment" / "Light frames →" | | same | PASS |
| B14 | Light frames (94:152): "← Algorithms" / **"Light frames, continued →"** | | "← Algorithms" / **"Review the exposures →"** | **FAIL, major** (wrong label). Source: `src/shell/sections.ts` gives the review page `title: 'Review the exposures'`, and `BottomNav` in `src/shared/ui/layout.tsx` builds the Next label from `next.title` |
| B15 | Review the Exposures (121:143): "← Light frames" / "Workbench →" | | "← Light frames" / "Workbench →" | PASS |
| B16 | Workbench (126:4146): only **"← Light frames"**, Secondary, at the left; no Next | | Only one button, Secondary, at the left, but it reads **"← Review the exposures"** | **FAIL, major** (wrong label). Same source as B14: `prev.title` |
| B17 | Buttons navigate to the adjacent page | | Previous on Flats, continued → `#/calibration/flats`; Start → `#/noise` | PASS |

Note on B14/B16: Figma is inconsistent with itself (the review page is called "Light frames, continued" as a Next target on 94:152 and "Light frames" as a Previous target on 126:4146, while its own TopBar page tab reads "Review the Exposures"). A single `title` field in `sections.ts` cannot produce both strings; the fix needs either explicit `prevLabel` / `nextLabel` fields or the owner deciding one name. Figma text wins, so both frames' labels are recorded as the target.

### Routing, scroll, browser chrome

| # | Feature | Expected | App | Verdict |
|---|---|---|---|---|
| R1 | One hash route per page, `/` and unknown paths redirect to the first page | design-notes §1 | `HashRouter`; `/` → `#/welcome`; `*` → `#/welcome` | PASS |
| R2 | Every navigation opens the new page at the top | design-notes §1, earlier reviews' shell item S4 | `ScrollToTop` in `src/shell/App.tsx`; after clicking Start from the bottom of Welcome `scrollY` = 0; after chapter, page and Previous clicks `scrollY` = 0 | PASS (all) |
| R3 | Browser back / forward work | design-notes §1 | Back from `#/calibration/flats` returns to `#/calibration/flats-2`; forward returns to `#/calibration/flats`. On back, Chrome restores the previous scroll position (2215) instead of the top; on forward the page opens at the top | PASS. minor/informational: back keeps the browser's own scroll restoration, which is the platform default and not contradicted by the design notes |
| R4 | Browser tab title = the site title (design-notes §7) | "Astrophotography Calibration and Stacking, Explained." | `<title>` in `index.html` and `document.title` on every route: "Astrophotography Calibration and Stacking, Explained." | PASS |
| R5 | Favicon = `Logo/Favicon` geometry (design-notes §6) | `assets/brand/favicon.svg` | `<link rel="icon" href="/favicon.svg">`; `public/favicon.svg` is byte-identical (modulo indentation) to `assets/brand/favicon.svg`; `Logo` in `icons.tsx` draws the same three ellipses with red/400, ochre/300, cobalt/600 and a cream/50 core | PASS |
| R6 | TopBar "Persistent" (17:452 description); Workbench frame names the ROI strip "fixed under the top bar" | | TopBar is `position: static` on every route; the Workbench ROI strip is `sticky top-0`, so when the page scrolls the strip sticks to the viewport top with the TopBar scrolled away | Open question, not scored: "persistent" reads as "on every page" in the library description, and no lesson frame shows a sticky bar. If the owner meant sticky, `TopBar` needs `sticky top-0 z-…` and the Workbench strip `top-[104px]` |

## 2. Shared components on the pages that use them

Figma targets: Toggle 9:117 (44 × 24 track with a 2 px ink stroke inset, 14 px knob at cx 12 / 32, ink knob on cream when off, cream knob on cobalt when on, label/md 12 px to the right, Focus = 3 px ink ring); Chip 9:130 (px 16 / py 8, 1.5 px `border/strong`, radius 999, `surface/card`; Selected = cobalt fill and border, white label; Focus = 3 px ink border; 39 tall); Callout 9:210 (px 24 / py 16, 8 px stack, eyebrow Jost Medium 13/16 +1.5 tracking uppercase, label/md title, body/sm body; Note = `surface/panel` + 4 px cobalt left bar + `text/secondary` eyebrow; Why = `surface/card` + 1 px ink border + cobalt eyebrow; Careful = `source/flat-soft` + 4 px ochre bar); ROITile 9:337 (`surface/stage-raised` box, 1 px `border/on-stage`, head px 12 / py 10 label/md `text/on-stage`, 320 × 240 well on `surface/stage`, optional caption strip body/sm `text/on-stage-muted`, Pending/Processing/Empty overlays); Button 9:86 (see B2–B5).

| Page | Component | Source | Measured | Verdict |
|---|---|---|---|---|
| Bias | Toggle "Bias" | shared `controls.tsx` (`onStage`) | 44 × 24, 2 px rgb(28,26,23) border, cream fill; knob 14 × 14 ink at track-left + 5; after Space: cobalt fill, cream knob at cx 32; label Public Sans 500 14/20 `text/on-stage`, 12 px gap; focus 3 px ochre (`accent/focus-on-stage`) ring, offset 2 | PASS. Note: the ring is ochre on the stage per design-notes §3, whereas the library component's Focus variant (drawn on cream) is ink; `transition-colors` on the track also animates the ring colour for ~150 ms |
| Bias | ROITile ×2 | **local** `src/sections/bias/ui.tsx` | 320 wide, 1 px rgb(42,48,80) border, raised fill; head 40 tall (12/10 padding), Public Sans 500 14 rgb(247,242,234); well 318 × 240; caption strip 12/10, Public Sans 400 14 rgb(213,198,174) | PASS. Looks identical to the shared `ROITile` (same box, head, well and caption metrics); the local copy predates the shared rebuild and has no Pending/Processing/Empty states |
| Bias | "Average pixel brightness" side panel | page-owned | not a Callout | n/a |
| Darks | Toggle "Dark" | shared (`onStage`) | same as Bias | PASS |
| Darks | ROITile ×2 (318 px wells) | **local** `darks/ui.tsx` (byte-identical to `bias/ui.tsx`) | as Bias, wells 318 × 318, caption wraps to 2 lines (60 tall) matching frame 78:55 (420 tall tile) | PASS, identical to shared |
| Darks | Callout Why "Why some grain remains" | **local** `WhyCallout` in `darks/ui.tsx` | 440 wide, 1 px ink border, `surface/card`, 24/16 padding, gap 8, cobalt Jost 13/16 +1.5 eyebrow, 14/500 title, 14/400 body | PASS, identical to shared `Callout kind="why"` |
| Flats | Toggle ×2 ("Flat", "Dark flats") | **local** `flats/ui.tsx` (SVG track) | SVG is the Figma track asset verbatim (rect 1,1,42,22 r 11, 2 px stroke, knob r 7 at cx 12/32); label `text/on-stage` 14/500, 12 px gap; focus 3 px ochre outline offset 0 | PASS, visually identical to shared; the ring hugs the track (offset 0) where the shared one sits 2 px out |
| Flats | ROITile ×6 | **local** `flats/ui.tsx` | 320 × 322/362, same head/well/caption metrics as shared | PASS, identical to shared |
| Flats | Callout Why | **local** `flats/ui.tsx` | 680 wide, metrics as above | PASS, identical to shared |
| Flats, continued | Chip ×4 ("No flat", "10 % flat", "50 % flat", "85 % flat") | **local** via `flats-2/ui.tsx` → `flats/ui.tsx` | px 16 / py 8, radius 999, 1.5 px border (Chrome paints 1 px at DPR 1, so chips are 38 tall vs Figma 39), cream/ink unselected, cobalt/white selected; group gap 8; one tab stop, arrows move selection; focus 3 px ochre | PASS. minor: 1 px shorter than Figma; the local chip is the same as the shared `Chip` except the focus colour (ochre on stage vs the shared ink/ochre switch by `onStage`) |
| Flats, continued | Callout Note | **local** `flats/ui.tsx` | 680 wide, `surface/panel`, 4 px cobalt left bar, `text/secondary` eyebrow | PASS, identical to shared |
| Flats, continued | ROITile ×3 | **local** | as Flats | PASS |
| Algorithms | Chip ×2 (Average, Median) | **local** `algorithms/local.tsx` | same metrics as Flats-2 chips; `onFocus` selects (arrow keys select as they move); no focus ring class of its own, so Chrome's default ring shows instead of the 3 px ink/ochre ring | PASS on visuals. minor: focus ring is the browser default, not the library's 3 px ring |
| Algorithms | ROITile ×2 (576 × 676) | **local** `algorithms/local.tsx` | 1 px rgb(42,48,80), head 40, caption 60 (3 lines), well 574 × 574 | PASS, identical to shared |
| Algorithms | Callout Why (680) | **local** `algorithms/local.tsx` | as Darks | PASS, identical to shared |
| Review the Exposures | Chip ×2 | shared via `workbench/ui.tsx` wrapper | cream variant, focus 3 px ink offset 2 | PASS. minor: 38 tall (border rounding), Figma 39 |
| Review the Exposures | ROITile ×4 (300 × 241 ROI grid) | shared `data.tsx` | 1 px border-on-stage, head 40 label/md on-stage, well `surface/stage` with "Result pending — press Stack" centred at top 110 (Pending state, no API in this review) | PASS |
| Review the Exposures | Button Ghost ×2 ("← Previous frame", "Next frame →") | shared `Button variant="ghost"` | transparent, cobalt label, 24/12 padding, 48 tall | PASS. minor: 48 vs Figma 44 |
| Workbench | Button ×5 scenario (Primary selected, Secondary others) | shared via `Btn` | Primary rgb(31,74,168)/white; Secondary cream + 2 px ink; 48 tall | PASS. minor: Primary 48 vs Figma 44 (127:1062) |
| Workbench | Chip ×5 (method table) | shared via wrapper | as Review | PASS |
| Workbench | ROITile ×4 strip + ×4 grid | shared | as Review; strip tiles 282 × 269 at y 120 match 126:4225 (x 120/426/732/1038, y 16 in the strip) | PASS |
| Workbench | ProgressBar | shared | not exercised (no API in this review) | not scored |
| Noise, Alignment | Callout (Note 440 / Why 440) | **local** `lessons-a-shim/ui.tsx` | Note: `surface/panel`, 4 px cobalt bar, `text/secondary` eyebrow; Why: card + 1 px ink + cobalt eyebrow; 24/16, gap 8 | PASS, identical to shared for Note and Why. minor: the shim's **Careful** kind uses `surface/panel` + `border-red-600`, not Figma's `source/flat-soft` + ochre bar (unused on any page today) |
| Welcome, Light frames | no shared components | shim `PageHead`/`Prose` only | | n/a |

## 3. Section-local copies still in use

Grep of `src/sections/*/ui.tsx`, `local.tsx`, `lessons-a-shim`:

| File | Duplicates of library components | Used by | Identical to shared? |
|---|---|---|---|
| `src/sections/bias/ui.tsx` | ROITile, WhyCallout, Eyebrow | bias | Yes (ROITile lacks state overlays) |
| `src/sections/darks/ui.tsx` | same file as bias (byte-identical) | darks | Yes |
| `src/sections/flats/ui.tsx` | Reading, PageHead, Rule, Stage, StageHead, Experiment, Toggle, Chip, ChipGroup, ROITile, Callout | flats, flats-2 (re-exported by `flats-2/ui.tsx`) | Yes visually; Toggle/Chip focus ring offset 0 vs 2 |
| `src/sections/algorithms/local.tsx` | Chip, ChipGroup, ROITile, Callout | algorithms | Yes visually; Chip has no library focus ring and selects on focus |
| `src/sections/lessons-a-shim/ui.tsx` | Reading, PageHead, Prose, Callout, Badge | welcome, noise, alignment, light-frames | Yes for Note/Why; Careful skin differs |
| `src/sections/workbench/ui.tsx` | thin wrappers over the shared Button, Chip, ROITile, ProgressBar; local `Check` and `DrawnHistogram` | workbench, light-frames-review | Wrappers, not copies |

All of these were written while the shared stubs were wrong (their header comments say so and cite TODO.md). Now that the shared components match, the copies are redundant but not defective; swapping them out is cleanup, not a Figma fix.

## 4. Ordered fix list

1. **major** — `src/shell/sections.ts` (+ `BottomNav` in `src/shared/ui/layout.tsx`): make the Light frames page's Next read "Light frames, continued →" (Figma 94:152) and the Workbench's Previous read "← Light frames" (Figma 126:4146). One `title` cannot yield both; add explicit `prevLabel`/`nextLabel` (or `navTitle` per direction) to the `Section` entry for `/light-frames/review`, or have the owner reconcile the two Figma frames. Owner: foundation (`sections.ts` is the shared list; the review page's line is section-owned).
2. **minor** — `src/shared/ui/controls.tsx` `Button`: Primary and Ghost carry a 2 px border, making every Primary/Ghost button 48 tall where Figma draws 44 (Secondary is correctly 48). Either drop the border on Primary/Ghost or keep it and accept the 4 px. Affects BottomNav Next/Start, Workbench scenario buttons, Review/Workbench frame-nav buttons.
3. **minor** — `src/shared/ui/layout.tsx` `TopBar`: chapters start at x 418, Figma 420, because the wordmark renders 196 px wide (Figma 198). If exact alignment matters, give the brand frame a fixed 236 px width (Figma hugs at 236) so the chapter row lands at 420.
4. **minor** — `src/shared/ui/controls.tsx` `Chip`: `border-[1.5px]` paints 1 px at DPR 1 (38 tall vs 39). Not fixable without a 2 px border or a 39 px min-height; note only.
5. **minor** — `src/sections/algorithms/local.tsx` `Chip`: no `focus-stage`/`focus-cream` class, so the browser default ring shows; swap to the shared `Chip`/`ChipGroup` (`onStage`) now that they match.
6. **minor** — `src/sections/lessons-a-shim/ui.tsx` `Callout` kind `caution`: skin is `surface/panel` + red bar; Figma 9:210 Careful is `source/flat-soft` + 4 px `source/flat`. Unused today; swap to the shared `Callout` when the shim is retired.
7. **cleanup** — retire the local copies in `bias/ui.tsx`, `darks/ui.tsx`, `flats/ui.tsx`, `flats-2/ui.tsx`, `algorithms/local.tsx`, `lessons-a-shim/ui.tsx` in favour of `src/shared/ui` (they are visually identical now); one PR per section owner.
8. **open question** for the owner — whether "Persistent top bar" (17:452) means sticky. If yes: `TopBar` `sticky top-0 z-20` and the Workbench ROI strip `top-[104px]`.
