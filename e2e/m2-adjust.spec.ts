/**
 * SPDX-FileCopyrightText: (c) 2026 Liferay, Inc. https://liferay.com
 * SPDX-License-Identifier: LGPL-2.1-or-later OR LicenseRef-Liferay-DXP-EULA-2.0.0-2023-06
 */

import AxeBuilder from '@axe-core/playwright';
import {Page, expect, test} from '@playwright/test';

/**
 * Keyboard-only adjustment journey: sliders are operated with arrow keys,
 * commits are announced, the SVG color pipeline reacts, and the tone curve
 * (shadows/highlights, the deliberately hard adjustment) materializes as a
 * declarative table transfer function.
 */

async function tabUntil(page: Page, target: string): Promise<void> {
	for (let i = 0; i < 60; i++) {
		const label = await page.evaluate(() => {
			const active = document.activeElement;

			return (
				active?.getAttribute('aria-label') ||
				active?.id ||
				active?.textContent?.trim() ||
				''
			);
		});

		if (label === target || label.endsWith(`-${target}`)) {

			// Ids carry the editor's instance prefix; labels do not.

			return;
		}

		await page.keyboard.press('Tab');
	}

	throw new Error(`Never reached element labelled "${target}"`);
}

test('keyboard-only adjustments journey', async ({page}) => {
	await page.goto('/');

	// The demonstration page opens with a colour scheme switch, so the
	// sample button is not the first stop: tab to it by name.

	await page.keyboard.press('Tab');
	await page.keyboard.press('Tab');
	await page.keyboard.press('Enter');

	await expect(page.locator('.modal')).toHaveCSS('opacity', '1');

	const image = page.locator('.editor-workspace image');

	await expect(image).not.toHaveAttribute('filter', /.+/);

	// Brightness +5 with the arrow keys.

	await tabUntil(page, 'adjust-brightness');

	for (let i = 0; i < 5; i++) {
		await page.keyboard.press('ArrowRight');
	}

	await expect(page.locator('[id$="-adjust-brightness"]')).toHaveValue('5');
	await expect(image).toHaveAttribute('filter', /url\(#.*-preview-filter\)/);
	await expect(page.locator('.editor-announcer')).toContainText(
		'Brightness set to 5'
	);

	// Shadows engage the tone curve: a table transfer function per channel.

	await tabUntil(page, 'adjust-shadows');
	await page.keyboard.press('ArrowRight');

	await expect(
		page.locator('[id$="-preview-filter"] feFuncR[type="table"]')
	).toHaveAttribute('tableValues', /.+/);

	// The whole panel passes an axe scan with adjustments active.

	const results = await new AxeBuilder({page}).analyze();

	expect(results.violations).toEqual([]);

	// Reset all restores the identity pipeline.

	await tabUntil(page, 'Reset all');
	await page.keyboard.press('Enter');

	await expect(page.locator('[id$="-adjust-brightness"]')).toHaveValue('0');
	await expect(page.locator('[id$="-adjust-shadows"]')).toHaveValue('0');
	await expect(image).not.toHaveAttribute('filter', /.+/);
	await expect(page.locator('.editor-announcer')).toContainText(
		'All adjustments reset'
	);

	// Undo brings the adjustments back.

	await page.keyboard.press('ControlOrMeta+z');

	await expect(page.locator('[id$="-adjust-brightness"]')).toHaveValue('5');
	await expect(page.locator('[id$="-adjust-shadows"]')).toHaveValue('1');
});
