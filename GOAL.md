Accessible Image Editor PoC (non-canvas, Clay, standalone React)

Context: Liferay adopts Pintura (epic LPD-58956) despite discovery LPD-93990 (canvas-based, pointer-only, no VPAT). LPD-102096 estimates its remediation. This PoC tests the alternative: same functional scope, accessible by architecture. Standalone React app (not coupled to portal) built with Clay (@clayui) + Clay tokens so later integration is packaging, not rewrite.

Principle: parametric editor. Every operation is serializable data (crop {x,y,w,h}, brightness number, text overlay object); the UI manipulating it is real DOM.

Hard constraints:
1. No canvas in the interactive UI; preview is SVG in the DOM. Canvas only offscreen as export encoder.
2. Edit session = ordered JSON operation list; pure reducer + history stack (undo/redo).
3. WCAG 2.1 AA at 100% for shipped scope; an a11y failure blocks the milestone.
4. Clay for all chrome; custom widgets (crop handles, overlays, workspace) follow WAI-ARIA APG and use Clay CSS variables.
5. React/tooling compatible with Clay v3 peer deps (portal-compatible).
6. i18n: all strings through a translation function (dictionary now, Language.properties later).
7. Freehand drawing out of scope (inaccessible in any technology).

Layout (per reference screenshot): full-screen modal "Editing Image": light header (bold title left, close X right); dark workspace, centered image, crop marquee (accent border, 8 handles: 4 corners + 4 edge midpoints); dark bottom bar: left "Ratio:" borderless select (Custom/Original/1:1/4:3/16:9/3:4/9:16) + crop-rotate icon; center zoom minus / "25%" / plus; right Cancel (borderless) + Save (primary).

Architecture: one SVG composes the base <image> + filter chain (feColorMatrix/feComponentTransfer/feConvolveMatrix) + focusable, labelled overlay nodes. Export serializes the same SVG and rasterizes offscreen at full resolution; preview uses a downscaled bitmap (max 2048px). Budget: <100ms interaction latency with a 20MP JPEG; measure and report honestly.

Milestones:
M1 shell + crop: load image (picker + sample); modal focus trap, Esc, focus restore; crop via pointer drag and keyboard per handle (arrows 1px, Shift 10px), numeric X/Y/W/H panel with aspect lock, ratio presets; zoom/pan incl. keyboard; undo/redo (buttons + Ctrl/Cmd+Z, +Shift+Z); Cancel; Save downloads the export.
M2 adjustments: brightness/contrast/saturation as Clay sliders (label, value, keyboard steps, per-slider and global reset) plus one hard one (shadows/highlights or clarity) to stress SVG filters. Do not skip it.
M3 annotations: filter gallery as labelled radio group with previews; text overlay (dialog: content/font/size/color), one shape, one sticker, each a focusable SVG node movable by keyboard and pointer; layers panel as listbox (select, keyboard reorder, delete).
Out of scope (README): freehand, background removal, touch polish, EXIF/color management, HEIC.

A11y (normative): APG-conformant name/role/value everywhere; crop announces its state, every handle keyboard-operable (roving tabindex ok); polite live region announces results ("Crop applied"); workspace focusable with aria-describedby instructions, no keyboard traps; contrast 4.5:1 text, 3:1 UI/focus on the dark theme, visible focus; 400% zoom + 320px reflow; targets min 24x24px; prefers-reduced-motion; keyboard map in README + shortcuts dialog; follow Liferay DXP a11y conventions.

Verification per milestone: reducer unit tests + jest-axe zero violations per view state; one keyboard-only Playwright journey + axe scan; manual VoiceOver pass logged (NVDA/JAWS pending); perf check with a 20MP image.

Deliverables: repo + README (architecture, keyboard map, run/test, out-of-scope); CONFORMANCE.md (WCAG 2.1 AA per-criterion checklist); FINDINGS.md (log feeding LPD-102096: easy/hard/risks + PoC-to-product effort projection).

Agreements: commits in English, title-only, small. Accessibility beats speed; speed beats gold-plating.
