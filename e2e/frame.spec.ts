/**
 * SPDX-FileCopyrightText: (c) 2026 Liferay, Inc. https://liferay.com
 * SPDX-License-Identifier: LGPL-2.1-or-later OR LicenseRef-Liferay-DXP-EULA-2.0.0-2023-06
 */

import AxeBuilder from '@axe-core/playwright';
import {Page, expect, test} from '@playwright/test';

/**
 * The frame: one at a time like a filter, configurable once chosen, and
 * measured against the crop rather than baked in, so a later crop reframes
 * the picture instead of stranding the border where the old edges were.
 */

async function frameRect(page: Page) {
	return page
		.locator('.editor-stage .editor-frame rect')
		.first()
		.evaluate((node) => ({
			height: Number(node.getAttribute('height')),
			stroke: node.getAttribute('stroke'),
			strokeWidth: Number(node.getAttribute('stroke-width')),
			width: Number(node.getAttribute('width')),
			x: Number(node.getAttribute('x')),
			y: Number(node.getAttribute('y')),
		}));
}

test('frames the picture and reframes it after a crop', async ({page}) => {
	await page.goto('/');

	await page.keyboard.press('Tab');
	await page.keyboard.press('Tab');
	await page.keyboard.press('Enter');

	await expect(page.locator('.modal')).toHaveCSS('opacity', '1');

	// Nothing is drawn on the stage until a frame is picked. The cards
	// draw through the same component, so scope this to the stage.

	await expect(page.locator('.editor-stage .editor-frame')).toHaveCount(0);

	const mat = page.locator('[id$="-frame-mat"]');

	// Through the card, the way a person picks it: the radio is visually
	// hidden, so clicking the input itself is a race with the layout.

	const pick = (name: string) =>
		page
			.locator('.editor-panel:has([id$="-frame-panel-title"]) .editor-preset-label')
			.filter({hasText: new RegExp(`^${name}$`)})
			.click();

	await pick('Mat');

	await expect(mat).toBeChecked();

	await expect(page.locator('.editor-announcer')).toContainText('Frame set to Mat');

	// The measurements are percentages of the crop's shorter side, so the
	// expectations are derived from the crop rather than hardcoded.

	const crop = {
		height: Number(await page.locator('[id$="-crop-height"]').inputValue()),
		width: Number(await page.locator('[id$="-crop-width"]').inputValue()),
	};

	const band = Math.min(crop.width, crop.height) * 0.04;

	const framed = await frameRect(page);

	// A stroke is centred on its path, so a band that hugs the edge sits
	// inset by half its width.

	expect(framed.strokeWidth).toBeCloseTo(band, 1);
	expect(framed.x).toBeCloseTo(band / 2, 1);
	expect(framed.width).toBeCloseTo(crop.width - band, 1);

	// A single radio group: the arrows walk it and only one is ever on.

	await mat.focus();
	await page.keyboard.press('ArrowDown');

	await expect(page.locator('[id$="-frame-bevel"]')).toBeChecked();
	await expect(mat).not.toBeChecked();

	await pick('Mat');

	// The size is a percentage of the crop, so the same frame is the same
	// frame at any size of picture.

	const size = page.locator('[id$="-frame-size"]');

	await size.focus();

	for (let step = 0; step < 4; step++) {
		await page.keyboard.press('ArrowRight');
	}

	await expect(page.locator('.editor-announcer')).toContainText(
		'Frame size set to 8 percent'
	);

	expect((await frameRect(page)).strokeWidth).toBeCloseTo(band * 2, 1);

	// Crop hard: the frame is drawn from the crop rectangle, so it lands
	// on the new edges by itself.

	for (const [field, value] of [
		['width', '600'],
		['height', '600'],
		['x', '400'],
		['y', '300'],
	]) {
		const input = page.locator(`[id$="-crop-${field}"]`);

		await input.fill(value);
		await input.press('Enter');
	}

	const reframed = await frameRect(page);

	// 8% of the new shorter side, 600, is 48.

	expect(reframed.strokeWidth).toBeCloseTo(48, 1);
	expect(reframed.x).toBeCloseTo(424, 1);
	expect(reframed.y).toBeCloseTo(324, 1);
	expect(reframed.width).toBeCloseTo(552, 1);

	// The frame sits over the annotations by default, and under them when
	// the choice is unticked: a mat should not have to hide a caption.

	await page
		.getByRole('button', {exact: true, name: 'Add shape'})
		.click();
	await page.locator('.dropdown-menu.show').getByRole('button', {name: 'Rectangle'}).click();

	const order = () =>
		page.evaluate(() => {
			const frame = document.querySelector('.editor-stage .editor-frame');
			const overlay = document.querySelector(
				'.editor-stage .overlay-hit'
			);

			if (!frame || !overlay) {
				return 'missing';
			}

			return frame.compareDocumentPosition(overlay) &
				Node.DOCUMENT_POSITION_PRECEDING
				? 'frame over'
				: 'frame under';
		});

	expect(await order()).toBe('frame over');

	await page
		.getByLabel('Placement', {exact: true})
		.selectOption('under');

	await expect(page.locator('.editor-announcer')).toContainText(
		'drawn under the annotations'
	);

	expect(await order()).toBe('frame under');

	const results = await new AxeBuilder({page})
		.include('.modal-content')
		.analyze();

	expect(results.violations).toEqual([]);

	// Undo walks back through the frame edits like any other change.

	await page.getByRole('button', {name: 'Undo'}).click();

	await expect(page.locator('.editor-announcer')).toContainText('Undo: frame change');

	const downloadPromise = page.waitForEvent('download');

	await page.getByRole('button', {exact: true, name: 'Save'}).click();

	expect((await downloadPromise).suggestedFilename()).toBe(
		'sample-edited.jpg'
	);
});
