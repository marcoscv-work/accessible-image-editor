# Accessible Image Editor

A **fully accessible, non-canvas image editor** built with React and [Clay](https://clayui.com) (Liferay's design system), proposed as the accessible image editing solution for the new CMS (epic LPD-58956): instead of remediating a canvas-based third-party editor (discovery LPD-93990, estimation LPD-102096), it covers the same functional scope while being **accessible by architecture**.

The original feasibility goal lives in [GOAL.md](GOAL.md). The engineering conclusions live in [FINDINGS.md](FINDINGS.md), and the WCAG 2.1 AA status per criterion in [CONFORMANCE.md](CONFORMANCE.md).

## Core idea

The editor is **parametric and declarative**:

- Every operation is serializable data: a crop is `{x, y, width, height}`, brightness is a number, the straighten angle is a number of degrees, a text overlay is an object. The whole session is one JSON-friendly `EditState` managed by a pure reducer with an undo/redo history.
- The preview is **SVG in the DOM**, not canvas: the raster image is an `<image>` element, color adjustments are declarative SVG filter primitives (`feComponentTransfer`, `feColorMatrix`), and every annotation is a real, focusable, labelled DOM node.
- The export serializes **the same SVG** at full resolution and rasterizes it offscreen; a canvas exists only as the final encoder, invisible to the user and absent from the accessibility tree. Preview and export share the same components (`FilterDefs`, `rotationTransform`, `OverlayShape`), so what you see is what you save by construction.
- Focus on the stage (crop area, handles, annotations) is a **Clay-style double ring** (white inner + accent outer) drawn as real SVG geometry, because browsers do not reliably paint CSS outlines on SVG children.
- **Straightening** is a free angle in degrees on top of the quarter turns: the image is scaled by exactly the factor needed to keep covering the frame, so no empty corners appear and the crop and annotation coordinate space is untouched.
- While a crop gesture runs, a **thirds grid** appears as a composition aid; a **recenter control** in the middle of the crop zooms and scrolls until that region fills the view (a view operation, so it never enters the edit history), and hides itself once the view already frames the crop.
- **Redactions** pixelate an area for real: tiny downsampled copies of the image (three block sizes) are prepared once at load time and revealed through a clip, scaled back up with nearest-neighbor, and passed through the same color pipeline as the image so the mosaic matches what is on screen. They behave exactly like a rectangle otherwise, and the mosaic stays locked to the photo even when the block is rotated.
- Selected annotations expose **on-stage resize and rotate handles** (proportional by default, Shift for free rectangle resize or 15-degree rotation snaps). They are a pointer-only affordance: the layer properties panel is the accessible, keyboard-first equivalent for the same operations.
- Sidebar sections are **collapsible Clay panels**, and each one can be switched off through the `sections` prop: the header is a real button with `aria-expanded`/`aria-controls`, and collapsed content leaves the tab order.
- The preview operates on a **downscaled bitmap** (max 2048px on the longest side); the original file is only read again at export time. This is what keeps 20MP images responsive.

## Configurable sections

The editor is meant to be embedded like any Clay component: every editing
block can be turned off, and omitted keys keep their default (all on).

```tsx
<EditorModal
  image={image}
  onClose={close}
  sections={{annotate: false, filters: false}}  // a crop + adjustments tool
/>
```

The hosted build reads the same allowlist from the URL, so a configuration
can be tried without a code change:
[`?sections=crop`](https://marcoscv-work.github.io/accessible-image-editor/?sections=crop),
`?sections=annotate`, `?sections=crop,filters`.

Disabling `crop` also removes the on-stage marquee and the ratio control;
disabling `annotate` removes the layers panel with it.

## Run

```bash
npm install
npm run dev
```

Open http://localhost:5173, then "Edit sample image" (bundled) or open one of your own (JPEG/PNG/WebP).

## Test

```bash
npm test          # vitest: reducer, filter pipeline, jest-axe scans
npm run test:e2e  # Playwright: keyboard-only journeys + axe + 20MP perf budget
npm run lint      # @liferay/eslint-config (react preset)
```

The Playwright journeys are **keyboard-only by design**: no mouse events are synthesized at any point. They cover crop (handles, numeric panel, ratio presets), adjustments, annotations, layers, undo/redo, save, and focus restoration, with axe-core scans on every screen state. A dedicated pointer-parity spec exercises the same annotation operations with mouse drags (WCAG 2.5.x).

`npm run generate:images` rebuilds the 20MP performance asset from the bundled sample (macOS `sips` required); it is kept out of the repository.

## Keyboard map

| Keys | Action |
| --- | --- |
| `Tab` / `Shift+Tab` | Move between all controls, including the crop area, each of its 8 handles, and every annotation |
| `Arrow keys` | Move the focused crop control or annotation by 1 pixel |
| `Shift + Arrow keys` | Move by 10 pixels |
| `+` / `-` | Zoom in/out while the workspace has focus |
| `Ctrl/Cmd + Z` | Undo (announced with the operation name) |
| `Ctrl/Cmd + Shift + Z` | Redo |
| `Delete` | Remove the focused annotation or layer row |
| `Shift + Arrow keys` on a slider | Step adjustments and the straighten angle by 10 |
| `Enter` | Commit a numeric field; on a focused annotation, jump to its property editor; on a layer row, jump to that element on the image |
| `0` | Fit the image to the window while the workspace has focus |
| `Shift + drag` | Keep the crop proportions while resizing a handle |
| `Alt + drag` | Resize the crop from its center |
| `Esc` | Close the editor or the open dialog |

The same map is available in the UI through the "Keyboard shortcuts" button.

## Structure

```
src/
  state/        EditState + pure reducer with labelled undo/redo history
  imaging/      loadImage (decode + downscale), FilterDefs (color pipeline),
                geometry (rotation), overlayShapes, exportImage (SVG → encoder)
  components/   EditorModal (Clay full-screen modal shell), Workspace (SVG stage),
                CropMarquee, CropPanel, AdjustPanel, FilterGallery,
                AnnotatePanel, LayersPanel, BottomBar, Announcer (live region)
  i18n/         t() + English dictionary (Language.properties-shaped keys)
e2e/            Keyboard-only Playwright journeys, axe scans, 20MP perf budget
```

## Credits

The bundled sample image (`src/assets/sample.jpg`) is an [Unsplash](https://unsplash.com) photo, used under the Unsplash License. Photographer credit still to be filled in.

## Out of scope (product-phase concerns)

- **Freehand drawing** — deliberately excluded: it is the one interaction that cannot be made accessible in any technology (the LPD-93990 finding). The accessible annotation route is parametric text, shapes, and stickers.
- Background removal.
- Touch/mobile polish (pointer events work, but no touch-specific UX).
- EXIF orientation/metadata preservation and color management (ICC).
- HEIC input.
- NVDA/JAWS passes (a VoiceOver script is prepared in [VOICEOVER.md](VOICEOVER.md); all are pending human runs).
