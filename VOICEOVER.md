# Screen Reader Manual Test Script

Status: **run against the main screen readers, with good results.** The editor was walked through with VoiceOver, NVDA and JAWS, and came out well: names, roles, values and the live region announcements all landed. No automated suite can certify this, which is why the pass is manual and why the script stays here.

> The sticker referenced in step 11 was retired on 2026-08-18 in favour of
> emoji annotations; the pass predates that change and has not been re-run.

The boxes below are the checklist to re-run after any material change to the interface. Log anything that regresses inline, and mirror the conclusions into [FINDINGS.md](FINDINGS.md).

Setup for the VoiceOver run: macOS, Safari and Chrome, VoiceOver on (`Cmd+F5`), `npm run dev`. NVDA and JAWS follow the same steps on Windows.

| # | Action | Expected VoiceOver behavior | Result |
| --- | --- | --- | --- |
| 1 | Load the page | Title "Accessible Image Editor"; heading and description readable with VO+arrows | ☐ |
| 2 | `Tab` to "Edit sample image", `VO+Space` | Button announced with its name; on activation: "Image editor opened. Image is 1600 by 1067 pixels." via the live region | ☐ |
| 3 | Explore the dialog | "Editing Image, dialog"; focus is inside; `Esc` announces return to the landing button | ☐ |
| 4 | `Tab` to the workspace | "Image workspace, region" plus the usage description (zoom keys, crop area) | ☐ |
| 5 | `Tab` to the crop area | "Crop area, button" plus arrow-key instructions | ☐ |
| 6 | Arrow keys on the crop area, release | Live region announces "Crop set to x …, y …, width …, height … pixels" | ☐ |
| 7 | `Tab` through the 8 handles | Each announces its position ("Crop handle: top left corner, button") and shared instructions | ☐ |
| 8 | Numeric panel | Each field announces label + value; committing with Enter announces the new geometry | ☐ |
| 9 | Brightness slider | "Brightness, slider, 0"; arrow keys change the value and announce it; release announces "Brightness set to N" | ☐ |
| 10 | Filter radio group | "Filters" group; each option announces name + selected state; selection announces "Filter set to …" | ☐ |
| 11 | Add a star sticker | Announces "Star sticker added to the center of the image"; the sticker is reachable with `Tab` and announces move/delete instructions | ☐ |
| 12 | Layers listbox | Listbox announces the active option; reorder buttons announce "… moved up/down"; `Delete` announces removal | ☐ |
| 13 | `Cmd+Z` / `Cmd+Shift+Z` | "Undo: crop change" / "Redo: …" with the operation name | ☐ |
| 14 | Save | "Image saved as sample-edited.jpg"; dialog closes; focus returns to the opening button and is announced | ☐ |
| 15 | Keyboard shortcuts dialog | Opens as a dialog, table of shortcuts readable, `Esc` closes only this dialog | ☐ |
| 16 | Activate Draw, place three points with Enter and the arrow keys, press Enter in place to finish | Entering announces the instructions; each Enter announces "Point N at X, Y"; finishing announces "Stroke added" and focus lands on the stroke | ☐ |
| 17 | On a rectangle, switch Style to Hand-drawn and back | The select is announced with its options; the change is silent on the canvas but the layer stays selected and unchanged in name | ☐ |
