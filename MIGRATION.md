# Migration Plan: Portal Module

How the accessible image editor becomes a Liferay portal module, following
the patterns the portal already uses. Reference modules studied:
`frontend-js-charts-web` (library + jest + scss + Language.get),
`frontend-js-charts-sample-web` (demo as a `category.sample` portlet), and
`modules/test/playwright` (per-module projects registered in
`playwright.config.ts`).

## 1. Target modules

Two modules under `modules/apps/frontend-js/`, mirroring the charts split:

```
frontend-js-image-editor-web/            The component. No demo, no assets.
    bnd.bnd                              com.liferay.frontend.js.image.editor.web
    build.gradle                         compileOnly kernel/osgi, as charts
    package.json                         @liferay/frontend-js-image-editor-web,
                                         main: js/index.ts, node-scripts build/test
    node-scripts.config.js
    jest-setup.config.ts                 today's src/test/setup.ts, adapted
    .lfrbuild-portal
    src/main/resources/META-INF/resources/
        js/                              the component (see mapping below)
        css/                             scss partials (see CSS below)
    test/                                jest tests, mirroring js/ subpaths

frontend-js-image-editor-sample-web/     The demo, portal-style.
    src/main/java/.../FrontendJSImageEditorSampleWebPortlet.java
                                         MVCPortlet, category.sample
    src/main/resources/META-INF/resources/
        view.jsp + init.jsp
        js/Sample.js                     opens the editor on the bundled photo,
                                         exposes the config playground
        images/sample.jpg                Laguna Verde lives HERE, not in the lib
```

Dependency audit: every runtime dependency is already portal-native
(`@clayui/*` ^3.166.0, `react`/`react-dom` 18.x, matching the versions the
charts module pins). Nothing exotic enters the yarn workspace.

## 2. Source mapping and renames

PREPAID (the `Migration prep:` series, `951edf9..40f4ea7`): the
standalone already uses the module's exact layout, so the mapping is now
1:1 directory copies: `src/<area>/` → `js/<area>/` for `editor`,
`stage`, `panels`, `annotations`, `chrome`, `hooks`, `state`, `imaging`,
`i18n`, plus the root `ImageEditor.tsx`, `index.ts` and
`editorConfig.ts`. The table below documents where everything came from
originally; it no longer describes work.

| Standalone | Portal module (`.../resources/js/`) |
| --- | --- |
| `src/AccessibleImageEditor.tsx` | `js/ImageEditor.tsx` (public root; also the `main` export via `js/index.ts`) |
| `src/components/EditorModal.tsx` | `js/editor/EditorModal.tsx` |
| `src/components/Workspace.tsx`, `CropMarquee.tsx`, `OverlaysEditable.tsx`, `DrawSurface.tsx`, `FocusRing.tsx`, `OverlayTextEditor.tsx` | `js/stage/` |
| `src/components/CropPanel.tsx`, `AdjustPanel.tsx`, `FilterGallery.tsx`, `FramePanel.tsx`, `PresetGallery.tsx`, `Carousel.tsx` | `js/panels/` |
| `src/components/AnnotatePanel.tsx`, `LayersPanel.tsx`, `LayerProperties.tsx`, `EmojiPicker.tsx`, `MenuGrid.tsx`, `TextDialog.tsx` | `js/annotations/` |
| `src/components/BottomBar.tsx`, `EditorSection.tsx`, `EditorSidebar.tsx`, `ShortcutsDialog.tsx`, `Announcer.tsx`, `fields.tsx`, `tooltips.ts`, `instance.tsx` | `js/chrome/` |
| `src/components/hooks/*` | `js/hooks/` |
| `src/state/*` | `js/state/` |
| `src/imaging/*` | `js/imaging/` |
| `src/i18n/*` | `js/i18n/` (see i18n below) |
| `src/emojiData.ts` | `js/annotations/emojiData.ts` (generated, committed) |
| `src/editorConfig.ts` | `js/editorConfig.ts` |
| `src/textFonts.ts` | `js/annotations/textFonts.ts` |

