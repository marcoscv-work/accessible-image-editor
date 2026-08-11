import AxeBuilder from '@axe-core/playwright';
import {Page, expect, test} from '@playwright/test';

/**
 * Keyboard-only annotation journey: add a sticker and a text overlay, move
 * them as focusable SVG nodes, pick a filter preset, manage layers in the
 * listbox, and save with everything composited into the export.
 */

async function tabUntil(page: Page, target: string): Promise<void> {
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

		if (label === target) {
			return;
		}

		await page.keyboard.press('Tab');
	}

	throw new Error(`Never reached element labelled "${target}"`);
}

test('keyboard-only annotation journey', async ({page}) => {
	await page.goto('/');

	await page.keyboard.press('Tab');
	await page.keyboard.press('Enter');

	await expect(page.locator('.modal')).toHaveCSS('opacity', '1');

	const status = page.getByRole('status');

	// Add a star sticker from the panel.

	await tabUntil(page, 'Add star sticker');
	await page.keyboard.press('Enter');

	await expect(status).toContainText('Star sticker added');

	// The sticker is a focusable node in the workspace; nudge it right.

	// Focus lands on the inserted sticker automatically.

	await expect(
		page.locator('.editor-workspace .overlay-hit')
	).toBeFocused();

	await page.keyboard.press('Shift+ArrowRight');

	await expect(status).toContainText('Star sticker moved to x 810');

	// Add a text overlay through the dialog.

	await tabUntil(page, 'Add text');
	await page.keyboard.press('Enter');

	await expect(page.getByRole('dialog').nth(1)).toBeVisible();

	await tabUntil(page, 'text-content');
	await page.keyboard.type('Hello');
	await page.keyboard.press('Enter');

	await expect(status).toContainText('Text: Hello added');

	// Pick a filter preset with the arrow keys inside the radio group.

	await tabUntil(page, 'filter-none');
	await page.keyboard.press('ArrowDown');

	await expect(page.locator('#filter-grayscale')).toBeChecked();
	await expect(status).toContainText('Filter set to Grayscale');
	await expect(page.locator('.editor-workspace image')).toHaveAttribute(
		'filter',
		'url(#preview-filter)'
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
