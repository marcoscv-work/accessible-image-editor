/**
 * SPDX-FileCopyrightText: (c) 2026 Liferay, Inc. https://liferay.com
 * SPDX-License-Identifier: LGPL-2.1-or-later OR LicenseRef-Liferay-DXP-EULA-2.0.0-2023-06
 */

import {expect, test} from '@playwright/test';

/**
 * Flipping mirrors the picture and everything placed on it.
 */

test('flips the image horizontally, and back', async ({page}) => {
	await page.goto('/');

	await page.getByRole('button', {name: 'Edit sample image'}).click();
	await expect(page.locator('.modal')).toHaveCSS('opacity', '1');
	await page.waitForTimeout(600);

	const stage = page.locator('.editor-workspace image').first();

	await expect(stage).not.toHaveAttribute('transform', /scale\(-1/);

	// A redaction has to travel with the picture: left where it was would
	// mean uncovering exactly what it hides.

	await page.getByRole('button', {exact: true, name: 'Add redaction'}).click();
	await page.waitForTimeout(300);

	// Off centre on purpose: an annotation sitting in the middle mirrors
	// onto itself and would prove nothing.

	const positionX = page.locator('[id$="-layer-prop-x"]');

	await positionX.fill('200');
	await positionX.press('Enter');
	await page.waitForTimeout(300);

	const before = await positionX.inputValue();

	await page.getByRole('button', {name: 'Flip horizontally'}).click();
	await page.waitForTimeout(400);

	await expect(page.locator('.editor-announcer')).toContainText(
		'Image flipped horizontally'
	);

	const flipped = await page
		.locator('.editor-workspace image')
		.first()
		.evaluate((element) => element.parentElement!.getAttribute('transform'));

	expect(flipped).toContain('scale(-1 1)');

	const after = await positionX.inputValue();

	expect(Number(after)).not.toBe(Number(before));

	// Flipping again is the identity, and undo covers it in one step.

	await page.getByRole('button', {name: 'Flip horizontally'}).click();
	await page.waitForTimeout(400);

	expect(await positionX.inputValue()).toBe(before);

	await page.getByRole('button', {name: 'Undo'}).click();
	await page.waitForTimeout(400);

	expect(Number(await positionX.inputValue())).toBe(Number(after));
});
