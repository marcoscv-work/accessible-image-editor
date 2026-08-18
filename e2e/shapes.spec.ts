/**
 * SPDX-FileCopyrightText: (c) 2026 Liferay, Inc. https://liferay.com
 * SPDX-License-Identifier: LGPL-2.1-or-later OR LicenseRef-Liferay-DXP-EULA-2.0.0-2023-06
 */

import AxeBuilder from '@axe-core/playwright';
import {Locator, Page, expect, test} from '@playwright/test';

/**
 * The shapes sit behind one menu rather than a button each, and the arrow
 * is the one annotation that is not a box: it is placed by its two ends,
 * by pointer or by field, and it has a head that can be solid or open.
 */

async function openEditor(page: Page) {
	await page.goto('/');

	await page.getByRole('button', {name: 'Edit sample image'}).click();

	await expect(page.locator('.modal')).toHaveCSS('opacity', '1');
}

async function addShape(page: Page, shape: string) {
	await page.getByRole('button', {exact: true, name: 'Add shape'}).click();

	await page.locator('.dropdown-menu.show').getByRole('button', {name: shape}).click();
}

/**
 * Where the arrow's shaft begins and ends, in stage units.
 */
function shaft(page: Page) {
	return page
		.locator('.editor-stage line[stroke-linecap="round"]')
		.evaluate((line: SVGLineElement) => ({
			x1: Math.round(line.x1.baseVal.value),
			x2: Math.round(line.x2.baseVal.value),
			y1: Math.round(line.y1.baseVal.value),
			y2: Math.round(line.y2.baseVal.value),
		}));
}

test('the shape menu offers the four shapes and adds each one', async ({
	page,
}) => {
	await openEditor(page);

	const trigger = page.getByRole('button', {exact: true, name: 'Add shape'});

	await trigger.click();

	await expect(trigger).toHaveAttribute('aria-expanded', 'true');

	// Drawings rather than words, so the names are on the cells: what the
	// pointer gets as a tooltip is what the screen reader gets as a name.

	const cells = page.locator('.dropdown-menu.show .editor-menu-cell');

	expect(
		await cells.evaluateAll((all) =>
			all.map((cell) => cell.getAttribute('aria-label'))
		)
	).toEqual(['Rectangle', 'Square', 'Circle', 'Arrow']);

	// Every cell clears the 24 pixel floor (WCAG 2.2, 2.5.8).

	const box = (await cells.first().boundingBox())!;

	expect(box.height).toBeGreaterThanOrEqual(24);
	expect(box.width).toBeGreaterThanOrEqual(24);

	// Scanned open, because that is a state the user sits in. The region
	// rule is set aside for this one scan: Clay portals the menu to a
	// body-level div that no landmark contains, the same way it does with
	// tooltips, which is a best-practice finding rather than a barrier.

	expect(
		(await new AxeBuilder({page}).disableRules(['region']).analyze())
			.violations
	).toEqual([]);

	await page.locator('.dropdown-menu.show').getByRole('button', {name: 'Square'}).click();

	// A square arrives square. It is a rectangle underneath, which is what
	// it becomes the moment someone stretches one side.

	const square = page.locator('.editor-stage rect[fill]:not([class])');

	expect(await square.getAttribute('width')).toBe(
		await square.getAttribute('height')
	);

	await addShape(page, 'Circle');

	await expect(page.locator('.editor-stage ellipse')).toHaveCount(1);

	await addShape(page, 'Arrow');

	// On the stage, since the word also names the menu entry and the
	// layer row.

	await expect(
		page.locator('.editor-stage [aria-label="Arrow"]')
	).toHaveCount(1);
});

/**
 * Drags a handle by a screen-space delta. The box is measured after
 * hovering, never before: hover is what waits for the element to hold
 * still, and the stage is fitted asynchronously, so a box read a moment
 * too early describes a stage that no longer exists.
 */
async function dragBy(handle: Locator, dx: number, dy: number) {
	await handle.hover();

	const box = (await handle.boundingBox())!;

	const fromX = box.x + box.width / 2;
	const fromY = box.y + box.height / 2;

	await handle.page().mouse.down();
	await handle.page().mouse.move(fromX + dx, fromY + dy, {steps: 12});
	await handle.page().mouse.up();
}

