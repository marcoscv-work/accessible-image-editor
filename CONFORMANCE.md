# WCAG 2.1 AA Conformance Checklist

Status of every WCAG 2.1 Level A and AA success criterion for the implemented scope. Evidence: automated axe-core scans run in every jsdom view-state test and in every Playwright journey, keyboard-only e2e journeys, and code inspection. Manual assistive technology passes are pending (see [VOICEOVER.md](VOICEOVER.md)); criteria whose full verification depends on them are marked accordingly.

Legend: **Pass** — implemented and verified by tests/inspection. **Pass\*** — implemented; final confirmation pending the manual AT pass. **N/A** — no content of this type in the editor.

| Criterion | Level | Status | Notes |
| --- | --- | --- | --- |
| 1.1.1 Non-text Content | A | Pass | Every control has an accessible name; filter thumbnails are `aria-hidden` decorations next to their text label; the workspace region is labelled and described. |
| 1.2.1–1.2.5 Time-based Media | A/AA | N/A | No audio or video. |
| 1.3.1 Info and Relationships | A | Pass | Native headings, labels, fieldset/legend for the filter group, layer rows whose actions carry the layer name, `dl` for shortcuts. |
| 1.3.2 Meaningful Sequence | A | Pass | DOM order matches visual order; verified by the keyboard journeys. |
| 1.3.3 Sensory Characteristics | A | Pass | Instructions are textual; handle names include their position but operation never depends on vision alone (numeric panel is a parallel route). |
| 1.3.4 Orientation | AA | Pass | No orientation lock. |
| 1.3.5 Identify Input Purpose | AA | N/A | No user-personal data fields. |
| 1.4.1 Use of Color | A | Pass | Selection states pair color with `aria-selected`/`checked` semantics; focus adds an outline, not only color. |
| 1.4.2 Audio Control | A | N/A | No audio. |
| 1.4.3 Contrast (Minimum) | AA | Pass | axe color-contrast checks pass on the light chrome and the dark workspace/bottom bar (white on `#14151f`). |
| 1.4.4 Resize Text | AA | Pass | rem-based sizing; layout reflows. |
| 1.4.5 Images of Text | AA | Pass | All text is real text. |
| 1.4.10 Reflow | AA | Pass\* | Sidebar stacks below the workspace under 700px; spot-checked. A dedicated 320px/400% automated viewport test is future work. |
| 1.4.11 Non-text Contrast | AA | Pass | Focus indicators are white on dark (>12:1); crop border `#4b9bff` on the dark workspace >3:1; handles are white with accent stroke. |
| 1.4.12 Text Spacing | AA | Pass | No fixed-height text containers. |
| 1.4.13 Content on Hover or Focus | AA | Pass | No hover-only content; slider tooltips are disabled in favor of a persistent value display. |
| 2.1.1 Keyboard | A | Pass | Proven by design: the Playwright journeys perform every feature keyboard-only (crop, ratio, zoom, adjustments, annotations, layers, undo/redo, save). |
| 2.1.2 No Keyboard Trap | A | Pass | The only trap is the modal's intentional focus trap with Esc; verified by the escape journey. |
| 2.1.4 Character Key Shortcuts | A | Pass | `+`/`-` are active only while the workspace itself has focus (component-scoped, allowed by the criterion). |
| 2.2.1 / 2.2.2 Timing | A | N/A | No time limits, no auto-updating content. |
| 2.3.1 Three Flashes | A | N/A | No flashing content. |
| 2.4.1 Bypass Blocks | A | N/A | Single-view tool without repeated blocks. |
| 2.4.2 Page Titled | A | Pass | Descriptive `<title>`; the dialog is labelled "Editing Image". |
| 2.4.3 Focus Order | A | Pass | Workspace → crop area → handles → panels → bottom bar; verified in journeys. |
| 2.4.4 Link Purpose | A | N/A | No links. |
| 2.4.5 Multiple Ways | AA | N/A | Single-page tool. |
| 2.4.6 Headings and Labels | AA | Pass | Sidebar sections are Clay disclosure buttons carrying `aria-expanded` (their names describe the section); explicit labels everywhere else. See the FINDINGS note on the heading-structure trade-off. |
| 2.4.7 Focus Visible | AA | Pass | Clay-style double focus rings (white inner + accent outer). Stage nodes (crop area, handles, annotations) draw them as real SVG geometry because browsers do not reliably paint CSS outlines on SVG children; the two-tone pair stays evident over any image content. |
| 2.5.1 Pointer Gestures | A | Pass | All pointer interaction is single-pointer dragging with full keyboard equivalents. |
| 2.5.2 Pointer Cancellation | A | Pass | Gestures commit on pointer-up; pointer-down only captures. |
| 2.5.3 Label in Name | A | Pass | Visible text is contained in accessible names. |
| 2.5.4 Motion Actuation | A | N/A | No motion input. |
| 3.1.1 Language of Page | A | Pass | `<html lang="en">`. |
| 3.1.2 Language of Parts | AA | N/A | Single language. |
| 3.2.1 On Focus | A | Pass | Focus never triggers context changes. |
| 3.2.2 On Input | A | Pass | Inputs change content (crop, preview), never context. |
| 3.2.3 / 3.2.4 Consistency | AA | Pass | One consistent layout; identical controls are identified identically. |
| 3.3.1 Error Identification | A | Pass | Load failures render a `role="alert"` message; numeric inputs prevent invalid commits by clamping/reverting. |
| 3.3.2 Labels or Instructions | A | Pass | Labels on all fields; operation instructions via `aria-describedby` and the shortcuts dialog. |
| 3.3.3 Error Suggestion | AA | Pass | The only error state (unreadable file) says what to do (try a different file). |
| 3.3.4 Error Prevention | AA | N/A | No legal/financial/data-deletion transactions. |
| 4.1.1 Parsing | A | Pass | React-generated markup; axe reports no parsing/ARIA violations. |
| 4.1.2 Name, Role, Value | A | Pass\* | APG-patterned custom widgets (composite crop control, listbox, radio group, dialogs); axe-clean. Final AT confirmation pending. |
| 4.1.3 Status Messages | AA | Pass\* | A single polite `role="status"` live region announces every operation result without moving focus; asserted in e2e. AT confirmation pending. |

## Known refinements for the product phase

- Run the manual VoiceOver script ([VOICEOVER.md](VOICEOVER.md)), then NVDA and JAWS passes, and clear the Pass\* entries.
- Add an automated 320px-wide / 400%-zoom Playwright viewport test for 1.4.10.
- The crop widget exposes 9 tab stops (area + 8 handles). Reachable and operable today; a product refinement could make it a single composite stop with roving focus to shorten the tab sequence.
- The compact sliders shrink only the painted track and thumb; the interactive range input stays 24px tall, so the target size is unchanged. Re-check if the visual thumb is ever reduced further.
- Verify SVG filter and focus-ring rendering on Firefox and Safari (Chromium verified; the rings are plain SVG geometry, so no outline-support differences apply).
