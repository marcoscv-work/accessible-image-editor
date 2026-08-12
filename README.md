# Accessible Image Editor

A **fully accessible, non-canvas image editor** built with React and [Clay](https://clayui.com) (Liferay's design system), proposed as the accessible image editing solution for the new CMS (epic LPD-58956): instead of remediating a canvas-based third-party editor (discovery LPD-93990, estimation LPD-102096), it covers the same functional scope while being **accessible by architecture**.

The original feasibility goal lives in [GOAL.md](GOAL.md). The engineering conclusions live in [FINDINGS.md](FINDINGS.md), and the WCAG 2.1 AA status per criterion in [CONFORMANCE.md](CONFORMANCE.md).

## Core idea

The editor is **parametric and declarative**:

- Every operation is serializable data: a crop is `{x, y, width, height}`, brightness is a number, a text overlay is an object. The whole session is one JSON-friendly `EditState` managed by a pure reducer with an undo/redo history.
- The preview is **SVG in the DOM**, not canvas: the raster image is an `<image>` element, color adjustments are declarative SVG filter primitives (`feComponentTransfer`, `feColorMatrix`), and every annotation is a real, focusable, labelled DOM node.
- The export serializes **the same SVG** at full resolution and rasterizes it offscreen; a canvas exists only as the final encoder, invisible to the user and absent from the accessibility tree. Preview and export share the same components (`FilterDefs`, `rotationTransform`, `OverlayShape`), so what you see is what you save by construction.
- Focus on the stage (crop area, handles, annotations) is a **Clay-style double ring** (white inner + accent outer) drawn as real SVG geometry, because browsers do not reliably paint CSS outlines on SVG children.
- While a crop gesture runs, a **thirds grid** appears as a composition aid; a **recenter control** in the middle of the crop fits and centers that region in the view (a view operation, so it never enters the edit history).
- Selected annotations expose **on-stage resize and rotate handles** (proportional by default, Shift for free rectangle resize or 15-degree rotation snaps). They are a pointer-only affordance: the layer properties panel is the accessible, keyboard-first equivalent for the same operations.
- The preview operates on a **downscaled bitmap** (max 2048px on the longest side); the original file is only read again at export time. This is what keeps 20MP images responsive.

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

`npm run generate:images` regenerates the bundled sample and the 20MP performance asset (macOS `sips` required).

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

## Out of scope (product-phase concerns)

- **Freehand drawing** — deliberately excluded: it is the one interaction that cannot be made accessible in any technology (the LPD-93990 finding). The accessible annotation route is parametric text, shapes, and stickers.
- Background removal.
- Touch/mobile polish (pointer events work, but no touch-specific UX).
- EXIF orientation/metadata preservation and color management (ICC).
- HEIC input.
- NVDA/JAWS passes (a VoiceOver script is prepared in [VOICEOVER.md](VOICEOVER.md); all are pending human runs).