test('an arrow is aimed by dragging either end', async ({page}) => {
	await openEditor(page);

	await addShape(page, 'Arrow');

	const layer = page.getByRole('group', {name: 'Selected layer: Arrow'});

	const ends = () =>
		Promise.all([
			layer.getByLabel('X position', {exact: true}).inputValue(),
			layer.getByLabel('Y position', {exact: true}).inputValue(),
			layer.getByLabel('Tip X position', {exact: true}).inputValue(),
			layer.getByLabel('Tip Y position', {exact: true}).inputValue(),
		]);

	const [tailX, tailY, tipX, tipY] = await ends();

	// Two round handles and no corners: an arrow has no box to stretch.

	await expect(page.locator('circle.object-handle')).toHaveCount(2);
	await expect(page.locator('rect.object-handle')).toHaveCount(0);

	await dragBy(page.locator('circle.object-handle').nth(1), 0, -140);

	const afterTip = await ends();

	// The tail did not travel with the hand, which is the whole point of
	// dragging one end.

	expect(afterTip[0]).toBe(tailX);
	expect(afterTip[1]).toBe(tailY);

	expect(afterTip[2]).toBe(tipX);
	expect(Number(afterTip[3])).toBeLessThan(Number(tipY));

	// And the same the other way around: the tail moves, the tip holds.

	await dragBy(page.locator('circle.object-handle').first(), -100, 0);

	const afterTail = await ends();

	expect(Number(afterTail[0])).toBeLessThan(Number(tailX));
	expect(afterTail[1]).toBe(tailY);

	expect(afterTail.slice(2)).toEqual(afterTip.slice(2));
});

test('an arrow is aimed, styled and weighted without a pointer', async ({
	page,
}) => {
	await openEditor(page);

	await addShape(page, 'Arrow');

	const status = page.getByRole('status');

	// Rotation is not offered, because two ends already say where an
	// arrow points.

	await expect(page.getByLabel('Rotation', {exact: true})).toHaveCount(0);

	const before = await shaft(page);

	const tipY = page.getByLabel('Tip Y position', {exact: true});

	await tipY.fill('180');
	await tipY.press('Enter');

	await expect(status).toContainText('Arrow updated');

	const aimed = await shaft(page);

	expect(aimed.y1).toBe(before.y1);
	expect(aimed.y2).toBeLessThan(before.y2);

	// The open head trades the solid triangle for two barbs, and the
	// shaft then runs the whole way to the point.

	await expect(page.locator('.editor-stage polygon')).toHaveCount(1);

	await page.getByLabel('Arrow head', {exact: true}).selectOption('open');

	await expect(page.locator('.editor-stage polygon')).toHaveCount(0);
	await expect(
		page.locator('.editor-stage path[stroke-linejoin="round"]')
	).toHaveCount(1);

	expect((await shaft(page)).y2).toBe(180);

	// Weight drives the stroke and the head together.

	const thickness = page.getByLabel('Thickness', {exact: true});

	await thickness.fill('24');
	await thickness.press('Enter');

	await expect(
		page.locator('.editor-stage line[stroke-linecap="round"]')
	).toHaveAttribute('stroke-width', '24');

	expect((await new AxeBuilder({page}).analyze()).violations).toEqual([]);
});

test('both menus open and commit from the keyboard alone', async ({page}) => {
	await openEditor(page);

	const shapes = page.getByRole('button', {exact: true, name: 'Add shape'});

	await shapes.focus();

	// Down opens the menu and lands on its first cell, rather than walking
	// on to the next button in the panel.

	await page.keyboard.press('ArrowDown');

	const cells = page.locator('.dropdown-menu.show .editor-menu-cell');

	await expect(cells.first()).toBeFocused();

	// The grid moves in two dimensions: right along the row, and down by a
	// whole row rather than by one cell.

	await page.keyboard.press('ArrowRight');

	await expect(cells.nth(1)).toBeFocused();

	await page.keyboard.press('ArrowLeft');

	await page.keyboard.press('Enter');

	await expect(page.getByRole('status')).toContainText('Rectangle added');

	// The horizontal arrows still walk the panel itself.

	await shapes.focus();
	await page.keyboard.press('ArrowRight');

	await expect(
		page.getByRole('button', {exact: true, name: 'Draw'})
	).toBeFocused();
});