Dies in the migration (stays only in the standalone repo, which remains as
the design-history archive): `src/App.tsx`, `src/main.tsx`, `index.html`,
`vite.config.ts`, `website/`, `scripts/capture-website.mjs`,
`scripts/generate-images.mjs`, Storybook setup, `FINDINGS.md`,
`CONFORMANCE.md`, `VOICEOVER.md`, `GOAL.md` (linked from the module README
instead). `THIRD-PARTY.md` reduces to the Unicode emoji-data notice, which
moves into the module README; the sample photo needs no notice (author's
own, contributed under the repo license).

SPDX headers: files already carry the portal's dual-license SPDX header;
source-format normalizes the year form if needed.

## 3. i18n

Portal-native mechanism, preserving the typed catalogue:

1. All 241 keys from `js/i18n/en.ts` are added to the global
   `portal-language-lang` `Language.properties` (the ~40 that already
   exist there are simply not re-added; the audit that aligned key names
   and values landed on the standalone side in `0409be8`). House rule:
   the hand edit is one commit, the `buildLang` regeneration is a second.
2. `scripts/generate-liferay-messages.mjs` output becomes a committed
   `js/i18n/liferayMessages.ts`: one literal `Liferay.Language.get('key')`
   per key (literal, because the language filter substitutes statically).
3. The module's `t()` stays exactly as it is, with `setMessages(liferayMessages)`
   installed at module init. Dynamic template-family lookups
   (`filter-${preset}`) keep working: the dictionary lookup is runtime,
   only its VALUES were resolved statically. The bundled `en.ts` remains
   the fallback and the source of `TranslationKey`.

## 4. CSS

PREPAID: `src/css/{ImageEditor,Stage,Panels,Annotations}.css` already
exist, imported from their owner components exactly as `BarChart.tsx`
does, and verified pixel-identical against the pre-split UI (capture
md5s). What remains at port time is renaming `.css` → `.scss` and
adjusting the import paths (scss is a css superset).

The Atlas/Clay custom-property fallbacks we already use
(`var(--cadmin-gray-300, ...)`) become plain admin tokens inside the
portal. The `.editor-*` class prefix stays (collision-safe and grep-able).

## 5. Unit tests (vitest → jest)

PREPAID: the suite already lives in the portal's shape and runs green
there: `test/` mirrors the source tree with no `.test` suffix, no
vitest imports (globals), the `import '@testing-library/jest-dom';`
side-effect per file, helpers in `test/__lib__/`, and the setup file is
already named `jest-setup.config.ts`. What remains at port time is the
runner itself: declare the `jest` block in the module's `package.json`
and fix whatever the shared portal config surfaces (expected: little;
the suite is jsdom-tuned and console-guarded).

## 6. Playwright (47 specs)

Target structure, matching the existing convention:

```
modules/test/playwright/tests/frontend-js-image-editor-web/
    main/
        config.ts            {name: 'frontend-js-image-editor-web.main',
                              testDir: 'tests/frontend-js-image-editor-web/main'}
        test.properties
        crop.spec.ts         (m1-crop + view-shortcuts + zoom-anchor)
        adjustments.spec.ts  (m2-adjust)
        annotations.spec.ts  (m3-annotate + m3-pointer + shapes + emoji
                              + image-annotation, split as needed)
        draw.spec.ts
        redaction.spec.ts
        frames.spec.ts       (frame + flip)
        save.spec.ts         (save-contract + export paths)
        responsive.spec.ts
        perf.spec.ts
```

Plus one line each in `playwright.config.ts` (import + project entry).

Adaptation cost, the honest one (and the largest remaining item):
PREPAID half: every spec now opens the editor through one shared
`e2e/helpers.ts` (`openEditor`/`tabUntil`/`announcer`), so the portal
swap rewrites exactly one function: login via the repo's fixtures,
provision a page with the sample portlet through apiHelpers, open the
editor. The specs' selectors are already portal-proof (label-based,
`[id$="-crop-width"]` suffix ids, `.editor-announcer`). Still to do:
that helper rewrite, regrouping specs into the functionality files
above, and turning the `?save=slow` / `?filters=...` knobs into
sample-portlet parameters read by `Sample.js`.

## 7. Commit series

