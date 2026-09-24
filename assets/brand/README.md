# Brand assets

- `mark.svg`: the site mark ("Registration"), 64-unit square viewBox. Three copies of the NGC 7331 silhouette (an ellipse tilted 22°) offset like unaligned subs; the cobalt copy lands on top with a cream core. Fills are library tokens: red/400, ochre/300, cobalt/600, cream/50.
- `favicon.svg`: the same file; serve it as `<link rel="icon" type="image/svg+xml" href="/favicon.svg">`. Rasterise 32 and 16 px PNGs from it if a fallback is needed. The offsets blur at 16 px, so 24 px or larger is preferred wherever there is a choice.
- Figma: `Logo/Mark` (node 123:2159) and `Logo/Favicon` (123:2164) on the "Library · Icons" page. The TopBar component set uses a 28 px instance in the brand slot.
- Chosen 2026-09-24 from six candidates; the rejected ones (tilted galaxy, stacked subs, two-arm spiral, calibration set, aperture roundel) are in the proposal artifact, not in the repo.
