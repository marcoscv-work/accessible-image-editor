/**
 * SPDX-FileCopyrightText: (c) 2026 Liferay, Inc. https://liferay.com
 * SPDX-License-Identifier: LGPL-2.1-or-later OR LicenseRef-Liferay-DXP-EULA-2.0.0-2023-06
 */

import {Page, expect, test} from '@playwright/test';

/**
 * A zoom step holds one point of the image still: the one under the pointer
 * while it is over the stage, and the centre of the view otherwise.
 */

async function openEditor(page: Page) {
	await page.goto('/');

	await page.getByRole('button', {name: 'Edit sample image'}).click();
	await expect(page.locator('.modal')).toHaveCSS('opacity', '1');
	await page.waitForTimeout(600);
}

/**
 * Which fraction of the image sits under a client point, so the assertion
 * does not depend on the zoom level itself.
 */
async function imageFractionAt(page: Page, x: number, y: number) {
	return page.evaluate(
		({x, y}) => {
			const rect = document
				.querySelector('.editor-workspace image')!
				.getBoundingClientRect();

			return {
				x: (x - rect.left) / rect.width,
				y: (y - rect.top) / rect.height,
			};
		},
		{x, y}
	);
}

test('zooms towards the pointer when it is over the stage', async ({page}) => {
	await openEditor(page);

	const workspace = page.locator('.editor-workspace');
	const box = (await workspace.boundingBox())!;

	// A point well away from the centre, so a centred zoom would move it.

	const point = {
		x: box.x + box.width * 0.75,
		y: box.y + box.height * 0.3,
	};

	await workspace.click({position: {x: 4, y: 4}});

	// Zoom in until the stage is larger than the view: while it still fits,
	// there is no scroll range and no anchor can be honoured.

	await page.mouse.move(point.x, point.y);
	await page.keyboard.press('+');
	await page.keyboard.press('+');
	await page.waitForTimeout(400);

	const scrollable = await workspace.evaluate(
		(element) => element.scrollWidth > element.clientWidth
	);

	expect(scrollable).toBe(true);

	await page.mouse.move(point.x, point.y);

	const before = await imageFractionAt(page, point.x, point.y);

	await page.keyboard.press('+');
	await page.waitForTimeout(400);

	const after = await imageFractionAt(page, point.x, point.y);

	expect(Math.abs(after.x - before.x)).toBeLessThan(0.02);
	expect(Math.abs(after.y - before.y)).toBeLessThan(0.02);
});

test('zooms towards the centre when the pointer is elsewhere', async ({
	page,
}) => {
	await openEditor(page);

	const workspace = page.locator('.editor-workspace');
	const box = (await workspace.boundingBox())!;

	const centre = {x: box.x + box.width / 2, y: box.y + box.height / 2};

	await workspace.click({position: {x: 4, y: 4}});

	// Park the pointer outside the stage, the way it sits for someone
	// working from the keyboard.

	await page.mouse.move(box.x + box.width + 60, box.y + 20);

	const before = await imageFractionAt(page, centre.x, centre.y);

	await page.keyboard.press('+');
	await page.waitForTimeout(400);

	const after = await imageFractionAt(page, centre.x, centre.y);

	expect(Math.abs(after.x - before.x)).toBeLessThan(0.02);
	expect(Math.abs(after.y - before.y)).toBeLessThan(0.02);
});
