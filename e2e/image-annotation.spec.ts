/**
 * SPDX-FileCopyrightText: (c) 2026 Liferay, Inc. https://liferay.com
 * SPDX-License-Identifier: LGPL-2.1-or-later OR LicenseRef-Liferay-DXP-EULA-2.0.0-2023-06
 */

import AxeBuilder from '@axe-core/playwright';
import {expect, test} from '@playwright/test';
import path from 'path';
import {fileURLToPath} from 'url';

const BADGE = path.join(
	path.dirname(fileURLToPath(import.meta.url)),
	'assets',
	'badge.png'
);

/**
 * A picture of the user's own, brought in as one more annotation: it
 * lands in the layers, takes its name from the file, is renamed from the
 * properties, moves and resizes like every other box, and composites into
 * the export.
 */

test('brings a picture in as an annotation', async ({page}) => {
	await page.goto('/');

	await page.keyboard.press('Tab');
	await page.keyboard.press('Tab');
	await page.keyboard.press('Enter');

	await expect(page.locator('.modal')).toHaveCSS('opacity', '1');

	await page.getByRole('button', {exact: true, name: 'Add image'}).click();

	// Scoped to the dialog: the demonstration page has a picker of its own
	// for the photograph being edited.

	await page
		.getByRole('dialog')
		.locator('input[type=file]')
		.setInputFiles(BADGE);

	// The bitmap has to travel as a data URL: the export rasterizes its
	// SVG through an img, which cannot fetch blob: subresources.

	const picture = page.locator('.editor-workspace image[href^="data:"]');

	await expect(picture).toHaveCount(1);

	// The picture keeps its proportions: 96 by 48 arrives twice as wide as
	// it is tall, whatever the crop it landed in.

	const box = await picture.evaluate((node) => ({
		height: Number(node.getAttribute('height')),
		width: Number(node.getAttribute('width')),
	}));

	expect(box.width / box.height).toBeCloseTo(2, 1);

	const overlay = page.locator('.overlay-hit').first();

	await expect(overlay).toHaveAttribute('aria-label', 'badge');

	// Seeded from the file name and editable, because a file name names a
	// file and this is what a screen reader will read out.

	await page.locator('.editor-layer-name', {hasText: 'badge'}).click();

	const description = page.locator('#layer-prop-description');

	await description.fill('Liferay badge');
	await description.press('Enter');

	await expect(overlay).toHaveAttribute('aria-label', 'Liferay badge');

	// One more box: the width and height fields drive it like any other.
	// A picture arrives with its proportions locked, so the side that was
	// not typed follows instead of leaving the reader to do the division.

	const padlock = page.locator(
		'.editor-layer-properties .editor-aspect-lock'
	);

	await expect(padlock).toHaveAttribute('aria-pressed', 'true');

	await page.locator('#layer-prop-width').fill('300');
	await page.locator('#layer-prop-width').press('Enter');

	await expect(picture).toHaveAttribute('width', '300');
	await expect(picture).toHaveAttribute('height', '150');

	// Typing a height works the same way round.

	await page.locator('#layer-prop-height').fill('100');
	await page.locator('#layer-prop-height').press('Enter');

	await expect(picture).toHaveAttribute('width', '200');

	// Unlocked, the two sides are independent again.

	await padlock.click();

	await expect(page.getByRole('status')).toContainText(
		'Aspect ratio unlocked'
	);

	await page.locator('#layer-prop-width').fill('320');
	await page.locator('#layer-prop-width').press('Enter');

	await expect(picture).toHaveAttribute('width', '320');
	await expect(picture).toHaveAttribute('height', '100');

	// Rotation follows the size pair, and the border is one control with
	// two halves, so every row of the properties grid is filled.

	const order = await page
		.locator('.editor-layer-properties .editor-panel-grid')
		.evaluate((grid) =>
			[...grid.children].flatMap((cell) =>
				[...cell.querySelectorAll('label, .editor-field-label')].map(
					(label) => label.textContent?.trim()
				)
			)
		);

	expect(order).toEqual([
		'X position',
		'Y position',
		'Width',
		'Height',
		'Rotation',
		'Opacity',
	]);

	const results = await new AxeBuilder({page})
		.include('.modal-content')
		.analyze();

	expect(results.violations).toEqual([]);

	const downloadPromise = page.waitForEvent('download');

	await page.getByRole('button', {exact: true, name: 'Save'}).click();

	const download = await downloadPromise;

	expect(download.suggestedFilename()).toBe('sample-edited.jpg');
});
