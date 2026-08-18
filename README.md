# Accessible Image Editor

A **fully accessible, non-canvas image editor** built with React and [Clay](https://clayui.com) (Liferay's design system): a finished component, proposed as the image editing solution for the new CMS (epic LPD-58956). It covers the functional scope expected of an image editor while being **accessible by architecture** rather than by remediation, which is the accessible route LPD-93990 requires.

**Live:** the [website](https://marcoscv-work.github.io/accessible-image-editor/), which walks through the whole feature set, the [editor itself](https://marcoscv-work.github.io/accessible-image-editor/demo/), and the [Storybook](https://marcoscv-work.github.io/accessible-image-editor/storybook/).

The design brief lives in [GOAL.md](GOAL.md). The engineering conclusions live in [FINDINGS.md](FINDINGS.md), the WCAG 2.2 AA status per criterion in [CONFORMANCE.md](CONFORMANCE.md), and the code provenance in [THIRD-PARTY.md](THIRD-PARTY.md).

## Core idea

The editor is **parametric and declarative**:

- Every operation is serializable data: a crop is `{x, y, width, height}`, brightness is a number, the straighten angle is a number of degrees, a text overlay is an object. The whole session is one JSON-friendly `EditState` managed by a pure reducer with an undo/redo history.
- The preview is **SVG in the DOM**, not canvas: the raster image is an `<image>` element, color adjustments and the 20 filter presets are declarative SVG filter primitives (`feComponentTransfer`, `feColorMatrix`) described as data in one recipe table, and every annotation is a real, focusable, labelled DOM node.
- The export serializes **the same SVG** at full resolution and rasterizes it offscreen; a canvas exists only as the final encoder, invisible to the user and absent from the accessibility tree. Preview and export share the same components (`FilterDefs`, `rotationTransform`, `OverlayShape`), so what you see is what you save by construction.
- Colours are a native `input type="color"` rather than `ClayColorPicker`, and it is the only control here that is not Clay: the picker's saturation and brightness map is pointer-only, with an unnamed handle and no key handling, while the native control is labelled, keyboard operable and opens the operating system's own picker. [FINDINGS.md](FINDINGS.md) has the detail and the upstream fix that would let this switch back.
- Focus on the stage (crop area, handles, annotations) is a **Clay-style double ring** (white inner + accent outer) drawn as real SVG geometry, because browsers do not reliably paint CSS outlines on SVG children.
- **Flipping** mirrors the whole composition horizontally, and it carries the crop and every annotation with it: a redaction that stayed put while the photograph mirrored underneath would uncover exactly what it was hiding. It is one entry in the history, and flipping twice returns to the original.
- **Straightening** is a free angle in degrees on top of the quarter turns: the image is scaled by exactly the factor needed to keep covering the frame, so no empty corners appear and the crop and annotation coordinate space is untouched.
- While a crop gesture runs, a **thirds grid** appears as a composition aid; a **recenter control** in the middle of the crop zooms and scrolls until that region fills the view (a view operation, so it never enters the edit history), and hides itself once the view already frames the crop. It answers to `2`, next to `0` for fitting the whole image and `1` for actual size, and when it takes focus it wears the same ring as every other control on the stage.
- **Redactions obscure an area for real**, either by pixelating or by blurring it. Pixelation reveals a tiny downsampled copy of the image through a clip, scaled back up with nearest-neighbor; blurring draws the picture itself through a Gaussian filter applied *before* the clip, so the block has hard edges instead of fading into what it is meant to hide. Both pass through the same color pipeline as the image, both stay locked to the photo when the block is rotated, and both are destructive in the exported file rather than merely covering something up. One strength control of four steps serves both, so switching type keeps the amount hidden. Pixelation is the default, because a mosaic throws detail away where a blur redistributes it, and a blur is the one of the two that deconvolution can attack.
- **A proportion lock reaches the stage**, for the crop and for every box annotation alike: with it on, only the four corners are offered and no side handles, because stretching one axis is exactly what the lock forbids, and a corner drag keeps the ratio without asking for Shift. A picture arrives locked, a shape arrives free, and choosing another layer starts again from that.
- **A crop field never shows a value that was refused**: a crop as wide as the image cannot also start at x 200, and the field says so at once rather than keeping the number until some later edit appears to reset it.
- **Small annotations keep a full-size target**: whatever an annotation is painted at, the area that can be clicked or reached never falls below 24 by 24 screen pixels, measured in screen space so it holds at any zoom.
- **The drawn shapes live behind one menu**: rectangle, square, circle and arrow, so the panel keeps five buttons however many shapes are added later. The menu narrows with the tool list, so a host that offers two shapes gets a menu of two.
- **Both menus are grids of drawings rather than lists of words**, because a shape is recognised faster than it is read. Each cell is 32 by 32, above the 24-pixel floor, and carries the name as its accessible label and its tooltip, so nothing depends on the tooltip. The arrows move in two dimensions (APG grid pattern), the whole grid is one tab stop, and the popover grows with its contents and scrolls natively rather than paging.
- **Rectangles, squares and circles take an optional border**, off until a width is set, with its own colour.
- **An arrow is the one annotation that is not a box.** It is a tail and a vector, so both ends are placed independently, by dragging either endpoint or by typing where the tip goes; it has no rotation, because two ends already say where it points. The head is solid or open, and the weight drives the shaft and the head together so a heavy arrow still reads as an arrow. Holding the tip as a vector rather than as a second point is what lets every existing operation, moving it, duplicating it, mirroring it with the photograph, carry the arrow without knowing what an arrow is.
- **A picture of your own becomes an annotation**: pick a PNG and it lands as one more layer, named after the file, moved and resized by the same handles and fields, and composited into the export. Its proportions arrive locked, with a padlock beside the width and height that any box annotation can use, because keeping a picture in proportion should not require doing the division yourself, and the same padlock governs what the pointer can do to it. It travels in the edit state as a data URL rather than an object URL, because the export rasterizes its SVG through an `img`, which cannot load `blob:` subresources. Its description is editable, since a file name names a file, not a picture.
- **Drawing splits the gesture from the object, which is the whole accessibility argument.** WCAG 2.1.1 exempts input that depends on the path of the user's movement, so a brush never violated the letter of the standard; what it violates everywhere else is the spirit, because the ink it leaves is dead pixels no assistive technology can find. Here the *stroke* is a first-class layer: a list of points with a colour, a thickness and a line style, named in the layers list, movable by arrow keys, editable after the fact, mirrored with the photograph, exported through the same path as the preview. And the *gesture* is only one of two routes to it: the freehand drag is the pointer convenience, and the keyboard runs a guided line instead: the start lands on the crop's centre, the arrows aim the end (Enter sets it), the arrows then bend the middle (Enter finishes), every stage announced, Backspace stepping back and Escape abandoning. A pointer user still gets the click-by-click pen, so no task is locked behind dragging (WCAG 2.5.7). A freehand capture is simplified (Ramer-Douglas-Peucker) into the same handful of anchors the pen would have placed, and the curve through them (Catmull-Rom) passes exactly through every point, because a pen that lands beside its own points is a pen nobody can predict.
- **The hand-drawn style is a property, not a gesture**: rectangles and circles can dress informal (a seeded wobble, Excalidraw-style) and undress back to crisp, because much of what people want from a brush is the look, not the movement. The seed lives in the state, so the preview, the export and every re-render wobble identically.
- **Emoji are characters, not artwork**: the picker offers a curated page of commons and searches all ~1,900 names from Unicode's own `emoji-test.txt`, and what lands on the stage is the character itself, drawn by the platform's emoji font. Nothing is bundled and nothing recolours, which is also the honest cost: the same edit authored on another operating system renders that platform's set, and the export bakes whichever one the author saw. The layer is named by Unicode's name for it, glyph shown in front. Those names are the one string family that does not come from the editor's dictionary: they are Unicode's English names, generated into `src/emojiData.ts`, and localising them means pointing the generator at CLDR's per-locale annotation files (the same data keyboards use) rather than translating 1,900 keys by hand. Every other user-facing string, announcements included, goes through `t()`.
- **Frames are intent, not geometry**: a kind, a colour, a weight and an offset, the last two as percentages of the crop's shorter side. Nothing is stored in image coordinates, so the next crop reframes the picture instead of stranding a border where the old edges were, and the same numbers hold on a 72-pixel card, on the stage at any zoom, and in a full-resolution export. A checkbox decides whether the frame is drawn over the annotations or under them.
- Selected annotations expose **on-stage resize and rotate handles** (proportional by default, Shift for free rectangle resize or 15-degree rotation snaps). They are a pointer-only affordance: the layer properties panel is the accessible, keyboard-first equivalent for the same operations.
- The **filter gallery** is a two-column card grid whose radios are visually hidden but still real radios, so it keeps the group semantics and arrow-key behaviour; selection is shown with a ring, a bold label and a check badge, never by colour alone. Cards paint from a tiny bitmap prepared at load time, so adding presets costs nothing at render time.
- Once the sidebar stacks under the workspace, the tracks that would otherwise wrap (the filter cards, the frames) become **one swipeable row with snap points and paging arrows**. The arrows are a pointer affordance only, hidden from assistive technology and out of the tab order, because each track is already a keyboard-navigable group and focusing a child scrolls it into view.
- Sidebar sections are **collapsible Clay panels**, and each one can be switched off through the `sections` prop: the header is a real button with `aria-expanded`/`aria-controls`, and collapsed content leaves the tab order.
- The preview operates on a **downscaled bitmap** (max 2048px on the longest side); the original file is only read again at export time. This is what keeps large images responsive: a slider step measures 31ms with a 100MP source, the same as with a small one, because interaction cost is independent of source resolution. What does scale with the source is decoding it once at the start and encoding it once at the end, which every editor pays in every technology, and which the host bounds anyway by capping upload size. [FINDINGS.md](FINDINGS.md) records the numbers, the opportunities left on the table, and why a canvas-based editor would not have been faster here.

## Configuration

The editor is meant to be embedded like any Clay component. Every section
can be switched off, and every section can be narrowed to a subset of its
own tools; anything omitted keeps the full default, so `{}` is the
complete editor.

```tsx
<EditorModal
  image={image}
  onClose={close}
  config={{
    adjustments: {sliders: ['brightness', 'contrast']},
    annotate: {tools: ['text', 'emoji']},
    crop: {ratios: ['original', '1:1'], rotate: false},
    filters: {presets: ['none', 'grayscale', 'sepia']},
  }}
/>
```

| Key | `false` | Object |
| --- | --- | --- |
| `adjustments` | hides the panel | `sliders`: any of brightness, contrast, saturation, shadows, highlights |
| `annotate` | hides the panel and the layers list | `tools`: text, rectangle, square, circle, arrow, draw, redaction, image, emoji |
| `crop` | hides the panel, the on-stage marquee and the ratio control | `ratios`: which presets to offer · `rotate`: the quarter-turn and flip buttons · `straighten`: the angle slider |
| `filters` | hides the gallery | `presets`: any of the 19 looks |
| `frames` | hides the frame gallery | `presets`: any of the 9 frames, plus none |

Lists are always applied in the component's canonical order, and unknown
names are ignored, so a caller cannot reshuffle or break the UI.

The hosted build reads the same configuration from the URL, so any
combination can be tried without a code change:

- [`?filters=none,sepia,noir`](https://marcoscv-work.github.io/accessible-image-editor/demo/?filters=none,sepia,noir)
- [`?adjustments=brightness,contrast`](https://marcoscv-work.github.io/accessible-image-editor/demo/?adjustments=brightness,contrast)
- [`?annotate=redaction`](https://marcoscv-work.github.io/accessible-image-editor/demo/?annotate=redaction)
- [`?crop=straighten`](https://marcoscv-work.github.io/accessible-image-editor/demo/?crop=straighten) (crop without the quarter-turn button)
- `?annotate=` switches a section off entirely.

## Storybook

Every combination is also explorable live, with the configuration exposed
as toolbar controls:

```bash
npm run storybook
```

Published alongside the app at
[`/storybook/`](https://marcoscv-work.github.io/accessible-image-editor/storybook/),
with eleven stories: the complete editor, a crop-only picker, straighten
with fixed ratios, a colour-grading panel, brightness and contrast alone,
a redaction-only workflow, a reduced annotation kit, the frame group on
its own, a print-frame set, a watermark-only kit and a social post
composer.

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
npm run storybook # every configuration, live
```

The Playwright journeys are **keyboard-only by design**: no mouse events are synthesized at any point. They cover crop (handles, numeric panel, ratio presets), adjustments, annotations, layers, undo/redo, save, and focus restoration, with axe-core scans on every screen state. A dedicated pointer-parity spec exercises the same annotation operations with mouse drags (WCAG 2.5.x).

`npm run generate:images` rebuilds the 20MP performance asset from the bundled sample (macOS `sips` required); it is kept out of the repository.

## Keyboard map

| Keys | Action |
| --- | --- |
| `Tab` / `Shift+Tab` | Move between all controls, including the crop area, each of its 8 handles, and every annotation |
| `Arrow keys` | Move the focused crop control or annotation by 1 pixel |
| `Shift + Arrow keys` | Move by 10 pixels |
| `+` / `-` | Zoom in/out while the workspace has focus, anchored to the pointer when it is over the image and to the center of the view otherwise |
| `Ctrl/Cmd + Z` | Undo (announced with the operation name) |
| `Ctrl/Cmd + Shift + Z` | Redo |
| `Delete` | Remove the focused annotation or layer row |
| `Shift + Arrow keys` on a slider | Step adjustments and the straighten angle by 10 |
| `Enter` | Commit a numeric field; on a focused annotation, jump to its property editor; on a layer row, jump to that element on the image |
| `0` | Fit the image to the window while the workspace has focus |
| `1` | Zoom to actual size, 100%, while the workspace has focus |
| `2` | Fit the crop area to the window, the recenter control's shortcut |
| `Shift + drag` | Keep the proportions while resizing the crop or a box annotation (free by default) |
| `Alt + drag` | Resize the crop from its center |
| `Esc` | Close the editor or the open dialog |

The same map is available in the UI through the "Keyboard shortcuts" button.

## Structure

```
src/
  state/        EditState + pure reducer with labelled undo/redo history, ids
  imaging/      loadImage (decode + downscale), FilterDefs (colour pipeline),
                geometry (rotation, arrow steps), overlayShapes,
                frameShapes, exportImage (SVG → encoder)
  components/   EditorModal (Clay full-screen modal shell), EditorSidebar,
                Workspace (SVG stage), CropMarquee, OverlaysEditable,
                OverlayTextEditor, CropPanel, AdjustPanel, FramePanel,
                FilterGallery and PresetGallery (the shared card group),
                AnnotatePanel, TextDialog, LayersPanel, LayerProperties,
                fields (the shared labelled inputs and sliders), BottomBar,
                Carousel, Announcer (live region)
  i18n/         t() + English dictionary (Language.properties-shaped keys)
e2e/            Keyboard-only Playwright journeys, axe scans, 20MP perf budget
```

## Credits

The bundled sample image (`src/assets/sample.jpg`) is an [Unsplash](https://unsplash.com) photo, used under the Unsplash License. Photographer credit still to be filled in.

## Out of scope

- **Freehand ink as pixels** — the classic brush that burns paint into the bitmap stays excluded, and the LPD-93990 finding about it stands: ink with no object model cannot be made accessible in any technology. What this editor ships instead is the refinement of that finding, not its reversal: the drawing *gesture* is WCAG-exempt path-dependent input offered as a pointer convenience, and every stroke it produces is a parametric, named, keyboard-editable layer with a dragless route (the pen) to the same result.
- Background removal.
- EXIF orientation/metadata preservation and color management (ICC).
- HEIC input.
