/**
 * SPDX-FileCopyrightText: (c) 2026 Liferay, Inc. https://liferay.com
 * SPDX-License-Identifier: LGPL-2.1-or-later OR LicenseRef-Liferay-DXP-EULA-2.0.0-2023-06
 */

import AxeBuilder from '@axe-core/playwright';
import {expect, test} from '@playwright/test';

import {tabUntil} from './helpers';

/**
 * Keyboard-only annotation journey: add an emoji and a text overlay, move
 * them as focusable SVG nodes, pick a filter preset, manage layers in the
 * listbox, and save with everything composited into the export.
 */

test('keyboard-only annotation journey', async ({page}) => {
	await page.goto('/');

	// The demonstration page opens with a colour scheme switch, so the
	// sample button is not the first stop: tab to it by name.

	await page.keyboard.press('Tab');
	await page.keyboard.press('Tab');
	await page.keyboard.press('Enter');

	await expect(page.locator('.modal')).toHaveCSS('opacity', '1');

	const status = page.locator('.editor-announcer');

	// Add an emoji from the panel.

	// The arrows walk the annotate group as one sequence: enter at Add
	// text and step past the shape, redaction and picture tools to the
	// emoji picker, which the down arrow opens onto its search field.

	await tabUntil(page, 'Add text');

	for (let step = 0; step < 5; step++) {
		await page.keyboard.press('ArrowRight');
	}

	await page.keyboard.press('ArrowDown');

	await expect(page.getByLabel('Search emoji')).toBeFocused();

	// Typed in full because the search ranks by Unicode's order and a
	// prefix like "star" surfaces "star-struck" first.

	await page.keyboard.type('party popper');
	await page.keyboard.press('ArrowDown');
	await page.keyboard.press('Enter');

	await expect(status).toContainText('party popper added');

	// The emoji is a focusable node in the workspace; nudge it right.

	// Focus lands on the inserted emoji automatically.

	await expect(
		page.locator('.editor-workspace .overlay-hit')
	).toBeFocused();

	await page.keyboard.press('Shift+ArrowRight');

	await expect(status).toContainText('party popper moved to x 2026');

	// Add a text overlay through the dialog.

	// Tab re-enters the panel at the last used control (the emoji
	// picker), and the arrows walk back to Add text.

	await tabUntil(page, 'Add emoji');

	for (let step = 0; step < 5; step++) {
		await page.keyboard.press('ArrowLeft');
	}

	await page.keyboard.press('Enter');

	await expect(page.getByRole('dialog').nth(1)).toBeVisible();

	await tabUntil(page, 'text');
	await page.keyboard.type('Hello');
	await page.keyboard.press('Enter');

	await expect(status).toContainText('Text: Hello added');

	// Revealing the layers panel must scroll the sidebar only: the modal
	// shell itself never scrolls, or the header and the action bar would
	// be pushed out of view.

	await expect(page.locator('.modal-title')).toBeVisible();
	await expect(page.locator('.editor-bottom-bar')).toBeVisible();
	expect(
		await page.evaluate(
			() =>
				[...document.querySelectorAll('*')].filter(
					(element) =>
						element.scrollTop > 0 &&
						!element.classList.contains('editor-sidebar') &&
						!element.classList.contains('editor-workspace')
				).length
		)
	).toBe(0);

	// Pick a filter preset with the arrow keys inside the radio group.
	// Focus is asserted before the arrow fires: under CPU contention the
	// tab walk can report the id a beat before focus has settled, and an
	// arrow pressed into the void selects nothing.

	await tabUntil(page, 'filter-none');

	await expect(page.locator('[id$="-filter-none"]')).toBeFocused();

	await page.keyboard.press('ArrowDown');

	await expect(page.locator('[id$="-filter-grayscale"]')).toBeChecked();
	await expect(status).toContainText('Filter set to Grayscale');
	await expect(page.locator('.editor-workspace image')).toHaveAttribute(
		'filter',
		/url\(#.*-preview-filter\)/
	);

	// Layers: two entries, topmost first; delete the selected one.

	const layerNames = page.locator('.editor-layer-name');

	await expect(layerNames).toHaveCount(2);
	await expect(layerNames.first()).toHaveText('Text: Hello');

	await tabUntil(page, 'Text: Hello');
	await page.keyboard.press('Delete');

	await expect(layerNames).toHaveCount(1);
	await expect(status).toContainText('Text: Hello removed');

	// Everything still passes an axe scan.

	const results = await new AxeBuilder({page}).analyze();

	expect(results.violations).toEqual([]);

	// Save composites the remaining overlay into the export.

	await tabUntil(page, 'Save');

	const downloadPromise = page.waitForEvent('download');

	await page.keyboard.press('Enter');

	const download = await downloadPromise;

	expect(download.suggestedFilename()).toBe('sample-edited.jpg');
});

test('Enter reaches the properties even while Layers is collapsed', async ({
	page,
}) => {
	await page.goto('/');

	await page.getByRole('button', {name: 'Edit sample image'}).click();
	await expect(page.locator('.modal')).toHaveCSS('opacity', '1');

	await page.getByRole('button', {exact: true, name: 'Add shape'}).click();
	await page
		.locator('.dropdown-menu.show')
		.getByRole('button', {name: 'Rectangle'})
		.click();

	// Fold the section the properties live in: a collapsed section keeps
	// them at display none, where focusing is a silent no-op, so the key
	// has to open the disclosure as part of honouring the jump.

	const layers = page.getByRole('button', {exact: true, name: 'Layers'});

	await layers.click();

	await expect(layers).toHaveAttribute('aria-expanded', 'false');

	await page.locator('.overlay-hit').first().focus();
	await page.keyboard.press('Enter');

	await expect(layers).toHaveAttribute('aria-expanded', 'true');
	await expect(page.locator('[id$="-layer-prop-color"]')).toBeFocused();
});
