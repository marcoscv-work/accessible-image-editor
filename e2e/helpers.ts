/**
 * SPDX-FileCopyrightText: (c) 2026 Liferay, Inc. https://liferay.com
 * SPDX-License-Identifier: LGPL-2.1-or-later OR LicenseRef-Liferay-DXP-EULA-2.0.0-2023-06
 */

import {Page, expect} from '@playwright/test';

/**
 * The one place that knows how an editor gets opened. Today that is the
 * demo shell: the landing page, its sample button, and query-string
 * knobs the demo adapter reads (`?save=slow`, `?filters=...`). In the
 * portal it becomes login plus a page holding the sample portlet, and
 * every spec keeps working because they only ever call this.
 */
export async function openEditor(
	page: Page,
	{search = ''}: {search?: string} = {}
): Promise<void> {
	await page.goto(`/${search}`);

	await page.getByRole('button', {name: 'Edit sample image'}).click();

	// Clay's modal fades in; interacting mid-transition hits a moving
	// target.

	await expect(page.locator('.modal')).toHaveCSS('opacity', '1');
}

/**
 * Walks Tab until the focused element answers to the given name: its
 * aria-label, its id (instance-prefixed ids match by suffix), or its
 * text. Fails loudly after 80 steps rather than looping forever.
 */
export async function tabUntil(page: Page, target: string): Promise<void> {
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

		if (label === target || label.endsWith(`-${target}`)) {
			return;
		}

		await page.keyboard.press('Tab');
	}

	throw new Error(`Never reached element labelled "${target}"`);
}

/**
 * The editor's polite live region, the voice every announcement-based
 * assertion listens to.
 */
export function announcer(page: Page) {
	return page.locator('.editor-announcer');
}
