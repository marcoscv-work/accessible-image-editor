/**
 * SPDX-FileCopyrightText: (c) 2026 Liferay, Inc. https://liferay.com
 * SPDX-License-Identifier: LGPL-2.1-or-later OR LicenseRef-Liferay-DXP-EULA-2.0.0-2023-06
 */

import {expect, test} from '@playwright/test';
import {execFileSync} from 'node:child_process';
import {existsSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const DIRNAME = path.dirname(fileURLToPath(import.meta.url));

/**
 * The performance budget from the goal: interaction latency under 100ms
 * with a 20MP JPEG loaded. The preview pipeline works on a downscaled
 * bitmap (max 2048px), so the cost under measurement is React re-render +
 * SVG filter/style recalculation + paint scheduling.
 */

const PERF_ASSET = path.join(DIRNAME, 'assets/perf-20mp.jpg');

const BADGE_ASSET = path.join(DIRNAME, 'assets/badge.png');

test.beforeAll(() => {
	if (!existsSync(PERF_ASSET)) {
		execFileSync('node', [
			path.join(DIRNAME, '../scripts/generate-images.mjs'),
		]);
	}
});

async function measureInteraction(
	page: import('@playwright/test').Page,
	action: () => Promise<void>
): Promise<number> {
	await page.evaluate(() => {
		(window as any).__interactionStart = 0;
		(window as any).__interactionEnd = 0;
	});

	const start = Date.now();

	await action();

	// Two nested animation frames after the interaction: the second frame
	// can only fire once the frame containing the update has painted.

	await page.evaluate(
		() =>
			new Promise<void>((resolve) =>
				requestAnimationFrame(() =>
					requestAnimationFrame(() => resolve())
				)
			)
	);

	return Date.now() - start;
}

test('20MP image: load, slider, and crop interactions stay responsive', async ({
	page,
}) => {
	await page.goto('/');

	const loadStart = Date.now();

	await page
		.locator('input[type="file"]')
		.setInputFiles(PERF_ASSET);

	await expect(page.getByRole('dialog')).toBeVisible();
	await expect(page.locator('.modal')).toHaveCSS('opacity', '1');

	const loadMillis = Date.now() - loadStart;

	// Slider interaction latency: one arrow-key step on Brightness.

	await page.locator('[id$="-adjust-brightness"]').focus();

	const sliderMillis = await measureInteraction(page, async () => {
		await page.keyboard.press('ArrowRight');
	});

	// Crop handle interaction latency: one arrow-key nudge.

	const handle = page.getByRole('button', {
		name: 'Crop handle: right edge',
	});

	await handle.focus();

	const cropMillis = await measureInteraction(page, async () => {
		await page.keyboard.press('ArrowLeft');
	});

	// A frame is drawn from the crop on every render, so its slider is
	// the same kind of interaction as the tone sliders.

	// Through the label, the way a person picks it: the radio itself is
	// visually hidden, and the card is the target.

	await page.getByText('Mat', {exact: true}).click();

	await page.locator('[id$="-frame-size"]').focus();

	const frameMillis = await measureInteraction(page, async () => {
		await page.keyboard.press('ArrowRight');
	});

	// eslint-disable-next-line no-console
	console.log(
		`PERF 20MP: load+open=${loadMillis}ms slider-step=${sliderMillis}ms ` +
			`crop-nudge=${cropMillis}ms frame-step=${frameMillis}ms`
	);

	expect(sliderMillis).toBeLessThan(100);
	expect(cropMillis).toBeLessThan(100);
	expect(frameMillis).toBeLessThan(100);
});

/**
 * Export is the one operation that touches the original file: the whole
 * scene is serialized, rasterized at full resolution and encoded. It runs
 * once, on a click, so the budget is a second-scale ceiling rather than
 * an interaction one; the point of measuring is to notice the day it
 * doubles.
 */

test('20MP image: exporting a full scene stays within seconds', async ({
	page,
}) => {
	await page.goto('/');

	await page.locator('input[type="file"]').setInputFiles(PERF_ASSET);

	await expect(page.getByRole('dialog')).toBeVisible();
	await expect(page.locator('.modal')).toHaveCSS('opacity', '1');

	// A scene with everything that costs something at export time: a
	// colour pipeline, a pixelated redaction, a picture of the user's own
	// and a frame.

	await page.getByText('Vintage', {exact: true}).click();

	await page.getByRole('button', {exact: true, name: 'Add redaction'}).click();

	await page.getByRole('button', {exact: true, name: 'Add image'}).click();

	await page
		.getByRole('dialog')
		.locator('input[type=file]')
		.setInputFiles(BADGE_ASSET);

	await page.getByText('Print', {exact: true}).click();

	await expect(page.locator('.editor-stage .editor-frame')).toBeVisible();

	const downloadPromise = page.waitForEvent('download');

	const exportStart = Date.now();

	await page.getByRole('button', {exact: true, name: 'Save'}).click();

	await downloadPromise;

	const exportMillis = Date.now() - exportStart;

	// eslint-disable-next-line no-console
	console.log(`PERF 20MP: export=${exportMillis}ms`);

	expect(exportMillis).toBeLessThan(10_000);
});
