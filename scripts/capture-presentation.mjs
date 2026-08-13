/**
 * SPDX-FileCopyrightText: (c) 2026 Liferay, Inc. https://liferay.com
 * SPDX-License-Identifier: LGPL-2.1-or-later OR LicenseRef-Liferay-DXP-EULA-2.0.0-2023-06
 */

/**
 * Regenerates the screenshots the presentation page uses, straight from the
 * running editor: every image there is the real UI, never a mockup.
 *
 *     npm run dev              # in another shell
 *     node scripts/capture-presentation.mjs
 *
 * Set EDITOR_URL to point somewhere other than the default dev server.
 */

import {chromium} from '@playwright/test';
import {mkdirSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

const SHOTS = path.join(ROOT, 'presentation/screenshots');

const URL = process.env.EDITOR_URL ?? 'http://localhost:5273';

mkdirSync(SHOTS, {recursive: true});

const browser = await chromium.launch();

/**
 * Opens the editor on the sample image and waits for the modal to settle:
 * a screenshot taken mid-fade catches half-animated colours.
 */
async function openEditor({height = 900, width = 1280} = {}) {
	const page = await browser.newPage({
		deviceScaleFactor: 2,
		viewport: {height, width},
	});

	await page.goto(URL);
	await page.getByRole('button', {name: 'Edit sample image'}).click();
	await page.locator('.modal').waitFor();
	await page.waitForTimeout(1400);

	return page;
}

/**
 * The bounding box of an element, padded, in CSS pixels.
 */
async function region(page, selector, padding = 0) {
	const box = await page.locator(selector).first().boundingBox();

	return {
		height: box.height + padding * 2,
		width: box.width + padding * 2,
		x: box.x - padding,
		y: box.y - padding,
	};
}

/**
 * The padded box of whatever holds focus, so a focus indicator can be
 * captured without guessing which overlay it belongs to.
 */
async function focusedRegion(page, padding = 0) {
	const box = await page.evaluate(() => {
		const rect = document.activeElement.getBoundingClientRect();

		return {height: rect.height, width: rect.width, x: rect.x, y: rect.y};
	});

	return {
		height: box.height + padding * 2,
		width: box.width + padding * 2,
		x: box.x - padding,
		y: box.y - padding,
	};
}

/**
 * A sidebar panel, taken with room around it. The panel's own box is flush
 * with its content, which crops the text at the edges, so the clip spans the
 * whole sidebar horizontally (its padding becomes the margin) and is padded
 * vertically, then clamped to the sidebar: panels can be taller than it, and
 * their box then runs under the action bar and past the bottom of the modal.
 */
async function panelRegion(page, selector, padding = 16) {
	const panel = await region(page, selector);
	const sidebar = await region(page, '.editor-sidebar');

	// Where the next panel begins, so the padding below never turns into a
	// sliver of somebody else's title.

	const nextTop = await page.evaluate(
		(selector) =>
			document.querySelector(selector).nextElementSibling
				?.getBoundingClientRect().top ?? Infinity,
		selector
	);

	const top = Math.max(panel.y - padding, sidebar.y);
	const bottom = Math.min(
		panel.y + panel.height + padding,
		sidebar.y + sidebar.height,
		nextTop
	);

	return {
		height: Math.max(0, bottom - top),
		width: sidebar.width,
		x: sidebar.x,
		y: top,
	};
}

/**
 * Scrolls the sidebar so a panel has room under it: without this the last
 * panel sits flush against the sidebar's bottom edge, and the padding the
 * clip asks for is exactly what gets clamped away.
 */
async function revealPanel(page, selector, padding = 16) {
	await page.locator(selector).scrollIntoViewIfNeeded();

	await page.evaluate(
		({padding, selector}) => {
			const sidebar = document.querySelector('.editor-sidebar');
			const panel = document.querySelector(selector);

			const overflow =
				panel.getBoundingClientRect().bottom +
				padding -
				sidebar.getBoundingClientRect().bottom;

			if (overflow > 0) {
				sidebar.scrollTop += overflow;
			}
		},
		{padding, selector}
	);

	await page.waitForTimeout(400);
}

async function shot(page, name, options = {}) {
	const jpeg = name.endsWith('.jpg');

	// The pointer rests wherever the last click left it, which paints a
	// hover state into the capture. Park it in the corner first.

	await page.mouse.move(0, 0);
	await page.waitForTimeout(150);

	await page.screenshot({
		path: path.join(SHOTS, name),
		...(jpeg ? {quality: 82, type: 'jpeg'} : {}),
		...options,
	});

	console.log('captured', name);
}

async function collapse(page, ...titles) {
	for (const name of titles) {
		await page.getByRole('button', {exact: true, name}).click();
	}

	await page.waitForTimeout(400);
}

// 1. The whole editor, as it opens.

{
	const page = await openEditor();

	await shot(page, 'editor.jpg', {clip: await region(page, '.modal-content')});

	// 2. Crop and rotation: ratios, numeric box, straighten.

	await shot(page, 'crop.png', {
		clip: await panelRegion(page, '.editor-panel:has(#crop-panel-title)'),
	});

	// 3. Adjustments: the five sliders and Reset all.

	await collapse(page, 'Crop and rotation');

	await shot(page, 'adjust.png', {
		clip: await panelRegion(page, '.editor-panel:has(#adjust-panel-title)'),
	});

	await page.close();
}

// 4. The filter gallery, with a preset applied. Clipped to the first rows:
// the panel itself is ten rows tall.

{
	const page = await openEditor();

	await collapse(page, 'Crop and rotation', 'Adjustments');

	// The same stage before and after a preset, for the before/after pair.

	await shot(page, 'stage.jpg', {
		clip: await region(page, '.editor-workspace'),
	});

	await page.getByText('Vintage', {exact: true}).click();
	await page.waitForTimeout(600);

	const panel = await panelRegion(
		page,
		'.editor-panel:has(#filters-panel-title)'
	);

	await shot(page, 'filters.png', {
		clip: {...panel, height: Math.min(panel.height, 420)},
	});

	await shot(page, 'stage-filtered.jpg', {
		clip: await region(page, '.editor-workspace'),
	});

	await page.close();
}

/**
 * Everything is inserted at the centre of the current crop, so each new
 * annotation is dragged aside to compose a readable example.
 */
async function dragLast(page, dx, dy) {
	const overlay = page.locator('.editor-workspace .overlay-hit').last();
	const box = await overlay.boundingBox();

	const fromX = box.x + box.width / 2;
	const fromY = box.y + box.height / 2;

	await page.mouse.move(fromX, fromY);
	await page.mouse.down();
	await page.mouse.move(fromX + dx, fromY + dy, {steps: 12});
	await page.mouse.up();
	await page.waitForTimeout(250);
}

// 5. Annotations on the stage, plus the layers list and the properties of
// the selected layer.

{
	const page = await openEditor();

	await page.getByRole('button', {exact: true, name: 'Add rectangle'}).click();
	await page.waitForTimeout(300);
	await dragLast(page, -240, -170);

	await page.getByRole('button', {exact: true, name: 'Add redaction'}).click();
	await page.waitForTimeout(300);
	await dragLast(page, 150, 120);

	await page.getByRole('button', {exact: true, name: 'Add text'}).click();
	await page.waitForTimeout(600);
	await page.locator('#text-content').fill('Golden hour');
	await page.locator('#text-font-size').fill('96');
	await page.getByRole('button', {exact: true, name: 'Add'}).click();
	await page.waitForTimeout(400);
	await dragLast(page, -170, 190);

	await page
		.getByRole('button', {exact: true, name: 'Add star sticker'})
		.click();
	await page.waitForTimeout(300);
	await dragLast(page, 250, -190);

	await shot(page, 'annotate.jpg', {
		clip: await region(page, '.editor-workspace'),
	});

	// The pointer form of the indicator first: a single thin selection ring
	// on the layer the drag just left selected.

	await shot(page, 'selection.png', {clip: await focusedRegion(page, 40)});

	// The focus indicator has two forms, and only arriving with the keyboard
	// earns the thick double ring. The stage sits just before the sidebar in
	// the tab order, so park focus on the first panel header (the two clicks
	// leave the section as it was) and walk backwards into the stage.

	const header = page.getByRole('button', {
		exact: true,
		name: 'Crop and rotation',
	});

	await header.click();
	await header.click();

	for (let step = 0; step < 40; step++) {
		await page.keyboard.press('Shift+Tab');

		const label = await page.evaluate(
			() => document.activeElement.getAttribute('aria-label') ?? ''
		);

		if (label === 'Star sticker') {
			break;
		}
	}

	await page.waitForTimeout(400);

	await shot(page, 'focus.png', {clip: await focusedRegion(page, 40)});

	// Everything else folded away, so the whole panel (the list and the
	// properties of the selected layer) fits the sidebar in one piece.

	await collapse(
		page,
		'Crop and rotation',
		'Adjustments',
		'Filters',
		'Annotate'
	);

	await revealPanel(page, '.editor-panel:has(#layers-panel-title)');

	await shot(page, 'layers.png', {
		clip: await panelRegion(page, '.editor-panel:has(#layers-panel-title)'),
	});

	await page.close();
}

// 6. A redaction over a filtered image: the mosaic goes through the same
// colour pipeline as the photo.

{
	const page = await openEditor();

	await page.getByRole('button', {exact: true, name: 'Add redaction'}).click();
	await page.waitForTimeout(400);

	await collapse(page, 'Crop and rotation', 'Adjustments');
	await page.getByText('Noir', {exact: true}).click();
	await page.waitForTimeout(700);

	const box = await region(page, '.editor-workspace .overlay-hit', 90);

	await shot(page, 'redaction.jpg', {clip: box});

	await page.close();
}

// 7. The keyboard shortcuts dialog.

{
	const page = await openEditor();

	await page.getByRole('button', {name: 'Keyboard shortcuts'}).click();
	await page.waitForTimeout(900);

	const dialogs = page.locator('.modal-dialog');

	await shot(page, 'shortcuts.png', {
		clip: await (async () => {
			const box = await dialogs.last().boundingBox();

			return {
				height: box.height,
				width: box.width,
				x: box.x,
				y: box.y,
			};
		})(),
	});

	await page.close();
}

// 8. The stacked layout on a phone-sized viewport, and the filter carousel
// it turns the gallery into.

{
	const page = await openEditor({height: 820, width: 400});

	await shot(page, 'mobile.jpg', {clip: await region(page, '.modal-content')});

	await collapse(page, 'Crop and rotation', 'Adjustments');

	await revealPanel(page, '.editor-panel:has(#filters-panel-title)');

	await shot(page, 'mobile-filters.png', {
		clip: await panelRegion(page, '.editor-panel:has(#filters-panel-title)'),
	});

	await collapse(page, 'Filters');

	await revealPanel(page, '.editor-panel:has(#annotate-panel-title)');

	await shot(page, 'mobile-stickers.png', {
		clip: await panelRegion(
			page,
			'.editor-panel:has(#annotate-panel-title)'
		),
	});

	await page.close();
}

await browser.close();
