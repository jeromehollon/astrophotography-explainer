# Review: Flats and Flats, continued (P4 / P5) against Figma

Reviewed 2026-09-24 on `main` at 5f5ebd6, built pages `/#/calibration/flats` and
`/#/calibration/flats-2` (Vite dev server, Chromium via Playwright, 1440 px wide,
full-page screenshots). Figma file `jtYi1LQf1fVyUAUfAgthP5`: Flats frames
14:2 (A), 49:835 (B), 49:1060 (C) on page 8:7; Flats-2 frames 66:2 (A),
112:2178 (B), 112:2357 (C), 112:2536 (D) on page 8:8. Text was checked verbatim
against `get_design_context` for the reading column and stage of frame A on
each page and against 1:1 crops of frames B/C/D for the state-dependent
captions. Image wells were compared pixel-wise (Pillow, greyscale mean
difference) after aligning the +2 px offset introduced by the shell TopBar.

Severity: **blocker** = wrong content or missing element; **major** = layout
or size off by more than 8 px, wrong colour or type, or a specified interaction
missing; **minor** = at most 8 px, or wrapping from font metrics.

Sources for intent: SPEC §7 P4/P5, docs/design-notes.md §5 items 1–3 and
14–17, docs/figma-state.json notes "Flats-1 R6/R7/R8", "Flats-2 P5" and the
two "Flats-2 owner prose pass" entries.

## Summary

Both pages reproduce their Figma frames almost exactly. Every element is
present, every line of prose and every caption is verbatim, all image assets
match the Figma image wells (static full-field images within 1 grey level;
Flats-2 ROI tiles within 0.12 grey levels; Flats-1 tiles differ only by a
half-pixel resample because the Figma stage starts at y = 2281.6), the
state-dependent tiles and captions switch exactly as frames B/C/D show, and
the y-positions of every block are within 2 px of Figma (the 2 px comes from
the shell TopBar being 106 px instead of 104). Store writes to
`calibration.flat` and `calibration.darkFlat` work.

No blockers. Two majors, both interaction-level: the chip group has no arrow-key
navigation (the Figma Chip component specifies one tab stop with arrow keys),
and the page's initial UI state (Flat off / No flat) is not written to the
shared store on mount, so the store reports `flat: 50, darkFlat: true` while
the toggles show off until the user clicks. Everything else is minor.

Global page heights: Flats A 3599 vs Figma 3588; B and C 3579 vs 3568;
Flats-2 3126 vs 3115. The 11 px is entirely shell (TopBar +2, BottomNav +9).

## P4 Flats: feature list and verdicts

### Page head (Figma 17:1128)
| Feature | Verdict |
|---|---|
| Eyebrow "Chapter 4 · Calibration", Jost 13/16 medium, tracking 1.5, uppercase, text/link | PASS |
| H1 "Following the light through your telescope", Jost 40/46 semibold, 900 wide | PASS |
| Lede (verbatim, Public Sans 18/28, text/secondary, 680 wide, 4 lines = 112 px) | PASS |

### Optical-path box + real flat (Figma 49:622)
| Feature | Verdict |
|---|---|
| Cream box 800 wide, 24 padding, 6 px radius, border/default, with the Flats illustration at 752 × 225.6 | PASS (svg 752 × 226 at x 145, y 425 vs Figma 145, 423) |
| Illustration content: telescope, focuser, camera, layered sensor chip with Pixel Grid / Amplifier / ADC labels, two stars and rays, "Blocked by the tube: dim corners", "Dust on the filter casts a shadow on the pixels", two ochre highlight bars full height | PASS (visually identical at 2×) |
| Paragraph 1 "A dust mote blocks some light…" 752 wide, body/md | PASS verbatim |
| Paragraph 2 "A flat records the response of the whole system…" | PASS verbatim; wraps one word differently ("The flat needs / to measure") — minor, font metrics |
| Real flat image 376 × 252 at x 944 (Figma 944), object-cover | PASS, pixel match (mean diff 0.44) |
| Caption title "The flat recorded by the camera", label/md, text/primary | PASS |
| Caption body, two paragraphs ("The light began evenly…", "The donuts are dust…"), body/sm, text/secondary, 100 px tall | PASS verbatim |

### "Reading the flat as a correction map" + side panel (Figma 45:820)
| Feature | Verdict |
|---|---|
| H2 (Jost 28/34 semibold) | PASS |
| Paragraph "We scale the flat into a map of relative response…" 680 wide, 5 lines | PASS verbatim |
| Callout kind Why: cream card, 1 px border/strong, 680 wide, eyebrow "Why?" in text/link, title "Why can't the flat be drawn as another layer to peel away?", body verbatim | PASS (146 px tall, same as Figma) |
| Side panel: surface/panel, 24 padding, 6 px radius, at x 848 (Figma 120+728) | PASS (app x 848) |
| Panel eyebrow "One illustrative pixel", equation "600 ÷ 0.75 = 800" in IBM Plex Mono 22/28 medium, explanation "Pixel brightness ÷ relative response = corrected pixel brightness" 392 wide | PASS |
| Gap 48 between prose column and panel | PASS |

