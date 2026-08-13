/**
 * SPDX-FileCopyrightText: (c) 2026 Liferay, Inc. https://liferay.com
 * SPDX-License-Identifier: LGPL-2.1-or-later OR LicenseRef-Liferay-DXP-EULA-2.0.0-2023-06
 */

import AxeBuilder from '@axe-core/playwright';
import {Locator, Page, expect, test} from '@playwright/test';

/**
 * In the stacked layout the sidebar sits under the workspace, and the
 * tracks that would otherwise wrap (the filter cards, the sticker picker)
 * become one swipeable row with paging arrows.
 */

test.use({viewport: {height: 820, width: 400}});

async function openEditor(page: Page) {
	await page.goto('/');

	await page.getByRole('button', {name: 'Edit sample image'}).click();
	await expect(page.locator('.modal')).toHaveCSS('opacity', '1');
}

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

	const carousel = page.locator('.editor-carousel:has(.editor-filter-grid)');

	await expectSwipeableRow(
		carousel.locator('.editor-filter-grid'),
		carousel.locator('.editor-carousel-arrow')
	);

	// Keyboard selection still works, and scrolls the card into view.

	await page.locator('#filter-none').focus();
	await page.keyboard.press('ArrowRight');

	await expect(page.locator('#filter-grayscale')).toBeChecked();

	const results = await new AxeBuilder({page}).analyze();

	expect(results.violations).toEqual([]);
});

test('the sticker picker becomes a carousel when stacked', async ({page}) => {
	await openEditor(page);

	for (const name of ['Crop and rotation', 'Adjustments', 'Filters']) {
		await page.getByRole('button', {exact: true, name}).click();
	}

	const carousel = page.locator(
		'.editor-carousel:has(.editor-sticker-picker)'
	);

	await expectSwipeableRow(
		carousel.locator('.editor-sticker-picker'),
		carousel.locator('.editor-carousel-arrow')
	);

	// Scanned before anything is focused: Clay renders its tooltips into a
	// body-level div that no landmark contains, so a showing tooltip trips
	// axe's region rule on its own.

	const results = await new AxeBuilder({page}).analyze();

	expect(results.violations).toEqual([]);

	// The picker holds a tab stop of its own, so Tab reaches the track even
	// while the roving index sits on a tool.

	const stickers = carousel.locator('.editor-sticker-picker .btn');
	const first = stickers.first();

	await expect(first).toHaveAttribute('tabindex', '0');

	// The arrows still walk the whole annotate group, tools and stickers
	// alike, even though the stickers now sit inside the track.

	await first.focus();
	await page.keyboard.press('ArrowRight');

	await expect(stickers.nth(1)).toBeFocused();
	await expect(first).toHaveAttribute('tabindex', '-1');
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
