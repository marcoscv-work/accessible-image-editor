/**
 * SPDX-FileCopyrightText: (c) 2026 Liferay, Inc. https://liferay.com
 * SPDX-License-Identifier: LGPL-2.1-or-later OR LicenseRef-Liferay-DXP-EULA-2.0.0-2023-06
 */

import AxeBuilder from '@axe-core/playwright';
import {Locator, expect, test} from '@playwright/test';

import {openEditor} from './helpers';

/**
 * In the stacked layout the sidebar sits under the workspace, and the
 * tracks that would otherwise wrap (the filter cards, the frames) become
 * one swipeable row with paging arrows.
 */

test.use({viewport: {height: 820, width: 400}});

/**
 * One row, wider than the viewport, that the arrows page through.
 */
async function expectSwipeableRow(track: Locator, arrows: Locator) {
	await track.scrollIntoViewIfNeeded();

	const metrics = await track.evaluate((element) => ({
		clientWidth: element.clientWidth,
		rows: new Set(
			[...element.children].map(
				(child) => child.getBoundingClientRect().top
			)
		).size,
		scrollWidth: element.scrollWidth,
	}));

	expect(metrics.rows).toBe(1);
	expect(metrics.scrollWidth).toBeGreaterThan(metrics.clientWidth);

	await arrows.nth(1).click();
	await track.page().waitForTimeout(600);

	expect(await track.evaluate((element) => element.scrollLeft)).toBeGreaterThan(
		0
	);

	// The arrows are a pointer affordance: out of the accessibility tree
	// and out of the tab order, because the track is already keyboard
	// navigable and focusing a child scrolls it into view.

	for (const arrow of await arrows.all()) {
		await expect(arrow).toHaveAttribute('aria-hidden', 'true');
		await expect(arrow).toHaveAttribute('tabindex', '-1');
	}
}

test('the filter gallery becomes a carousel when stacked', async ({page}) => {
	await openEditor(page);

	// Collapse the sections above so the gallery is in view.

	for (const name of ['Crop and rotation', 'Adjustments']) {
		await page.getByRole('button', {exact: true, name}).click();
	}

	// Filters and frames share the gallery markup now, so say which one:
	// this test is about the filter cards.

	const carousel = page.locator(
		'.editor-panel:has([id$="-filters-panel-title"]) .editor-carousel'
	);

	await expectSwipeableRow(
		carousel.locator('.editor-preset-grid'),
		carousel.locator('.editor-carousel-arrow')
	);

	// Keyboard selection still works, and scrolls the card into view.

	await page.locator('[id$="-filter-none"]').focus();
	await page.keyboard.press('ArrowRight');

	await expect(page.locator('[id$="-filter-grayscale"]')).toBeChecked();

	const results = await new AxeBuilder({page}).analyze();

	expect(results.violations).toEqual([]);
});

test('the emoji picker opens and stays usable when stacked', async ({
	page,
}) => {
	await openEditor(page);

	for (const name of ['Crop and rotation', 'Adjustments', 'Filters']) {
		await page.getByRole('button', {exact: true, name}).click();
	}

	// Nineteen hundred characters behind one button: the grid fits the
	// narrow viewport, the cells hold the 24 pixel floor, and the popover
	// scrolls its grid rather than paging it.

	const trigger = page.getByRole('button', {exact: true, name: 'Add emoji'});

	await trigger.click();

	const grid = page.getByRole('grid', {name: 'Add emoji'});

	await expect(grid).toBeVisible();

	const gridBox = (await grid.boundingBox())!;
	const viewport = page.viewportSize()!;

	expect(gridBox.width).toBeLessThanOrEqual(viewport.width);

	const cell = (await page
		.locator('.editor-emoji-cell')
		.first()
		.boundingBox())!;

	expect(cell.height).toBeGreaterThanOrEqual(24);

	// Scanned with the picker open: this is the state the user is in. The
	// region rule is set aside, because Clay portals the popover to a
	// body-level div that no landmark contains, exactly as it does with
	// tooltips.

	const results = await new AxeBuilder({page})
		.disableRules(['region'])
		.analyze();

	expect(results.violations).toEqual([]);

	await page.getByLabel('Search emoji').fill('star');

	// By its exact name: the search ranks by Unicode's order, and
	// "star-struck" comes before "star".

	await page
		.locator('.dropdown-menu.show')
		.getByRole('button', {exact: true, name: 'star'})
		.click();

	// On the stage, since the name also belongs to the layer row it just
	// gained.

	await expect(
		page.locator('.editor-stage [aria-label="star"]')
	).toHaveCount(1);
});