### "What changes in the whole image" (Figma 45:826)
| Feature | Verdict |
|---|---|
| H2 + paragraph "Compare the background across these two views…" | PASS verbatim |
| Dark box (surface/stage, 24 padding, 6 px radius) 1200 wide | PASS |
| Before image 564 × 378, caption "Before the flat" in text/on-stage-muted | PASS, pixel match (mean diff 1.0) |
| After image 564 × 378 at x 732, caption "After the flat" | PASS, pixel match (mean diff 1.0) |

### "Why the flat needs its own dark frames" (Figma 45:836)
| Feature | Verdict |
|---|---|
| H2 + two paragraphs (144 px and 96 px tall) | PASS verbatim, identical wrapping |

### Ink rule (Figma 19:82)
| Feature | Verdict |
|---|---|
| 1440 × 6 ink/900 rule between reading and stage | PASS |

### Stage head (Figma 19:84)
| Feature | Verdict |
|---|---|
| Eyebrow "Try it" (text/on-stage-muted), title "Remove the dust mote" (text/on-stage), instructions verbatim, 680 wide | PASS |
| Stage padding 48/120, gap 40 between head and experiments | PASS (eyebrow y 2332 vs 2329.6) |

### Experiment 1 "Correcting the light" (Figma 19:88)
| Feature | Verdict |
|---|---|
| Title Jost 22/28 medium; header row items-center gap 24 | PASS (h3 at x 120, toggle at 333 vs Figma 332) |
| Toggle "Flat": 44 × 24 track, off = cream track / ink knob, on = accent/primary track / cream knob, label label/md text/on-stage 12 px right | PASS (track colours read from screenshots) |
| Toggle semantics: role=switch, aria-checked, Space toggles (native button) | PASS |
| Toggle focus ring 3 px around the track (Figma Toggle description) | minor: ring is drawn around the whole button (track + label) via `focus-visible:outline-3`, not the track alone |
| Help text 360 wide verbatim ("Apply the flat to correct uneven illumination… does not change it.") | PASS |
| Tiles: three ROITiles 320 wide, gap 24; head 12/10 padding, 320 × 240 well, caption wrap 12/10, surface/stage-raised, border/on-stage | PASS (tile heights 322/322/362 match Figma) |
| State A: Raw = roi_raw, caption "Without a flat"; Computed = roi_raw, caption "Without a flat - Flat toggled off"; Removed = roi_removed_flat-as-shot, caption "Difference between the two images. Gray means nothing changed, darker color means removal, lighter color means addition" | PASS (tiles and captions match frame A) |
| State B (Flat on): Computed → roi_computed_flat-as-shot, caption "With a flat - Flat toggled on"; Raw and Removed unchanged | PASS (matches 49:835) |
| State C (Flat on, Dark flats on): experiment 1 unchanged from B | PASS |
| Removed tile populated in every state (R8) | PASS |

### Experiment 2 "Calibrating the flat" (Figma 19:379)
| Feature | Verdict |
|---|---|
| Title, toggle "Dark flats" (Figma toggle at x 203 → 323; app 323), help text verbatim ("Subtract a matching dark flat… stays on for this experiment.") | PASS |
| Raw tile = roi_computed_flat-as-shot, caption "Frame with a flat applied, but without dark calibration applied to the flat" (2 lines, tile 342 tall) | PASS |
| Computed tile: A/B = roi_computed_flat-as-shot "Dark Flats Off"; C = roi_computed_flat-darkflat "Dark Flats On" | PASS (matches 49:1060) |
| Removed tile = roi_exp2_removed in every state; caption A = generic "Difference between the two images…", B and C = "This may appear identical to the earlier example but there are subtle differences" | PASS (verified on frames A, B, C) |
| Note: the caption swap is keyed on the Flat toggle, so the off-Figma state "Flat off, Dark flats on" (reachable in the app) reverts to the generic caption while the Computed tile shows the dark-flat image. Not a Figma state; recorded for the owner. | observation |

### Store writes
| Feature | Verdict |
|---|---|
| Flat toggle writes `calibration.flat` (50 when on, null when off) without touching other fields | PASS (verified through the live store) |
| Dark flats toggle writes `calibration.darkFlat` | PASS |
| Initial store on mount matches the UI (frame A: both off) | **major**: store keeps its default `flat: 50, darkFlat: true` until the first click while the toggles show off; a later page (Workbench) reading the store after a visit with no clicks sees a state the learner never chose. design-notes §3 only says "each change is written"; decide whether mount should also write, or the page should read its initial state from the store. |

