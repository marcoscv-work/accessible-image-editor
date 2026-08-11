import {execFileSync} from 'node:child_process';
import {existsSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

import {expect, test} from '@playwright/test';

const DIRNAME = path.dirname(fileURLToPath(import.meta.url));

/**
 * The performance budget from the goal: interaction latency under 100ms
 * with a 20MP JPEG loaded. The preview pipeline works on a downscaled
 * bitmap (max 2048px), so the cost under measurement is React re-render +
 * SVG filter/style recalculation + paint scheduling.
 */

const PERF_ASSET = path.join(DIRNAME, 'assets/perf-20mp.jpg');

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

	await page.locator('#adjust-brightness').focus();

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

	// eslint-disable-next-line no-console
	console.log(
		`PERF 20MP: load+open=${loadMillis}ms slider-step=${sliderMillis}ms crop-nudge=${cropMillis}ms`
	);

	expect(sliderMillis).toBeLessThan(100);
	expect(cropMillis).toBeLessThan(100);
});
