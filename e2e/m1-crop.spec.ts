import AxeBuilder from '@axe-core/playwright';
import {Page, expect, test} from '@playwright/test';

/**
 * The whole journey is keyboard-only: no mouse events are synthesized at
 * any point. Movement between controls uses Tab, activation uses Enter or
 * Space, and spatial edits use the arrow keys.
 */

async function tabUntil(page: Page, ariaLabel: string): Promise<void> {
	for (let i = 0; i < 40; i++) {
		const label = await page.evaluate(() => {
			const active = document.activeElement;

			return (
				active?.getAttribute('aria-label') ||
				active?.id ||
				active?.textContent?.trim() ||
				''
			);
		});

		if (label === ariaLabel) {
			return;
		}

		await page.keyboard.press('Tab');
	}

	throw new Error(`Never reached element labelled "${ariaLabel}"`);
}

async function expectNoAxeViolations(page: Page): Promise<void> {
	const results = await new AxeBuilder({page}).analyze();

	expect(results.violations).toEqual([]);
}

test('keyboard-only crop journey', async ({page}) => {
	await page.goto('/');

	await expectNoAxeViolations(page);

	// Open the sample image from the keyboard.

	await page.keyboard.press('Tab');

	const sampleButton = page.getByRole('button', {name: 'Edit sample image'});

	await expect(sampleButton).toBeFocused();

	await page.keyboard.press('Enter');

	const dialog = page.getByRole('dialog');

	await expect(dialog).toBeVisible();
	await expect(
		dialog.getByText('Editing Image', {exact: true})
	).toBeVisible();

	await expectNoAxeViolations(page);

	// Shrink the crop from the right edge handle: 3 x Shift+ArrowLeft = -30px.

	await tabUntil(page, 'Crop handle: right edge');

	for (let i = 0; i < 3; i++) {
		await page.keyboard.press('Shift+ArrowLeft');
	}

	const widthInput = page.getByLabel('Width');

	await expect(widthInput).toHaveValue('1570');

	// The live region reports the crop geometry.

	await expect(page.getByRole('status')).toContainText('width 1570');

	// Precise crop through the numeric panel.

	await tabUntil(page, 'crop-width');
	await page.keyboard.press('ControlOrMeta+a');
	await page.keyboard.type('800');
	await page.keyboard.press('Enter');

	await expect(widthInput).toHaveValue('800');

	// Ratio preset from the select, keyboard only.

	await tabUntil(page, 'crop-ratio-select');
	await page.getByLabel('Ratio:').press('ArrowDown');

	await expect(page.getByLabel('Ratio:')).not.toHaveValue('custom');

	// Undo everything back to the initial crop.

	await page.keyboard.press('ControlOrMeta+z');
	await expect(widthInput).toHaveValue('800');

	await page.keyboard.press('ControlOrMeta+z');
	await expect(widthInput).toHaveValue('1570');

	await page.keyboard.press('ControlOrMeta+z');
	await expect(widthInput).toHaveValue('1600');

	// Redo one step.

	await page.keyboard.press('ControlOrMeta+Shift+z');
	await expect(widthInput).toHaveValue('1570');

	// Zoom from the workspace with the keyboard and hear the result.

	await tabUntil(page, 'Image workspace');
	await page.keyboard.press('+');

	await expect(page.getByRole('status')).toContainText('Zoom');

	// Save downloads the export and closes the editor.

	await tabUntil(page, 'Save');

	const downloadPromise = page.waitForEvent('download');

	await page.keyboard.press('Enter');

	const download = await downloadPromise;

	expect(download.suggestedFilename()).toBe('sample-edited.jpg');

	await expect(dialog).toBeHidden();

	// Focus returns to the control that opened the editor.

	await expect(sampleButton).toBeFocused();
});

test('escape cancels the editor and restores focus', async ({page}) => {
	await page.goto('/');

	await page.keyboard.press('Tab');
	await page.keyboard.press('Enter');

	await expect(page.getByRole('dialog')).toBeVisible();

	await page.keyboard.press('Escape');

	await expect(page.getByRole('dialog')).toBeHidden();
	await expect(
		page.getByRole('button', {name: 'Edit sample image'})
	).toBeFocused();
});