House format: `LPD-XXXXX <Functionality>: <sentence-case summary>` — the
ticket prefix is mandatory in portal; the functionality prefix is the
convention requested for this migration. One ticket (or an epic with
subtasks) to be created before execution. Every commit compiles, is
formatted, and carries its own tests (unit with the functionality; e2e
too, since the sample module lands early).

1. `Editor: add the frontend-js-image-editor-web module skeleton`
   (bnd, gradle, package.json, node-scripts, empty index, .lfrbuild-portal)
2. `Lang: add the image editor language keys` + `buildLang` (separate)
3. `Core: add the parametric edit state, history and patches`
   (state/, imaging geometry + overlayTransform + tests)
4. `Editor: add the modal shell, instance scoping and announcer`
   (chrome/, hooks/, i18n wiring, ImageEditor root)
5. `Sample: add the frontend-js-image-editor-sample-web portlet`
   (unblocks e2e from here on)
6. `Crop: add the marquee, numeric inputs and ratio presets` (+ e2e crop)
7. `Crop: add rotation, flip and straighten`
8. `Adjustments: add the color sliders` (+ e2e)
9. `Filters: add the preset gallery` (+ e2e)
10. `Frames: add the frame gallery and placement` (+ e2e)
11. `Annotate: add text and picture annotations` (+ e2e)
12. `Annotate: add shapes and arrows` (+ e2e)
13. `Annotate: add drawing: freehand, pen and the guided line` (+ e2e)
14. `Redact: add pixelate and blur redactions` (+ e2e)
15. `Annotate: add the emoji picker` (+ e2e)
16. `Layers: add the panel, reordering and properties` (+ e2e)
17. `Editor: add clipboard, multiselection and the undo net` (+ e2e)
18. `Save: add the abortable onSave contract and the export path` (+ e2e)
19. `Editor: add the responsive layout and the performance suite`
20. `Editor: add the keyboard shortcuts dialog and final polish`

Steps 6-18 are extractions from a working codebase, so "adding" a
functionality means moving its files + tests into the module and wiring
it into the panel registry; the split is by review-surface, not by
rewrite risk.

## 8. Gates

- Per commit: `yarn format` (node-scripts), `yarn test` on the module,
  compile.
- Before the PR: `/format-source` over both modules, full jest run,
  the playwright project (`yarn test frontend-js-image-editor-web` from
  `modules/test/playwright`), `pr-check`.
- `ci:test:sf` and the standard PR pipeline decide readiness (house rule:
  no "done" on local checks alone).

## 9. Risks and verification points

1. **node-scripts (webpack) vs vite.** MITIGATED BY DESIGN: the async
   boundary now sits on the data alone (`emojiLoader.loadEmojiCatalog`),
   the picker component is eager and mounts only while its menu is open.
   If the portal build dislikes the in-library dynamic `import()`, the
   loader is the single line to swap for an eager import or a fetch.
2. **`Liferay.Language.get` substitution.** The generated dictionary
   assumes literal replacement works in a node-scripts library build;
   verify on the first deploy (a raw key on screen = it did not).
3. **React 18.2 vs 18.3.** RETIRED: the standalone now pins the
   workspace's exact `react@18.2.0`, and the full suite (the `inert`
   save-freeze spec included) runs green on it.
4. **Spritemap.** RETIRED: the prop is now required with no bundled
   default, and a boundary check wired into `npm run lint` guarantees
   the library imports no assets, shell modules or vite-isms.
5. **jest jsdom differences.** Our suite is jsdom-tuned already, but the
   portal pins its own jsdom; the console guard will surface anything.
6. **Feature flag.** The two new modules ship dark (a sample-category
   portlet is invisible to end users), so no flag is strictly required
   until a DXP surface (Documents & Media, page editor) mounts the
   editor; that integration is a separate ticket with its own flag.

## 10. Out of scope for this migration

- Wiring the editor into any real DXP surface (D&M "Edit image" action,
  item selector, page editor). Separate ticket per surface.
- Replacing the legacy `image-editor` remnants, if any resurface.
- The standalone repo stays alive as upstream design history and the
  public demo; divergence policy after the port: portal is canonical.
