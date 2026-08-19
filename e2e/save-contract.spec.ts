/**
 * SPDX-FileCopyrightText: (c) 2026 Liferay, Inc. https://liferay.com
 * SPDX-License-Identifier: LGPL-2.1-or-later OR LicenseRef-Liferay-DXP-EULA-2.0.0-2023-06
 */

import {Page, expect, test} from '@playwright/test';

/**
 * AIE-003: saving is a contract with the host, not a download. The demo
 * shell passes an adapter, and the URL bends that adapter so the failure
 * and the slow path can be exercised deterministically.
 */

async function openEditor(page: Page, search = '') {
	await page.goto(`/${search}`);

	await page.getByRole('button', {name: 'Edit sample image'}).click();

	await expect(page.locator('.modal')).toHaveCSS('opacity', '1');
}

test('a rejected save keeps the editor open and says why', async ({page}) => {
	await openEditor(page, '?save=fail');

	await page.getByRole('button', {exact: true, name: 'Save'}).click();

	// The failure is visible, not only announced, and nothing closed.

	const alert = page.getByRole('alert');

	await expect(alert).toContainText('Saving failed');
	await expect(page.getByRole('dialog')).toHaveCount(1);

	// The editor is usable again: the save can be retried.

	await expect(
		page.getByRole('button', {exact: true, name: 'Save'})
	).toBeEnabled();
});

test('a slow save disables the exits while it runs, then closes', async ({
	page,
}) => {
	await openEditor(page, '?save=slow');

	const download = page.waitForEvent('download');

	await page.getByRole('button', {exact: true, name: 'Save'}).click();

	// While the promise is pending, both buttons hold still: no second
	// save, no cancel racing the commit.

	const savingButton = page.getByRole('button', {
		exact: true,
		name: 'Saving…',
	});

	await expect(savingButton).toBeDisabled();
	await expect(
		page.getByRole('button', {exact: true, name: 'Cancel'})
	).toBeDisabled();

	// The adapter settles: the download happens and the editor closes.

	expect((await download).suggestedFilename()).toContain('edited');

	await expect(page.getByRole('dialog')).toHaveCount(0);
});
