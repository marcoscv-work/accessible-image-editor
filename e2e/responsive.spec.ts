/**
 * SPDX-FileCopyrightText: (c) 2026 Liferay, Inc. https://liferay.com
 * SPDX-License-Identifier: LGPL-2.1-or-later OR LicenseRef-Liferay-DXP-EULA-2.0.0-2023-06
 */

import AxeBuilder from '@axe-core/playwright';
import {expect, test} from '@playwright/test';

/**
 * In the stacked layout the sidebar sits under the workspace, and the
 * filter cards become one swipeable row with paging arrows.
 */

test.use({viewport: {height: 820, width: 400}});

test('the filter gallery becomes a carousel when stacked', async ({page}) => {
	await page.goto('/');

	await page.getByRole('button', {name: 'Edit sample image'}).click();
	await expect(page.locator('.modal')).toHaveCSS('opacity', '1');

	// Collapse the sections above so the gallery is in view.

	for (const name of ['Crop and rotation', 'Adjustments']) {
		await page.getByRole('button', {exact: true, name}).click();
	}

	const scroller = page.locator('.editor-filter-grid');

	await scroller.scrollIntoViewIfNeeded();

	const metrics = await scroller.evaluate((element) => ({
		clientWidth: element.clientWidth,
		scrollWidth: element.scrollWidth,
	}));

	// One row, wider than the viewport: it scrolls sideways.

	expect(metrics.scrollWidth).toBeGreaterThan(metrics.clientWidth * 2);

	const rows = await scroller.evaluate((element) => {
		const tops = [...element.children].map(
			(child) => child.getBoundingClientRect().top
		);

		return new Set(tops).size;
	});

	expect(rows).toBe(1);

	// The right arrow pages forward.

	await page.locator('.editor-filter-arrow').nth(1).click();
	await page.waitForTimeout(600);

	const scrolled = await scroller.evaluate((element) => element.scrollLeft);

	expect(scrolled).toBeGreaterThan(0);

	// The arrows are a pointer affordance: out of the accessibility tree
	// and out of the tab order, because the radio group already moves with
	// the arrow keys.

	const arrows = page.locator('.editor-filter-arrow');

	for (const arrow of await arrows.all()) {
		await expect(arrow).toHaveAttribute('aria-hidden', 'true');
		await expect(arrow).toHaveAttribute('tabindex', '-1');
	}

	// Keyboard selection still works, and scrolls the card into view.

	await page.locator('#filter-none').focus();
	await page.keyboard.press('ArrowRight');

	await expect(page.locator('#filter-grayscale')).toBeChecked();

	const results = await new AxeBuilder({page}).analyze();

	expect(results.violations).toEqual([]);
});

test('the actions keep the trailing edge when the bar wraps', async ({
	page,
}) => {
	await page.goto('/');

	await page.getByRole('button', {name: 'Edit sample image'}).click();
	await expect(page.locator('.modal')).toHaveCSS('opacity', '1');

	// Narrow enough that Cancel and Save wrap onto a line of their own,
	// which is where space-between used to strand them on the left.

	for (const width of [320, 360, 400]) {
		await page.setViewportSize({height: 820, width});

		const offset = await page
			.locator('.editor-bottom-bar')
			.evaluate((bar) => {
				const save = bar.querySelector('.btn-primary');

				return Math.round(
					bar.getBoundingClientRect().right -
						save.getBoundingClientRect().right
				);
			});

		// Only the bar's own padding separates Save from the trailing edge.

		expect(offset).toBeLessThanOrEqual(16);
	}
});