### BottomNav labels (page contract)
| Feature | Verdict |
|---|---|
| Previous = Darks, Next = Flats, continued (from the sections list) | PASS (labels; see shell section for styling) |

## P5 Flats, continued: feature list and verdicts

### Page head (Figma 66:5)
| Feature | Verdict |
|---|---|
| Eyebrow, H1 "How bright should a flat be?", lede verbatim with non-breaking spaces in "10 %, 50 % and 85 %" | PASS (3 lines = 84 px, same as Figma) |

### Histogram chart box (Figma 66:10 / 68:211)
| Feature | Verdict |
|---|---|
| Cream box 1200 wide, chart 1152 × 320 at (145, 397) vs Figma (145, 395) | PASS |
| Grey band `source/noise-soft` 287 × 220 at x 825, y 40 | PASS |
| Grid lines at y 117 and 189 (border/default), x-axis 2 px at y 260, ticks at x 40 and 1110, y-axis 2 × 210 at x 40 | PASS |
| Curves: 10 % cobalt spike (50 × 194 at 125.8, 66.4), 50 % ochre hill (180 × 40 at 506.9, 220), 85 % red spike (109 × 113 at 825.2, 146.9) | PASS (chart region mean diff 1.1 grey levels; curve boxes within 1 px) |
| Series labels "10 % flat · 0.11 s", "50 % flat · 2.24 s", "85 % flat · 10 s" centred over each peak, label/md | PASS (x 92/503/832 vs Figma 92/502/832) |
| Axis labels "Black · 0 pixels", "Pixel brightness →", "Brightest value a pixel can report" at y 274; "Number of pixels at each brightness ↑" at y 2; ticks "2 million pixels" / "4 million pixels" at x 46, label/sm | PASS |
| Band label two lines "Pixels are full:" / "extra light spills over", right-aligned to x 1104 | PASS |
| `role="img"` with a descriptive aria-label | PASS (extra, not in Figma) |
| Paragraph 1 "A histogram is a chart…" 1152 wide | PASS verbatim |
| Paragraph 2 "A camera sensor has something called a full well capacity…" | PASS verbatim; wraps differently (app 5 lines vs Figma 4 lines + orphan) — minor, font metrics; box height unchanged (96 px reserved in both) |

### "The problem you can see" (Figma 66:19)
| Feature | Verdict |
|---|---|
| H2 + paragraph "This is the same dust shadow you removed… and it was useless." | PASS verbatim; line breaks differ ("no shadow / in it") — minor |
| Callout kind Note: surface/panel, 4 px accent/primary left border, eyebrow "Note" in text/secondary, title "Why the 85 % histogram looks good, but poorly corrects the dust mote", body verbatim, 680 wide, 204 tall | PASS; body wraps differently — minor |
| ROI image 440 × 330 at x 848 (Figma 848), roi_problem_85 | PASS (mean diff 4.8, noise texture at a fractional offset) |
| Caption title "The dust shadow after the 85 % flat" + caption "An enlarged region of one 300 s exposure… before any flat." | PASS |

### "What changes when we give the flat more light?" (Figma 66:28)
| Feature | Verdict |
|---|---|
| H2 + paragraph verbatim | PASS |
| Dark box with three 368 × 247 flats at x 144 / 536 / 928, captions "10 % flat · 0.11 s exposure", "50 % flat · 2.24 s exposure", "85 % flat · 10 s exposure" | PASS, pixel match (mean diff 0.5–1.1) |

### "So which flat should you take?" (Figma 66:39)
| Feature | Verdict |
|---|---|
| H2 + two paragraphs verbatim (incl. "it’s", "don’t" curly apostrophes and the un-spaced "50%") | PASS, identical wrapping |

### Ink rule, stage head (Figma 66:43 / 66:45)
| Feature | Verdict |
|---|---|
| Rule; eyebrow "Try it"; title "Pick a flat and watch the dust shadow"; instructions verbatim | PASS |

