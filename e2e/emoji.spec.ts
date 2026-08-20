/**
 * SPDX-FileCopyrightText: (c) 2026 Liferay, Inc. https://liferay.com
 * SPDX-License-Identifier: LGPL-2.1-or-later OR LicenseRef-Liferay-DXP-EULA-2.0.0-2023-06
 */

import AxeBuilder from '@axe-core/playwright';
import {Page, expect, test} from '@playwright/test';

/**
 * The emoji picker: the whole Unicode set as characters, drawn by the
 * platform's own font, offered as a curated page of commons and reached in
 * full through the search. No artwork is bundled, which is the point.
 */

async function openEditor(page: Page) {
	await page.goto('/');

	await page.getByRole('button', {name: 'Edit sample image'}).click();

	await expect(page.locator('.modal')).toHaveCSS('opacity', '1');
}

test('opens on a curated page and reaches everything by search', async ({
	page,
}) => {
	await openEditor(page);

	await page.getByRole('button', {exact: true, name: 'Add emoji'}).click();

	// The commons, not the inventory: a bounded page of whole rows, and
	// the hint says how far the search reaches.

	const cells = page.locator('.editor-emoji-cell');

	const shown = await cells.count();

	expect(shown).toBeLessThan(200);
	expect(shown % 8).toBe(0);

	await expect(page.locator('.editor-emoji-count')).toContainText(
		/Search to reach all \d+/
	);

	// Unicode capitalises many names ("flag: Spain"): the search must not
	// care, and the accessible name is Unicode's own.

	await page.getByLabel('Search emoji').fill('spain');

	await expect(cells).toHaveCount(1);
	await expect(cells.first()).toHaveAccessibleName('flag: Spain');

	// While the search narrows and empties, the popover holds one box:
	// re-alignment mid-typing is what made the earlier build unusable.

	const before = (await page
		.locator('.dropdown-menu.show')
		.boundingBox())!;

	for (const query of ['zzzz', 'face', '']) {
		await page.getByLabel('Search emoji').fill(query);

		const after = (await page
			.locator('.dropdown-menu.show')
			.boundingBox())!;

		expect(after).toEqual(before);
	}

	expect(
		(
			await new AxeBuilder({page}).disableRules(['region']).analyze()
		).violations
	).toEqual([]);
});

test('an emoji lands as its own layer, sized but never coloured', async ({
	page,
}) => {
	await openEditor(page);

	await page.getByRole('button', {exact: true, name: 'Add emoji'}).click();

	await page.getByLabel('Search emoji').fill('party popper');

	await page.locator('.editor-emoji-cell').first().click();

	const status = page.locator('.editor-announcer');

	await expect(status).toContainText('party popper added');

	// Focus lands on the stage node, named by Unicode.

	const hit = page.locator('.editor-workspace .overlay-hit');

	await expect(hit).toBeFocused();
	await expect(hit).toHaveAccessibleName('party popper');

	// The layer row leads with the glyph itself.

	await expect(page.locator('.editor-layer-glyph')).toHaveText('🎉');

	// Size is offered; colour and font are the platform's, so they are
	// not.

	await expect(page.getByLabel('Size', {exact: true})).toBeVisible();
	await expect(page.getByLabel('Color', {exact: true})).toHaveCount(0);
	await expect(page.getByLabel('Font Family')).toHaveCount(0);

	// Scaling is one number, and the glyph follows it.

	const size = page.getByLabel('Size', {exact: true});

	await size.fill('300');
	await size.press('Enter');

	await expect(
		page.locator('.editor-stage text[text-anchor="middle"]')
	).toHaveAttribute('font-size', '300');

	expect(
		(
			await new AxeBuilder({page}).include('.modal-content').analyze()
		).violations
	).toEqual([]);
});

test('the picker works from the keyboard alone', async ({page}) => {
	await openEditor(page);

	const trigger = page.getByRole('button', {exact: true, name: 'Add emoji'});

	await trigger.focus();

	// Down opens the picker with the search focused; Down again enters
	// the grid; the arrows walk it in two dimensions; Enter places.

	await page.keyboard.press('ArrowDown');

	await expect(page.getByLabel('Search emoji')).toBeFocused();

	await page.keyboard.press('ArrowDown');

	await expect(page.locator('.editor-emoji-cell').first()).toBeFocused();

	await page.keyboard.press('ArrowRight');
	await page.keyboard.press('ArrowDown');

	// Up from the top row returns to the search rather than escaping.

	await page.keyboard.press('ArrowUp');
	await page.keyboard.press('ArrowUp');

	await expect(page.getByLabel('Search emoji')).toBeFocused();

	await page.keyboard.press('ArrowDown');
	await page.keyboard.press('Enter');

	await expect(page.locator('.editor-announcer')).toContainText('added');
});
