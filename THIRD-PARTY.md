# Third-Party Code

The editor is original code, written for Liferay. Every file under `src/` carries the Liferay copyright and SPDX header. Nothing is vendored: no bundled libraries, no minified files, no copied implementation.

## What the component depends on at runtime

| Package | License |
| --- | --- |
| `react`, `react-dom` 18 | MIT |
| `@clayui/button`, `form`, `icon`, `modal`, `panel`, `slider` 3 | BSD-3-Clause |
| `@clayui/css` 3 | MIT |

Those eight are the only dependencies we chose. The twenty transitive packages in the tree (`classnames`, `aria-hidden`, `dom-align`, `react-transition-group` and the like) arrive with Clay, which is Liferay's own, and all are MIT or BSD.

The component embeds no assets and makes no external calls: no URLs, no `fetch`, no dynamic imports, no CDN. The image arrives as a `File` or `Blob`, and the host supplies the Clay icon sprite through `ClayIconSpriteContext`, as DXP already does.

## What never ships

Test and build tooling (Vite, TypeScript, Playwright, vitest, jest-axe, ESLint) is `devDependencies` only. `axe-core` and `@axe-core/playwright` are MPL-2.0, the single non-permissive license in the tree; both are test-only and absent from the bundle, which is verified rather than assumed.

The standalone shell that opens the editor for a demonstration (`App.tsx`, the sample photograph, the website under `website/`) is scaffolding, not part of the component, and is not intended for the product.

## Values that are not ours to claim

- **The filter colour matrices** are published constants; the sepia one is the canonical matrix browsers implement for `filter: sepia()`. Functional values, not authored expression.
- **The keyboard patterns** follow the [WAI-ARIA APG](https://www.w3.org/WAI/ARIA/apg/), which is W3C documentation. The implementations are written against the pattern descriptions, not copied from its examples.

Everything else in the editor was drawn or derived here, including the sticker artwork, the icons, the focus rings, the tone curves, and the pixelation of redactions.