### Experiment "Correcting the light" with chip group (Figma 66:49)
| Feature | Verdict |
|---|---|
| Title; chip row at x 333 (Figma 332), gap 8; help text 360 wide verbatim ("Divide the sky image by the chosen flat. Every flat here was calibrated with its own dark flats first.") | PASS |
| Chip labels "No flat", "10 % flat", "50 % flat", "85 % flat" with NBSP before % | PASS |
| Chip styling: 999 radius, 1.5 px border, 16/8 padding, label/md; selected = accent/primary fill + text/on-accent; unselected = surface/card + border/strong + text/primary | PASS |
| Chip size 80/92/96/96 × 39 | minor: app 80/92/95/95 × 38 (1 px) |
| Chip semantics: role=radiogroup aria-label "Flat level", role=radio + aria-checked, exactly one selected | PASS |
| Arrow keys move between chips, one tab stop for the group (Figma Chip component description) | **major**: ArrowRight from "No flat" leaves focus on "No flat"; each chip is its own tab stop (four tab stops) |
| State A (No flat): Computed = roi_raw "Without a flat - No flat selected"; Removed = roi_removed_none (uniform mid grey, per the second owner prose pass) | PASS (exact pixel match with 66:2) |
| State B (10 %): Computed = roi_computed_10, caption "Divided by the 10 % flat - a trace of the shadow remains"; Removed = roi_removed_10 | PASS (matches 112:2178) |
| State C (50 %): roi_computed_50, "Divided by the 50 % flat - the shadow is gone"; roi_removed_50 | PASS (matches 112:2357) |
| State D (85 %): roi_computed_85, "Divided by the 85 % flat - nothing changes"; roi_removed_85 | PASS (matches 112:2536; app tiles differ from Figma by 0.13 grey levels) |
| Removed tile follows the chips (design-notes §5 item 15) | PASS |
| Removed caption constant "Difference between the two images…" in every state | PASS |
| design-notes §5 item 16: is the 10 % trace visible? | observation: at 1:1 the 10 % Computed tile shows a faint darker patch where the mote was; the 50 % tile shows none. The sentence can stand. |

### Store writes
| Feature | Verdict |
|---|---|
| Chips write `calibration.flat` = null / 10 / 50 / 85 without touching other fields | PASS |
| Initial store matches "No flat" on mount | **major** (same issue as Flats-1): a fresh load leaves the store at the default `flat: 50` while "No flat" is selected |

### BottomNav labels
| Feature | Verdict |
|---|---|
| Previous = Flats, Next = Alignment | PASS |

## Shell (foundation-owned), not counted as page defects

- TopBar is 106 px tall (Figma 104), which shifts every page block down 2 px.
- Figma TopBar has a "Workbench" link in the chapter row; the app's does not.
- Figma sub-step row (Bias · Darks · Flats · Flats, continued) sits on a darker cream band with links in text/link and the current page underlined in ink; the app draws it on the page background with muted text and a plain underline.
- BottomNav: Figma shows a secondary outlined button "← Darks" on the left and a primary cobalt button "Flats, continued →" on the right, 88 px tall bar; the app shows a ghost "Previous: Darks" with a chevron icon and an outlined "Next: Flats, continued" with a chevron, 97 px tall. Same on Flats-2 ("← Flats" / "Alignment →").

## Ordered fix list for the implementer

1. **(major) Chip group keyboard model.** In `src/sections/flats/ui.tsx` (`Chip`, `ChipGroup`; `src/sections/flats-2/ui.tsx` is a byte-identical copy), make the group a single tab stop with roving `tabIndex` (selected chip = 0, others = -1) and handle ArrowLeft/ArrowRight (and Home/End) on the radiogroup to move focus and selection, as the Figma Chip component description specifies. Fix it in both copies or collapse them (see 5).
2. **(major) Initial store state on mount.** `Flats` starts with `flat=false, darkFlat=false` and `Flats2` with `level=null`, but neither writes that to `useAppStore` until a click, so `calibration` stays at the default `{flat: 50, darkFlat: true}` while the UI shows off / No flat. Either write the frame-A state on mount (`set({ calibration: { ...calibration, flat: null } })` and `darkFlat: false` on Flats-1), or initialise local state from the store. Confirm with the owner which direction design-notes §3 intends.
3. **(minor) Toggle focus ring.** Move the `focus-visible` outline from the button to the 44 × 24 track (Figma Toggle: "focus shows a 3 px ink outline around the track"); the label stays inside the click target.
4. **(minor) Chip height 38 vs 39.** The 1.5 px border renders as 1 px in Chromium; add `box-sizing`-aware height (h-[39px]) or accept.
5. **(hygiene) Duplicate UI file.** `src/sections/flats-2/ui.tsx` is identical to `src/sections/flats/ui.tsx`; import one from the other or move both to `src/shared/ui` once the shared primitives converge (TODO.md already tracks the divergence).
6. **(observation, owner call) Off-Figma state on Flats-1.** With Dark flats on and Flat then turned off, experiment 2's Computed tile still shows the dark-flat image while its Removed caption reverts to the generic text. Either disable the Dark flats toggle while Flat is off, or key that caption on `darkFlat` rather than `flat`.
7. **(minor, no action) Line-wrap differences** in four paragraphs (Flats-1 paragraph 2 in the cream box; Flats-2 full-well paragraph, problem paragraph, Note body) come from font metrics; block heights are unchanged and nothing overflows.
