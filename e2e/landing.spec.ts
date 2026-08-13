/**
 * SPDX-FileCopyrightText: (c) 2026 Liferay, Inc. https://liferay.com
 * SPDX-License-Identifier: LGPL-2.1-or-later OR LicenseRef-Liferay-DXP-EULA-2.0.0-2023-06
 */

import AxeBuilder from '@axe-core/playwright';
import {expect, test} from '@playwright/test';

/**
 * The landing screen: the step between reading about the editor and using
 * it. Dropping a file is an extra route, never the only one.
 */

test('opens an image dropped onto the page', async ({page}) => {
	await page.goto('/');

	const title = page.locator('.landing-dropzone-title');

	await expect(title).toHaveText('Drop an image here');
	await expect(page.locator('.landing-dropzone-hint')).toHaveText(
		'or anywhere on this page'
	);

	// A file hovering over the page turns the whole surface into the target.

	await page.evaluate(() => {
		document
			.querySelector('.landing')!
			.dispatchEvent(
				new DragEvent('dragover', {
					bubbles: true,
					dataTransfer: new DataTransfer(),
				})
			);
	});

	await expect(title).toHaveText('Drop to open it');
	await expect(page.locator('.landing')).toHaveClass(/is-dropping/);

	await page.evaluate(async () => {
		const response = await fetch(
			document.querySelector<HTMLImageElement>('.landing-preview img')!
				.src
		);

		const transfer = new DataTransfer();

		transfer.items.add(
			new File([await response.blob()], 'dropped.jpg', {
				type: 'image/jpeg',
			})
		);

		document.querySelector('.landing')!.dispatchEvent(
			new DragEvent('drop', {
				bubbles: true,
				dataTransfer: transfer,
			})
		);
	});

	await expect(page.locator('.editor-workspace')).toBeVisible();
});

test('the landing screen is clean at 320 pixels', async ({page}) => {
	await page.setViewportSize({height: 640, width: 320});
	await page.goto('/');

	const overflow = await page.evaluate(() => ({
		doc: document.documentElement.scrollWidth,
		view: window.innerWidth,
	}));

	expect(overflow.doc).toBeLessThanOrEqual(overflow.view);

	// Both routes into the editor stay reachable.

	await expect(page.getByRole('button', {name: 'Edit sample image'})).toBeVisible();
	await expect(
		page.getByRole('button', {name: 'Open an image from your device'})
	).toBeVisible();

	const results = await new AxeBuilder({page}).analyze();

	expect(results.violations).toEqual([]);

	// The zone is an affordance, not a second tab stop for the same action:
	// the button above is the route that never needs a drag.

	const stops = await page.evaluate(
		() =>
			document.querySelectorAll(
				'.landing button, .landing [tabindex="0"], .landing a'
			).length
	);

	expect(stops).toBe(2);
});
