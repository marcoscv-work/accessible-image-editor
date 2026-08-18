/**
 * SPDX-FileCopyrightText: (c) 2026 Liferay, Inc. https://liferay.com
 * SPDX-License-Identifier: LGPL-2.1-or-later OR LicenseRef-Liferay-DXP-EULA-2.0.0-2023-06
 */

/**
 * Regenerates the screenshots the website uses, straight from the running
 * editor: every image there is the real UI, never a mockup.
 *
 *     npm run dev              # in another shell
 *     node scripts/capture-website.mjs
 *
 * Set EDITOR_URL to point somewhere other than the default dev server.
 */

import {chromium} from '@playwright/test';
import {mkdirSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

const SHOTS = path.join(ROOT, 'website/screenshots');

const URL = process.env.EDITOR_URL ?? 'http://localhost:5273';

mkdirSync(SHOTS, {recursive: true});

const browser = await chromium.launch();

/**
 * Opens the editor on the sample image and waits for the modal to settle:
 * a screenshot taken mid-fade catches half-animated colours.
 */
async function openEditor({height = 900, query = '', width = 1280} = {}) {
	const page = await browser.newPage({
		deviceScaleFactor: 2,
		viewport: {height, width},
	});

	await page.goto(`${URL}${query}`);
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
/**
 * The smallest box holding all of the given ones. A menu is portaled out
 * of its panel, so a shot of the panel alone would cut it in half.
 */
function union(...boxes) {
	const left = Math.min(...boxes.map((box) => box.x));
	const top = Math.min(...boxes.map((box) => box.y));

	return {
		height: Math.max(...boxes.map((box) => box.y + box.height)) - top,
		width: Math.max(...boxes.map((box) => box.x + box.width)) - left,
		x: left,
		y: top,
	};
}

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

// 4b. The whole frame panel in one picture, gallery and options together,
// and a framed photograph. The gallery is trimmed through the editor's own
// configuration so the panel fits a single shot.

{
	const page = await openEditor({
		query: '?frames=none,mat,bevel,line',
	});

	await collapse(page, 'Crop and rotation', 'Adjustments', 'Filters');

	await page.locator('#frame-mat').check({force: true});
	await page.waitForTimeout(500);

	await page.evaluate(() => {
		const sidebar = document.querySelector('.editor-sidebar');
		const title = document.getElementById('frame-panel-title');

		sidebar.scrollTop +=
			title.getBoundingClientRect().top -
			sidebar.getBoundingClientRect().top -
			12;
	});

	await page.waitForTimeout(400);

	await shot(page, 'frame-panel.png', {
		clip: await panelRegion(page, '.editor-panel:has(#frame-panel-title)'),
	});

	await page.close();
}

// 4b2. A framed photograph on the stage, with the whole set available.

{
	const page = await openEditor();

	await collapse(page, 'Crop and rotation', 'Adjustments', 'Filters');

	await page.locator('#frame-polaroid').check({force: true});
	await page.waitForTimeout(500);

	await shot(page, 'stage-framed.jpg', {
		clip: await region(page, '.editor-workspace'),
	});

	await page.close();
}

// 4c. The same caption with the frame over it and under it: the choice
// the user gets to make.

{
	const page = await openEditor();

	await collapse(page, 'Crop and rotation', 'Adjustments', 'Filters');

	await page.locator('#frame-mat').check({force: true});
	await page.waitForTimeout(300);

	const size = page.locator('#frame-size');

	await size.focus();

	for (let step = 0; step < 6; step++) {
		await page.keyboard.press('ArrowRight');
	}

	await page.waitForTimeout(300);

	await page.getByRole('button', {exact: true, name: 'Add text'}).click();
	await page.waitForTimeout(400);
	await page.locator('#text-content').fill('Liferay 2026');
	await page.getByRole('button', {exact: true, name: 'Add'}).click();
	await page.waitForTimeout(500);

	// Dark ink, or a white caption on a white mat is a picture of
	// nothing.

	await page.evaluate(() => {
		const input = document.getElementById('layer-prop-color');

		const setter = Object.getOwnPropertyDescriptor(
			window.HTMLInputElement.prototype,
			'value'
		).set;

		setter.call(input, '#272833');

		input.dispatchEvent(new Event('input', {bubbles: true}));
		input.blur();
	});

	await page.waitForTimeout(400);

	// Down onto the frame's bottom band, where the two orders differ.

	for (const [id, value] of [
		['#layer-prop-y', '1070'],
		['#layer-prop-x', '260'],
	]) {
		const field = page.locator(id);

		await field.fill(value);
		await field.press('Enter');
		await page.waitForTimeout(150);
	}

	// Deselected, so the handles do not explain the picture away.

	await page.locator('.editor-workspace').click({position: {x: 8, y: 8}});
	await page.waitForTimeout(300);

	const stage = await region(page, '.editor-workspace');

	await shot(page, 'frame-over.jpg', {clip: stage});

	await page
		.getByRole('checkbox', {name: 'Draw the frame over the annotations'})
		.uncheck();

	await page.waitForTimeout(400);

	await shot(page, 'frame-under.jpg', {clip: stage});

	await page.close();
}

/**
 * Everything is inserted at the centre of the current crop, so each new
 * annotation is dragged aside to compose a readable example.
 */
async function addShape(page, shape) {
	await page.getByRole('button', {exact: true, name: 'Add shape'}).click();
	await page.locator('.dropdown-menu.show').getByRole('button', {name: shape}).click();
	await page.waitForTimeout(300);
}

async function addSticker(page, sticker) {
	await page.getByRole('button', {exact: true, name: 'Add sticker'}).click();
	await page.locator('.dropdown-menu.show').getByRole('button', {name: sticker}).click();
	await page.waitForTimeout(300);
}

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

	await addShape(page, 'Rectangle');
	await dragLast(page, -240, -170);

	await page.getByRole('button', {exact: true, name: 'Add redaction'}).click();
	await page.waitForTimeout(300);
	await dragLast(page, 150, 120);

	await addShape(page, 'Arrow');
	await dragLast(page, -60, 120);

	await page.getByRole('button', {exact: true, name: 'Add text'}).click();
	await page.waitForTimeout(600);
	await page.locator('#text-content').fill('Golden hour');
	await page.locator('#text-font-size').fill('96');
	await page.getByRole('button', {exact: true, name: 'Add'}).click();
	await page.waitForTimeout(400);
	await dragLast(page, -170, 190);

	await addSticker(page, 'Star sticker');
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

// 5b. A picture of the user's own, brought in as an annotation: on the
// stage as a watermark, and in the layers as a named, described layer.

{
	const page = await openEditor();

	await collapse(page, 'Crop and rotation', 'Adjustments', 'Filters', 'Frame');

	await page.getByRole('button', {exact: true, name: 'Add image'}).click();

	await page
		.locator('.modal-content input[type=file]')
		.setInputFiles(path.join(ROOT, 'scripts', 'assets', 'watermark.png'));

	await page.waitForTimeout(700);

	// Composed into the sky, at a watermark's size.

	for (const [id, value] of [
		['#layer-prop-width', '150'],
		['#layer-prop-height', '150'],
		['#layer-prop-x', '1230'],
		['#layer-prop-y', '170'],
		['#layer-prop-opacity', '80'],
	]) {
		const field = page.locator(id);

		await field.fill(value);
		await field.press('Enter');
		await page.waitForTimeout(150);
	}

	await page.waitForTimeout(300);

	await shot(page, 'picture.jpg', {
		clip: await region(page, '.editor-workspace'),
	});

	await revealPanel(page, '.editor-panel:has(#layers-panel-title)');

	await shot(page, 'picture-layer.png', {
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

// 6b. The same editor in both colour schemes, for the theme section.

for (const scheme of ['light', 'dark']) {
	const page = await openEditor({height: 860, width: 1200});

	if (scheme === 'dark') {
		// The demonstration page carries the switch; the editor itself only
		// reads the attribute the theme sets.

		await page.getByRole('button', {name: 'Close'}).click();
		await page.waitForTimeout(600);
		await page
			.getByRole('button', {name: 'Switch to the dark theme'})
			.click();

		// Clicking leaves the switch focused and hovered, and its tooltip
		// would sit in the middle of the capture.

		await page.evaluate(() => document.activeElement?.blur());
		await page.mouse.move(0, 0);
		await page.waitForTimeout(500);
		await page.getByRole('button', {name: 'Edit sample image'}).click();
		await page.locator('.modal').waitFor();
		await page.waitForTimeout(1400);
	}

	await shot(page, `scheme-${scheme}.jpg`, {
		clip: await region(page, '.modal-content'),
	});

	await page.close();
}

// 6c. A deliberately tiny annotation at two zoom levels, with its target
// outlined for the picture: the target is transparent in the product, and
// the point of the shot is that it does not change size on screen.

{
	const page = await openEditor({height: 700, width: 900});

	await addShape(page, 'Circle');
	await page.waitForTimeout(100);

	// Over the sky: on the carved stone neither the dot nor the outline
	// reads, and the picture has to be legible before it can make a point.

	for (const [id, value] of [
		['#layer-prop-width', '12'],
		['#layer-prop-height', '12'],
		['#layer-prop-x', '1200'],
		['#layer-prop-y', '430'],
	]) {
		const field = page.locator(id);

		await field.fill(value);
		await field.press('Enter');
		await page.waitForTimeout(200);
	}

	await page.evaluate(() => {
		const style = document.createElement('style');

		// Two-tone, like the editor's own focus rings: a white halo under a
		// blue dash survives whatever the photograph is doing underneath.

		style.textContent =
			'.overlay-hit { filter: drop-shadow(0 0 1px #fff) ' +
			'drop-shadow(0 0 1px #fff) drop-shadow(0 0 2px #fff); ' +
			'stroke: #0b5fff; stroke-dasharray: 5 3; stroke-width: 2px; ' +
			'vector-effect: non-scaling-stroke; }';

		document.head.append(style);
	});

	// Deselected, so the resize handles do not cover the very thing the
	// picture is about.

	await page.locator('.editor-workspace').click({position: {x: 8, y: 8}});
	await page.waitForTimeout(300);

	const shot = async (name) => {
		const box = await region(page, '.editor-workspace .overlay-hit', 80);

		await page.mouse.move(0, 0);
		await page.waitForTimeout(200);
		await page.screenshot({
			clip: box,
			path: path.join(SHOTS, name),
			quality: 88,
			type: 'jpeg',
		});

		console.log('captured', name);
	};

	await shot('target-fit.jpg');

	// Zooming from the keyboard anchors on the pointer, so parking it over
	// the annotation is what keeps the annotation on screen.

	const anchor = await region(page, '.editor-workspace .overlay-hit', 0);

	await page.mouse.move(
		anchor.x + anchor.width / 2,
		anchor.y + anchor.height / 2
	);

	for (let step = 0; step < 3; step++) {
		await page.keyboard.press('+');
		await page.waitForTimeout(200);
	}

	await page.waitForTimeout(400);
	await shot('target-zoomed.jpg');

	await page.close();
}

// 7. The keyboard shortcuts dialog.

{
	const page = await openEditor();

	await page.getByRole('button', {name: 'Keyboard shortcuts'}).click();
	await page.waitForTimeout(900);

	// The dialog box carries margins, and clipping to it left a strip of the
	// dark workspace down each edge. The card itself is the content.

	const box = await page
		.locator('.modal-dialog')
		.last()
		.locator('.modal-content')
		.boundingBox();

	// Inset by a pixel: the card's own rounded corners let whatever is
	// behind them show, and the editor is right there.

	await shot(page, 'shortcuts.png', {
		clip: {
			height: box.height - 4,
			width: box.width - 4,
			x: box.x + 2,
			y: box.y + 2,
		},
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

	// The frames come between the filters and the annotations, and a menu
	// opening over somebody else's carousel says nothing about either.

	await collapse(page, 'Filters', 'Frame');

	await revealPanel(page, '.editor-panel:has(#annotate-panel-title)');

	await page.getByRole('button', {exact: true, name: 'Add sticker'}).click();
	await page.waitForTimeout(400);

	await shot(page, 'mobile-annotate.png', {
		clip: union(
			await panelRegion(
				page,
				'.editor-panel:has(#annotate-panel-title)'
			),
			await region(page, '.dropdown-menu.show')
		),
	});

	await page.close();
}

await browser.close();
