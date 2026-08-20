/**
 * SPDX-FileCopyrightText: (c) 2026 Liferay, Inc. https://liferay.com
 * SPDX-License-Identifier: LGPL-2.1-or-later OR LicenseRef-Liferay-DXP-EULA-2.0.0-2023-06
 */

import AxeBuilder from '@axe-core/playwright';
import {Page, expect, test} from '@playwright/test';

/**
 * The whole journey is keyboard-only: no mouse events are synthesized at
 * any point. Movement between controls uses Tab, activation uses Enter or
 * Space, and spatial edits use the arrow keys.
 */

async function tabUntil(page: Page, ariaLabel: string): Promise<void> {
	for (let i = 0; i < 80; i++) {
		const label = await page.evaluate(() => {
			const active = document.activeElement;

			return (
				active?.getAttribute('aria-label') ||
				active?.id ||
				active?.textContent?.trim() ||
				''
			);
		});

		if (label === ariaLabel || label.endsWith(`-${ariaLabel}`)) {

			// Ids carry the editor's instance prefix; labels do not.

			return;
		}

		await page.keyboard.press('Tab');
	}

	throw new Error(`Never reached element labelled "${ariaLabel}"`);
}

async function expectNoAxeViolations(page: Page): Promise<void> {
	const results = await new AxeBuilder({page}).analyze();

	expect(results.violations).toEqual([]);
}

/**
 * Clay's modal fades in; interacting (or scanning colors) mid-transition
 * hits a half-animated UI, so wait until the fade has fully settled.
 */
async function waitForModalSettled(page: Page): Promise<void> {
	await expect(page.locator('.modal')).toHaveCSS('opacity', '1');
}

test('keyboard-only crop journey', async ({page}) => {
	await page.goto('/');

	await expectNoAxeViolations(page);

	// Open the sample image from the keyboard. The demonstration page opens
	// with a colour scheme switch, so the sample button is the second stop.

	await page.keyboard.press('Tab');
	await page.keyboard.press('Tab');

	const sampleButton = page.getByRole('button', {name: 'Edit sample image'});

	await expect(sampleButton).toBeFocused();

	await page.keyboard.press('Enter');

	const dialog = page.getByRole('dialog');

	await expect(dialog).toBeVisible();
	await expect(
		dialog.getByText('Editing Image', {exact: true})
	).toBeVisible();

	await waitForModalSettled(page);

	await expectNoAxeViolations(page);

	// Shrink the crop from the right edge handle: 3 x Shift+ArrowLeft = -30px.

	await tabUntil(page, 'Crop handle: right edge');

	for (let i = 0; i < 3; i++) {
		await page.keyboard.press('Shift+ArrowLeft');
	}

	const widthInput = page.locator('[id$="-crop-width"]');

	await expect(widthInput).toHaveValue('4002');

	// The live region reports the crop geometry.

	await expect(page.locator('.editor-announcer')).toContainText('width 4002');

	// Precise crop through the numeric panel.

	await tabUntil(page, 'crop-width');
	await page.keyboard.press('ControlOrMeta+a');
	await page.keyboard.type('800');
	await page.keyboard.press('Enter');

	await expect(widthInput).toHaveValue('800');

	// Ratio preset from the select, keyboard only (letter typeahead).

	await tabUntil(page, 'crop-ratio-select');
	await page.locator('[id$="-crop-ratio-select"]').press('o');

	await expect(page.locator('[id$="-crop-ratio-select"]')).toHaveValue('original');
	await expect(widthInput).toHaveValue('4032');

	// Undo everything back to the initial crop. Each discrete arrow press
	// was its own undoable step, so the three 10px nudges undo one by one.

	await page.keyboard.press('ControlOrMeta+z');
	await expect(widthInput).toHaveValue('800');

	await page.keyboard.press('ControlOrMeta+z');
	await expect(widthInput).toHaveValue('4002');

	for (const width of ['4012', '4022', '4032']) {
		await page.keyboard.press('ControlOrMeta+z');
		await expect(widthInput).toHaveValue(width);
	}

	// Redo one step.

	await page.keyboard.press('ControlOrMeta+Shift+z');
	await expect(widthInput).toHaveValue('4022');

	// Zoom from the workspace with the keyboard and hear the result.

	await tabUntil(page, 'Image workspace');
	await page.keyboard.press('+');

	await expect(page.locator('.editor-announcer')).toContainText('Zoom');

	// Save downloads the export and closes the editor.

	await tabUntil(page, 'Save');

	const downloadPromise = page.waitForEvent('download');

	await page.keyboard.press('Enter');

	const download = await downloadPromise;

	expect(download.suggestedFilename()).toBe('sample-edited.jpg');

	await expect(dialog).toBeHidden();

	// Focus returns to the control that opened the editor.

	await expect(sampleButton).toBeFocused();
});

