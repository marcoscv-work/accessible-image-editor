# Findings

An honest engineering log of this PoC, written to feed the team decision around the Pintura adoption (epic LPD-58956), the remediation estimate (LPD-102096), and the accessible-alternative-path requirement recorded in LPD-93990.

## Verdict

**The hypothesis holds.** For the functional scope of the epic (crop/transform, adjustments, filters, text/shape/sticker annotations, undo/redo, save), an image editor that is 100% WCAG 2.1 AA conformant by architecture is technically feasible, performs within budget on 20MP images, and can be built on Clay so portal integration is packaging rather than rewrite. The one permanent exclusion is freehand drawing, which is inaccessible in any technology — exactly as stated in LPD-93990.

The decisive move is not avoiding `<canvas>`; it is making **every operation parametric** (serializable data manipulated through real DOM controls) and treating the SVG scene as the single source of truth for both preview and export. Accessibility then stops being a remediation backlog and becomes a property of the architecture: the axe scans and keyboard-only journeys were green throughout development, not fixed after the fact.

## Measurements

20MP JPEG (5477x3651), Chromium, M-series MacBook (dev build, not production-optimized):

| Metric | Result | Budget |
| --- | --- | --- |
| Open editor (decode + downscale + modal) | 587–927ms | informative |
| Adjustment slider step (render + paint) | 23–32ms | < 100ms |
| Crop handle nudge (render + paint) | 23–27ms | < 100ms |

The downscaled-preview strategy (max 2048px bitmap in the SVG stage, original file touched only at export) is what makes this flat: interaction cost is independent of source resolution. Numbers come from `e2e/perf.spec.ts` and are asserted, not just observed. Not yet measured: full-resolution 20MP export encode time, and low-end hardware.

## What was easy (architecture dividends)

- **The reducer.** The whole edit session is one pure reducer over serializable state, with labelled history entries. Undo/redo, "announce what was undone", and gesture collapsing (a drag is one undo step) fell out naturally, and it is all unit-testable without a browser.
- **The color pipeline.** Brightness/contrast/saturation are one-line SVG filter primitives. The deliberately hard adjustment (shadows/highlights) became a 17-point per-channel `feComponentTransfer` curve: ~40 lines, declarative, testable by string assertion. The approach did not break where we expected it might.
- **Preview = export fidelity.** `FilterDefs`, `rotationTransform`, and `OverlayShape` are shared components rendered into both the live stage and the export SVG. There is no second implementation to drift.
- **Clay chrome.** Buttons, selects, sliders, forms, and the full-screen modal came from @clayui with their accessibility semantics included; the modal's focus trap, Esc handling, and focus restoration all passed the journeys unmodified.
- **Keyboard-only e2e as a forcing function.** Writing the Playwright journeys without a single synthesized mouse event caught real issues (see below) that a click-based suite would have hidden.

## What was hard (real frictions, all resolved)

