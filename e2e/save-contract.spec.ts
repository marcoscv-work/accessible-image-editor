/**
 * SPDX-FileCopyrightText: (c) 2026 Liferay, Inc. https://liferay.com
 * SPDX-License-Identifier: LGPL-2.1-or-later OR LicenseRef-Liferay-DXP-EULA-2.0.0-2023-06
 */

import {expect, test} from '@playwright/test';
import {openEditor} from './helpers';

/**
 * AIE-003: saving is a contract with the host, not a download. The demo
 * shell passes an adapter, and the URL bends that adapter so the failure
 * and the slow path can be exercised deterministically.
 */

test('a rejected save keeps the editor open and says why', async ({page}) => {
	await openEditor(page, {search: '?save=fail'});

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

test('a slow save freezes the surface while it runs, then closes', async ({
	page,
}) => {
	await openEditor(page, {search: '?save=slow'});

	// An edit before saving, so there is something an in-flight undo
	// could corrupt.

	const brightness = page.locator('[id$="-adjust-brightness"]');

	await brightness.fill('5');
	await brightness.press('Enter');

	const download = page.waitForEvent('download');

	await page.getByRole('button', {exact: true, name: 'Save'}).click();

	// While the promise is pending the whole editable surface is inert:
	// the exported snapshot is what gets saved, so nothing may change
	// underneath it. (Inert also removes it from the accessibility
	// tree, which is why these are CSS assertions, and why the live
	// region announces the wait.)

	await expect(page.locator('.image-editor')).toHaveAttribute(
		'inert',
		''
	);
	await expect(page.locator('button:has-text("Saving")')).toBeDisabled();

	// A stray undo during the save changes nothing: the document-level
	// net is frozen too.

	await page.keyboard.press('ControlOrMeta+z');

	await expect(brightness).toHaveValue('5');

	// The adapter settles: the download happens and the editor closes.

	expect((await download).suggestedFilename()).toContain('edited');

	await expect(page.getByRole('dialog')).toHaveCount(0);
});
