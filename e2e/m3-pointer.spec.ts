/**
 * SPDX-FileCopyrightText: (c) 2026 Liferay, Inc. https://liferay.com
 * SPDX-License-Identifier: LGPL-2.1-or-later OR LicenseRef-Liferay-DXP-EULA-2.0.0-2023-06
 */

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

	// The first annotation reveals the Layers section; the sidebar
	// scrolls so it enters the view.

	await expect(page.locator('#layers-panel-title')).toBeInViewport();

	// Drag the rectangle 60px right, 40px down.

	const hit = page
		.locator('.editor-workspace')
		.getByRole('button', {exact: true, name: 'Rectangle'});
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

	// Enter on the layer name jumps to the element on the stage.

	await page.locator('.editor-layer-name').first().click();
	await page.keyboard.press('Enter');

	await expect(
		page.locator('.editor-workspace .overlay-hit')
	).toBeFocused();

	// On-stage manipulation: dragging a corner handle resizes
	// proportionally around the center. Re-select the rectangle first
	// (the earlier crop drag cleared the selection).

	await page.locator('.editor-layer-name').first().click();
	await expect(page.locator('.object-handle').first()).toBeVisible();

	const widthBefore = Number(
		await page.locator('#layer-prop-width').inputValue()
	);
	const heightBefore = Number(
		await page.locator('#layer-prop-height').inputValue()
	);

	const seHandle = page.locator('.object-handle').nth(2);
	const seBox = (await seHandle.boundingBox())!;

	await page.mouse.move(
		seBox.x + seBox.width / 2,
		seBox.y + seBox.height / 2
	);
	await page.mouse.down();
	await page.mouse.move(seBox.x + seBox.width / 2 + 60, seBox.y + seBox.height / 2 + 60, {
		steps: 4,
	});
	await page.mouse.up();

	const widthAfter = Number(
		await page.locator('#layer-prop-width').inputValue()
	);
	const heightAfter = Number(
		await page.locator('#layer-prop-height').inputValue()
	);

	expect(widthAfter).toBeGreaterThan(widthBefore);

	// Proportional: both sides scaled by the same factor (within
	// rounding).

	expect(
		Math.abs(widthAfter / widthBefore - heightAfter / heightBefore)
	).toBeLessThan(0.05);

	// Edge handles stretch one dimension freely: dragging the right edge
	// grows the width and leaves the height untouched.

	const stretchWidthBefore = Number(
		await page.locator('#layer-prop-width').inputValue()
	);
	const stretchHeightBefore = Number(
		await page.locator('#layer-prop-height').inputValue()
	);

	// Handles render corners first (4), then edges: n, e, s, w.

	const eastHandle = page.locator('.object-handle').nth(5);
	const eastBox = (await eastHandle.boundingBox())!;

	await page.mouse.move(
		eastBox.x + eastBox.width / 2,
		eastBox.y + eastBox.height / 2
	);
	await page.mouse.down();
	await page.mouse.move(
		eastBox.x + eastBox.width / 2 + 50,
		eastBox.y + eastBox.height / 2,
		{steps: 4}
	);
	await page.mouse.up();

	expect(
		Number(await page.locator('#layer-prop-width').inputValue())
	).toBeGreaterThan(stretchWidthBefore);
	expect(
		Number(await page.locator('#layer-prop-height').inputValue())
	).toBe(stretchHeightBefore);

	// The rotate handle spins the annotation.

	const rotateHandle = page.locator('.object-handle-rotate');
	const rotateBox = (await rotateHandle.boundingBox())!;

	await page.mouse.move(
		rotateBox.x + rotateBox.width / 2,
		rotateBox.y + rotateBox.height / 2
	);
	await page.mouse.down();
	await page.mouse.move(rotateBox.x + 120, rotateBox.y + 90, {steps: 4});
	await page.mouse.up();

	const rotation = Number(
		await page.locator('#layer-prop-rotation').inputValue()
	);

	expect(rotation).not.toBe(0);
});