test('recenter fills the view with the crop', async ({page}) => {
	await page.goto('/');

	await page.getByRole('button', {name: 'Edit sample image'}).click();
	await waitForModalSettled(page);

	// A small crop, far from the center of the image.

	for (const [id, value] of [
		['crop-width', '400'],
		['crop-height', '260'],
		['crop-x', '900'],
		['crop-y', '500'],
	]) {
		await page.locator(`[id$="-${id}"]`).fill(value);
		await page.locator(`[id$="-${id}"]`).press('Enter');
	}

	await page.locator('.crop-recenter').click();

	await expect(page.locator('.editor-announcer')).toContainText('Crop centered');

	const framing = await page.evaluate(() => {
		const workspace = document.querySelector('.editor-workspace')!;
		const box = workspace.getBoundingClientRect();
		const crop = document
			.querySelector('.crop-border')!
			.getBoundingClientRect();

		// Against what can be seen, which is the client area: the
		// workspace scrolls on both axes at all times, so its box also
		// covers the scrollbar gutters.

		const view = {
			height: workspace.clientHeight,
			width: workspace.clientWidth,
			x: box.x,
			y: box.y,
		};

		return {
			dx: Math.abs(crop.x + crop.width / 2 - view.x - view.width / 2),
			dy: Math.abs(crop.y + crop.height / 2 - view.y - view.height / 2),
			fill: Math.max(crop.width / view.width, crop.height / view.height),
		};
	});

	// Centered within a pixel, and zoomed in until it fills the view.

	expect(framing.dx).toBeLessThanOrEqual(2);
	expect(framing.dy).toBeLessThanOrEqual(2);
	expect(framing.fill).toBeGreaterThan(0.9);
});

test('escape cancels the editor and restores focus', async ({page}) => {
	await page.goto('/');

	// The demonstration page opens with a colour scheme switch, so the
	// sample button is not the first stop: tab to it by name.

	await page.keyboard.press('Tab');
	await page.keyboard.press('Tab');
	await page.keyboard.press('Enter');

	await expect(page.getByRole('dialog')).toBeVisible();

	await waitForModalSettled(page);

	await page.keyboard.press('Escape');

	await expect(page.getByRole('dialog')).toBeHidden();
	await expect(
		page.getByRole('button', {name: 'Edit sample image'})
	).toBeFocused();
});

test('a crop field never shows a value that was refused', async ({page}) => {
	await page.goto('/');

	await page.getByRole('button', {name: 'Edit sample image'}).click();
	await waitForModalSettled(page);

	const x = page.locator('[id$="-crop-x"]');
	const width = page.locator('[id$="-crop-width"]');

	// The crop is as wide as the image, so it cannot also start at 200.
	// It used to keep showing 200 until some other field changed the crop,
	// which read as the value resetting itself later on.

	await x.fill('200');
	await width.click();

	await expect(x).toHaveValue('0');
	await expect(page.locator('.editor-announcer')).toContainText(
		'X position stays at 0'
	);

	// With room for it, the same value is accepted and stays put.

	await width.fill('1000');
	await width.press('Enter');

	await x.fill('200');
	await x.press('Enter');

	await expect(x).toHaveValue('200');

	await page.locator('[id$="-crop-height"]').fill('600');
	await page.locator('[id$="-crop-height"]').press('Enter');

	await expect(x).toHaveValue('200');
	await expect(width).toHaveValue('1000');
});

test('the locked crop offers corners only, and they keep the ratio', async ({
	page,
}) => {
	await page.goto('/');

	await page.getByRole('button', {name: 'Edit sample image'}).click();
	await waitForModalSettled(page);

	const handles = () =>
		page
			.locator('.crop-handle')
			.evaluateAll((nodes) =>
				nodes.map((node) => node.getAttribute('aria-label'))
			);

	expect(await handles()).toHaveLength(8);

	await page.getByLabel('Lock aspect ratio').click();

	await expect(page.locator('.editor-announcer')).toContainText('Aspect ratio locked');

	// Stretching one axis is what the lock forbids, so the side handles
	// are not offered at all.

	const locked = await handles();

	expect(locked).toHaveLength(4);
	expect(locked.every((name) => name?.includes('corner'))).toBe(true);

	const size = () =>
		page.evaluate(() => ({
			height: Number(
				(document.querySelector('[id$="-crop-height"]') as HTMLInputElement)
					.value
			),
			width: Number(
				(document.querySelector('[id$="-crop-width"]') as HTMLInputElement)
					.value
			),
		}));

	const before = await size();

	// And a corner drag keeps the proportions without asking for Shift.

	const corner = page.getByRole('button', {
		name: 'Crop handle: bottom right corner',
	});

	await corner.hover();

	const box = (await corner.boundingBox())!;

	await page.mouse.down();
	await page.mouse.move(box.x - 180, box.y - 30, {steps: 8});
	await page.mouse.up();

	const after = await size();

	expect(after.width).toBeLessThan(before.width);
	expect(after.width / after.height).toBeCloseTo(
		before.width / before.height,
		2
	);
});
