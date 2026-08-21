/**
 * SPDX-FileCopyrightText: (c) 2026 Liferay, Inc. https://liferay.com
 * SPDX-License-Identifier: LGPL-2.1-or-later OR LicenseRef-Liferay-DXP-EULA-2.0.0-2023-06
 */

import {Page, expect, test} from '@playwright/test';
import {openEditor} from './helpers';

/**
 * The view keys, which read as the view menu of any editor: fit, actual
 * size, and the region being worked on. None of them touches the edit, so
 * none of them belongs in the history.
 */

function zoomPercent(page: Page): Promise<number> {
	return page
		.locator('.editor-stage')
		.evaluate((stage) =>
			Math.round(
				(Number(stage.getAttribute('width')) /
					Number(stage.getAttribute('viewBox')?.split(' ')[2])) *
					100
			)
		);
}

test('0 fits, 1 goes to actual size, 2 frames the crop', async ({page}) => {
	await openEditor(page);

	// A crop smaller than the image, so framing it means something.

	for (const [field, value] of [
		['width', '500'],
		['height', '400'],
		['x', '600'],
		['y', '500'],
	]) {
		await page.locator(`[id$="-crop-${field}"]`).fill(value);
		await page.locator(`[id$="-crop-${field}"]`).press('Enter');
	}

	const status = page.locator('.editor-announcer');

	await page.locator('.editor-workspace').focus();

	await page.keyboard.press('1');

	expect(await zoomPercent(page)).toBe(100);
	await expect(status).toContainText('Zoom 100%');

	await page.keyboard.press('0');

	expect(await zoomPercent(page)).toBeLessThan(100);

	// Framing the crop zooms further in than fitting the whole image.

	await page.keyboard.press('2');

	await expect(status).toContainText('Crop centered in the view');

	expect(await zoomPercent(page)).toBeGreaterThan(100);

	// A view change is not an edit: the last undoable thing is still the
	// crop that was typed above.

	await page.getByRole('button', {name: 'Undo'}).click();

	await expect(status).toContainText('Undo crop change');
});

test('framing the crop lands on the same view from any zoom', async ({
	page,
}) => {
	await openEditor(page);

	for (const [field, value] of [
		['width', '500'],
		['height', '400'],
		['x', '600'],
		['y', '500'],
	]) {
		await page.locator(`[id$="-crop-${field}"]`).fill(value);
		await page.locator(`[id$="-crop-${field}"]`).press('Enter');
	}

	await page.locator('.editor-workspace').focus();

	// Coming from the fitted view.

	await page.keyboard.press('0');
	await page.keyboard.press('2');

	const fromFit = await zoomPercent(page);

	// And coming from actual size. The workspace scrolls on both axes at
	// all times so that its viewport does not change size as a result of
	// the zoom being measured for, which is what used to make these two
	// disagree and needed a second press to settle.

	await page.keyboard.press('1');
	await page.keyboard.press('2');

	expect(await zoomPercent(page)).toBe(fromFit);

	// Pressing it again changes nothing, because the first press was right.

	await page.keyboard.press('2');

	expect(await zoomPercent(page)).toBe(fromFit);
});

test('the add text dialog closes with Escape too', async ({page}) => {
	await openEditor(page);

	const trigger = page.getByRole('button', {exact: true, name: 'Add text'});

	await trigger.click();

	await expect(page.locator('.modal').last()).toHaveCSS('opacity', '1');

	// Its keyDown shield lets this one key through for the same reason the
	// shortcuts dialog does.

	await page.keyboard.press('Escape');

	await expect(page.getByRole('dialog')).toHaveCount(1);
	await expect(trigger).toBeFocused();
});

test('the shortcuts dialog closes with Escape', async ({page}) => {
	await openEditor(page);

	const trigger = page.getByRole('button', {name: 'Keyboard shortcuts'});

	await trigger.click();

	await expect(page.getByRole('dialog')).toHaveCount(2);

	// Settled, not mid-fade: Clay decides which dialog Escape closes from
	// its own stack, and the stack is only right once the second modal has
	// finished arriving.

	await expect(page.locator('.modal').last()).toHaveCSS('opacity', '1');

	// The dialog shields the editor behind it from Esc and the undo keys,
	// which is exactly why it has to answer this one itself.

	await page.keyboard.press('Escape');

	await expect(page.getByRole('dialog')).toHaveCount(1);

	// And the editor is still there, with focus back on the trigger.

	await expect(trigger).toBeFocused();
});
