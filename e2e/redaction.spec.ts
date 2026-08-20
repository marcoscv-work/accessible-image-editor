/**
 * SPDX-FileCopyrightText: (c) 2026 Liferay, Inc. https://liferay.com
 * SPDX-License-Identifier: LGPL-2.1-or-later OR LicenseRef-Liferay-DXP-EULA-2.0.0-2023-06
 */

import {Page, expect, test} from '@playwright/test';
import {readFile} from 'fs/promises';

/**
 * A redaction hides an area in one of two ways, and both have to survive
 * the export: what leaves the editor is a rasterised copy, and a viewer
 * who can recover the detail from it has not been given a redaction at
 * all. The blur is the one that could quietly fail, because it draws from
 * the picture itself rather than from a prepared mosaic, and the
 * rasteriser runs in a mode that refuses `blob:` subresources.
 */

async function openEditor(page: Page) {
	await page.goto('/');

	await page.getByRole('button', {name: 'Edit sample image'}).click();

	await expect(page.locator('.modal')).toHaveCSS('opacity', '1');
}

/**
 * Two measurements over a rectangle of an image, in its own pixels: how
 * much neighbouring pixels differ (detail), and the average colour. A
 * blurred region keeps the average and loses the detail. A region that
 * failed to draw loses both, which is what tells the two apart.
 */
async function sample(
	page: Page,
	dataUrl: string,
	region: {height: number; width: number; x: number; y: number}
) {
	return page.evaluate(
		async ([url, box]) => {
			const bitmap = await createImageBitmap(
				await (await fetch(url as string)).blob()
			);

			const area = box as {
				height: number;
				width: number;
				x: number;
				y: number;
			};

			const canvas = document.createElement('canvas');

			canvas.height = bitmap.height;
			canvas.width = bitmap.width;

			const context = canvas.getContext('2d')!;

			context.drawImage(bitmap, 0, 0);

			const {data} = context.getImageData(
				area.x,
				area.y,
				area.width,
				area.height
			);

			let detail = 0;
			let total = 0;

			for (let row = 0; row < area.height; row++) {
				for (let column = 0; column < area.width - 1; column++) {
					const at = (row * area.width + column) * 4;

					total += data[at] + data[at + 1] + data[at + 2];

					detail +=
						Math.abs(data[at] - data[at + 4]) +
						Math.abs(data[at + 1] - data[at + 5]) +
						Math.abs(data[at + 2] - data[at + 6]);
				}
			}

			const pixels = area.height * (area.width - 1);

			return {detail: detail / pixels, mean: total / pixels / 3};
		},
		[dataUrl, region] as const
	);
}

test('a blurred redaction survives the export', async ({page}) => {
	await openEditor(page);

	await page.getByRole('button', {exact: true, name: 'Add redaction'}).click();

	// Over the balustrade, which is the most detailed part of the picture:
	// a region that is already flat would prove nothing.

	for (const [id, value] of [
		['[id$="-layer-prop-width"]', '360'],
		['[id$="-layer-prop-height"]', '160'],
		['[id$="-layer-prop-x"]', '260'],
		['[id$="-layer-prop-y"]', '760'],
	]) {
		await page.locator(id).fill(value);
		await page.locator(id).press('Enter');
	}

	await page.getByLabel('Type', {exact: true}).selectOption('blur');
	await page.getByLabel('Strength', {exact: true}).selectOption('coarse');

	await expect(
		page.locator('filter[id^="redact-blur-"] feGaussianBlur')
	).toHaveCount(1);

	const downloadPromise = page.waitForEvent('download');

	await page.getByRole('button', {exact: true, name: 'Save'}).click();

	const download = await downloadPromise;

	const exported = `data:image/jpeg;base64,${(
		await readFile(await download.path())
	).toString('base64')}`;

	// The block, and the untouched picture immediately beside it: the same
	// slope continues there, so it is the baseline this file carries
	// with it, and no second export is needed to have something to compare.

	const inside = await sample(page, exported, {
		height: 160,
		width: 360,
		x: 260,
		y: 760,
	});

	const beside = await sample(page, exported, {
		height: 160,
		width: 360,
		x: 640,
		y: 760,
	});

	// The detail is gone. Measured at 25 times less than its neighbour,
	// asserted at 5, so the test says "obliterated" rather than "tuned".

	expect(inside.detail).toBeLessThan(beside.detail / 5);

	// And something is still drawn there. This is the assertion that
	// catches the failure worth catching: had the rasteriser refused the
	// picture, the block would be flat *and* empty, passing the check
	// above while hiding nothing but the fact that it drew nothing.

	expect(inside.mean).toBeGreaterThan(beside.mean * 0.6);
	expect(inside.mean).toBeLessThan(beside.mean * 1.4);
});

test('a redaction keeps covering its pixels through a rotation', async ({
	page,
}) => {
	await openEditor(page);

	await page.getByRole('button', {exact: true, name: 'Add redaction'}).click();

	// Over the volcano's rocky flank: detail that would visibly leak.

	for (const [id, value] of [
		['[id$="-layer-prop-width"]', '360'],
		['[id$="-layer-prop-height"]', '160'],
		['[id$="-layer-prop-x"]', '260'],
		['[id$="-layer-prop-y"]', '760'],
	]) {
		await page.locator(id).fill(value);
		await page.locator(id).press('Enter');
	}

	// Blurred, like the sibling test: a mosaic keeps the edges of its own
	// blocks, which muddies the detail metric this assertion leans on.

	await page.getByLabel('Type', {exact: true}).selectOption('blur');
	await page.getByLabel('Strength', {exact: true}).selectOption('coarse');

	await page.getByRole('button', {name: 'Rotate 90 degrees'}).click();

	// The redaction must follow its pixels into the rotated space: the
	// property fields are the witness. (Not the hit rect: that one
	// clamps to a 24-screen-pixel minimum target, which at this image's
	// fit zoom is wider than the folded box itself.)

	await expect(page.locator('[id$="-layer-prop-width"]')).toHaveValue(
		'160'
	);
	await expect(page.locator('[id$="-layer-prop-height"]')).toHaveValue(
		'360'
	);

	const downloadPromise = page.waitForEvent('download');

	await page.getByRole('button', {exact: true, name: 'Save'}).click();

	const download = await downloadPromise;

	const exported = `data:image/jpeg;base64,${(
		await readFile(await download.path())
	).toString('base64')}`;

	// A display point (x, y) lands on (H - y, x): the covered content
	// now lives at (1348, 260) sized 160x360 (H = 2268), and the strip
	// below it in the rotated frame holds the volcano's slope that
	// continues unhidden.

	const inside = await sample(page, exported, {
		height: 360,
		width: 160,
		x: 1348,
		y: 260,
	});

	const beside = await sample(page, exported, {
		height: 360,
		width: 160,
		x: 1348,
		y: 640,
	});

	// Hidden stays hidden, rotated or not; and the region genuinely
	// drew, so this is a covered area rather than a void.

	expect(inside.detail).toBeLessThan(beside.detail / 5);
	expect(inside.mean).toBeGreaterThan(beside.mean * 0.6);
	expect(inside.mean).toBeLessThan(beside.mean * 1.4);
});