test('reflows at 320 pixels, the 400% zoom equivalent', async ({page}) => {
	await page.setViewportSize({height: 512, width: 320});
	await openEditor(page);

	// 1.4.10 asks for no loss of content or function, and no scrolling in
	// two directions, at 320 CSS pixels wide.

	// Nothing may be clipped: the page must not scroll sideways, and the
	// containers that are not meant to scroll must hold their content. The
	// carousel tracks are excluded on purpose, since scrolling sideways is
	// exactly what they are for.

	const overflow = await page.evaluate(() => ({
		bar: document.querySelector('.editor-bottom-bar')!.scrollWidth,
		barWidth: document.querySelector('.editor-bottom-bar')!.clientWidth,
		doc: document.documentElement.scrollWidth,
		sidebar: document.querySelector('.editor-sidebar')!.scrollWidth,
		sidebarWidth: document.querySelector('.editor-sidebar')!.clientWidth,
		view: window.innerWidth,
	}));

	expect(overflow.doc).toBeLessThanOrEqual(overflow.view);
	expect(overflow.bar).toBeLessThanOrEqual(overflow.barWidth);
	expect(overflow.sidebar).toBeLessThanOrEqual(overflow.sidebarWidth);

	// Everything still there and operable: the stage, the panels, and the
	// actions that end the session.

	await expect(page.locator('.editor-workspace')).toBeVisible();
	await expect(page.getByRole('button', {name: 'Save'})).toBeVisible();

	for (const name of ['Crop and rotation', 'Adjustments', 'Filters']) {
		await expect(page.getByRole('button', {exact: true, name})).toBeVisible();
	}

	// A crop still commits from the numeric field, which is the route that
	// does not depend on dragging.

	const width = page.locator('[id$="-crop-width"]');

	await width.fill('600');
	await width.press('Enter');

	await expect(width).toHaveValue('600');

	const results = await new AxeBuilder({page}).analyze();

	expect(results.violations).toEqual([]);
});

test('survives text set to 200%', async ({page}) => {
	await openEditor(page);

	// 1.4.4 is about text scaling on its own, not page zoom.

	await page.evaluate(() => {
		document.documentElement.style.fontSize = '32px';
	});
	await page.waitForTimeout(300);

	const overflow = await page.evaluate(() => ({
		doc: document.documentElement.scrollWidth,
		view: window.innerWidth,
	}));

	expect(overflow.doc).toBeLessThanOrEqual(overflow.view);

	await expect(page.getByRole('button', {name: 'Save'})).toBeVisible();
});

test('the actions keep the trailing edge when the bar wraps', async ({
	page,
}) => {
	await openEditor(page);

	// Narrow enough that Cancel and Save wrap onto a line of their own,
	// which is where space-between used to strand them on the left.

	for (const width of [320, 360, 400]) {
		await page.setViewportSize({height: 820, width});

		const offset = await page
			.locator('.editor-bottom-bar')
			.evaluate((bar) => {
				const save = bar.querySelector('.btn-primary')!;

				return Math.round(
					bar.getBoundingClientRect().right -
						save.getBoundingClientRect().right
				);
			});

		// Only the bar's own padding separates Save from the trailing edge.

		expect(offset).toBeLessThanOrEqual(16);
	}
});
