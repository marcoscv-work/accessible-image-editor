import {expect, test} from '@playwright/test';

/**
 * Pointer-parity checks (WCAG 2.5.x): the same annotation operations the
 * keyboard journeys prove must also work with a plain single-pointer
 * drag, and annotations must win the pointer contest against the
 * whole-area crop-move surface underneath them.
 */

test('rectangle drags with the pointer and stays editable', async ({page}) => {
	await page.goto('/');

	await page.getByRole('button', {name: 'Edit sample image'}).click();
	await expect(page.locator('.modal')).toHaveCSS('opacity', '1');

	await page.getByRole('button', {name: 'Add rectangle'}).click();

	const status = page.getByRole('status');

	await expect(status).toContainText('Rectangle added');

	// Drag the rectangle 60px right, 40px down.

	const hit = page.getByRole('button', {exact: true, name: 'Rectangle'});
	const box = (await hit.boundingBox())!;

	const startX = box.x + box.width / 2;
	const startY = box.y + box.height / 2;

	await page.mouse.move(startX, startY);
	await page.mouse.down();
	await page.mouse.move(startX + 60, startY + 40, {steps: 5});
	await page.mouse.up();

	await expect(status).toContainText('Rectangle moved to');

	// Dragging outside the rectangle still moves the crop area.

	await page.mouse.move(box.x - 60, box.y - 60);
	await page.mouse.down();
	await page.mouse.move(box.x - 90, box.y - 80, {steps: 3});
	await page.mouse.up();

	await expect(status).toContainText('Crop set to');

	// Properties: recolor and resize the selected layer.

	await page.locator('#layer-prop-color').fill('#00ff00');
	await page.locator('#layer-prop-color').blur();

	await expect(status).toContainText('Rectangle updated');
	await expect(
		page.locator('.editor-workspace rect[fill="#00ff00"]')
	).toHaveCount(1);

	await page.locator('#layer-prop-width').fill('500');
	await page.locator('#layer-prop-width').press('Enter');

	await expect(
		page.locator('.editor-workspace rect[fill="#00ff00"]')
	).toHaveAttribute('width', '500');
});