1. **History discipline.** Field blurs re-committing unchanged values silently polluted the undo stack (three undos landed on the same state). Fix: reducer-level no-op guards for non-transient commits. Lesson: an undo system needs "did anything change" semantics at the reducer, not in the widgets.
2. **Clay modal transitions.** Interacting or running axe mid-fade hits a half-animated UI (axe reported 373 contrast "violations" against fade-in colors; Escape pressed during the opening animation was swallowed). Fix: explicitly wait for the modal to settle. Any Playwright suite over Clay modals needs this idiom.
3. **Nested Clay dialogs.** The shortcuts and add-text dialogs needed `stopPropagation` on their keydown wrapper (so Esc/Ctrl+Z do not reach the editor shell) and a focus redirect after Clay focuses its own modal container, which defeats `autoFocus`.
4. **Clay custom-radio with tall labels.** The radio ring/dot pseudo-elements assume single-line text labels; 40px thumbnail labels misaligned the checked indicator. Fix: recenter via `top` only — Atlas drives `transform` on the dot for its check animation, so overriding transform breaks it. Cost a debugging round.
5. **SVG-in-image secure mode.** An SVG rasterized through `<img>` cannot load `blob:` subresources; the export must inline the bitmap as a data URL. Known platform behavior, but it is the kind of pitfall a product team should have written down (now it is).
6. **Cross-platform keyboard behavior.** On macOS, ArrowDown on a closed `<select>` opens the native picker instead of changing the value; the journey uses letter typeahead. AT/OS interaction matrices need explicit test strategy, not assumptions.
7. **CSS outlines do not paint on SVG children.** The first focus-indicator attempt (CSS `outline` on the stage nodes) silently rendered nothing in Chromium. The fix: focus rings as real SVG geometry (`FocusRing`, a Clay-style white inner + accent outer pair with zoom-compensated thickness), driven by React focus state. Anything interactive inside the SVG stage must own its focus visuals.
8. **Clay's collapsible panel labels its own region.** `ClayPanel` with `collapsable` renders the body inside a `role="region"` whose `aria-labelledby` points at the region's own id, so its accessible name becomes its entire text content (announced as "region, X position 0 Y position 0 ..."). Not an axe violation, but noisy for screen reader users and worth reporting upstream; it also broke test locators that resolved by accessible name.
9. **Disclosure headers cost heading structure.** Moving the sidebar sections to `ClayPanel` turned their `h2` titles into buttons (Clay does not support the APG `h3 > button` accordion shape), which left an orphan `h3` and an axe `heading-order` violation. The layer-properties subtitle became a labelled group instead. A product-phase improvement would be a Clay enhancement allowing a heading wrapper around the disclosure button.
10. **Hiding a focused control drops focus.** Three controls in this UI legitimately disappear right after being used (the crop recenter once the view frames the crop, a layer reorder button when it reaches the end, "Reset all" when nothing is left to reset). Each needed an explicit focus hand-off: without it focus falls to `body`, and because the undo/redo shortcuts are scoped to the editor, they silently stopped working, which is how the e2e journey caught it.
11. **`scrollIntoView` scrolls every scrollable ancestor.** Revealing the layers panel with `scrollIntoView` also scrolled the modal shell (`.modal-content` ended at `scrollTop: 124`), pushing the header off screen and leaving a blank band under the action bar. Two fixes: scroll the intended container explicitly with `scrollTo` on measured deltas, and make the shell non-scrollable so only the workspace and the sidebar can ever scroll. Worth knowing for any full-screen editor built on a Clay modal.
12. **Clay has no small range input.** `form-control-sm`, `input-group-sm`, `form-group-sm` and `panel-sm` all exist, but the slider ships in a single size (no `clay-range-sm`, and `ClaySlider` has no sizing prop), which is a visible gap in a dense tool panel. Scoped CSS gives a thinner track and a 14px painted dot, with the transparent range input kept at a 24px height: the target is the whole band, not the dot, so density costs nothing in target size. Verified by clicking and dragging at the band edges. Worth requesting a proper `clay-range-sm` upstream.
13. **Stacking order is an interaction contract.** The whole-area crop-move surface initially sat above the annotations and swallowed their pointer events (keyboard worked, dragging did not: a bug an all-keyboard test suite cannot see). Pointer-parity e2e coverage was added alongside the fix.

## Risks and open items at product scale

- **Manual AT passes are pending.** axe + APG patterns + keyboard journeys are strong evidence, not proof; the VoiceOver script ([VOICEOVER.md](VOICEOVER.md)) needs a human run, then NVDA/JAWS. This is the main open risk to the "100%" claim.
- **Convolution-based adjustments** (clarity, sharpness) still need `feConvolveMatrix` validation; curves are proven, convolutions are not yet.
- **Cross-browser**: Chromium is verified; Firefox/Safari need the SVG focus-outline and filter-fidelity checks.
- **Text metrics**: overlay hit boxes estimate text width; product should measure via `getBBox()`.
- Product-phase scope deliberately not attempted: touch UX, EXIF/ICC, HEIC, arbitrary-angle rotation, in-place text editing, sticker/font libraries, i18n/RTL beyond the `t()` seam.

## Effort projection (PoC → product)

The PoC took one intensive build session for the three milestones (shell+crop, adjustments, annotations+layers) with 31 unit tests and 5 e2e journeys. Projection to product quality for the epic's requirement list, assuming this architecture:

| Workstream | Estimate (1 senior FE) |
| --- | --- |
| Portal packaging (OSGi module, Language.properties, Documents & Media wiring, permissions) | 3–4 weeks |
| Crop/transform parity (aspect-locked handle drags, arbitrary rotation, flip) | 2–3 weeks |
| Full adjustment set (temperature, exposure, gamma, clarity/sharpness via convolution) | 2–3 weeks |
| Annotations to product level (in-place text editing, measured hit boxes, sticker/font catalogs) | 3–4 weeks |
| Robustness (EXIF orientation, ICC awareness, HEIC decision, large-file limits, error states) | 2–3 weeks |
| AT matrix + cross-browser hardening (VoiceOver/NVDA/JAWS, FF/Safari), CONFORMANCE upkeep | 2–3 weeks |
| Touch/mobile UX | 2 weeks |
| **Total** | **~16–22 weeks of one senior dev (≈ 2 devs × 2–2.5 months)** |

Compare against LPD-102096's remediation estimate for Pintura, remembering the structural difference: here the accessibility work is *inside* the numbers above (it is the architecture), whereas remediation is a permanent tax on top of a third-party dependency that ships no VPAT and owns its own roadmap.

## Strategic note

Even if Pintura ships, LPD-93990 requires an accessible, non-canvas alternative path for the same tasks. This PoC *is* that path's feasibility proof and cost baseline: the two decisions (adopt Pintura; build the accessible route) can now both be priced with working software instead of speculation.
