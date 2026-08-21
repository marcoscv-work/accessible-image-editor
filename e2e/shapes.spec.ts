/**
 * SPDX-FileCopyrightText: (c) 2026 Liferay, Inc. https://liferay.com
 * SPDX-License-Identifier: LGPL-2.1-or-later OR LicenseRef-Liferay-DXP-EULA-2.0.0-2023-06
 */

import AxeBuilder from '@axe-core/playwright';
import {Locator, Page, expect, test} from '@playwright/test';

import {openEditor} from './helpers';

/**
 * The shapes sit behind one menu rather than a button each, and the arrow
 * is the one annotation that is not a box: it is placed by its two ends,
 * by pointer or by field, and it has a head that can be solid or open.
 */

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

	const status = page.locator('.editor-announcer');

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

	await expect(page.locator('.editor-announcer')).toContainText('Rectangle added');

	// The horizontal arrows still walk the panel itself.

	await shapes.focus();
	await page.keyboard.press('ArrowRight');

	await expect(
		page.getByRole('button', {exact: true, name: 'Draw'})
	).toBeFocused();
});

test('arrow steps preview live and land as one undo entry', async ({
	page,
}) => {
	await openEditor(page);

	await page.getByRole('button', {exact: true, name: 'Add shape'}).click();
	await page
		.locator('.dropdown-menu.show')
		.getByRole('button', {name: 'Rectangle'})
		.click();

	const stageWidth = () =>
		page
			.locator('.editor-workspace rect[fill="#0b5fff"]')
			.getAttribute('width')
			.then(Number);

	const before = await stageWidth();

	// Three steps, one of them large: the stage follows each one before
	// anything is committed. Polled, not read once: the keypress and
	// React's commit are not the same instant, and a one-shot read races
	// it under parallel workers.

	const width = page.locator('[id$="-layer-prop-width"]');

	await width.focus();
	await page.keyboard.press('ArrowUp');

	await expect.poll(stageWidth).toBe(before + 1);

	await page.keyboard.press('Shift+ArrowUp');
	await page.keyboard.press('ArrowUp');

	await expect.poll(stageWidth).toBe(before + 12);

	// Blur commits the whole run as a single history entry.

	await page.keyboard.press('Tab');

	await page.getByRole('button', {exact: true, name: 'Undo'}).click();

	await expect.poll(stageWidth).toBe(before);

	// The crop fields step through the same clamp. The default crop is
	// the whole image, so X genuinely cannot move yet: the step is
	// refused by geometry. Shrink the width first, and X gains room.

	const cropX = page.locator('[id$="-crop-x"]');

	await cropX.focus();
	await page.keyboard.press('Shift+ArrowUp');

	await expect(cropX).toHaveValue('0');

	await page.locator('[id$="-crop-width"]').focus();
	await page.keyboard.press('Shift+ArrowDown');

	await expect(page.locator('[id$="-crop-width"]')).toHaveValue('4022');

	await cropX.focus();
	await page.keyboard.press('Shift+ArrowUp');

	await expect(cropX).toHaveValue('10');
});

test('copy and paste clone the focused annotation, cascading', async ({
	page,
}) => {
	await openEditor(page);

	await page.getByRole('button', {exact: true, name: 'Add shape'}).click();
	await page
		.locator('.dropdown-menu.show')
		.getByRole('button', {name: 'Rectangle'})
		.click();

	const status = page.locator('.editor-announcer');
	const hits = page.locator('.editor-workspace .overlay-hit');

	// Copy on the focused node, paste from the workspace.

	await hits.first().focus();
	await page.keyboard.press('ControlOrMeta+c');

	await expect(status).toContainText('Rectangle copied');

	await page.keyboard.press('ControlOrMeta+v');

	await expect(status).toContainText('Rectangle pasted');
	await expect(hits).toHaveCount(2);

	// Focus lands on the paste, and a second paste cascades further
	// instead of stacking on the first.

	await expect(hits.nth(1)).toBeFocused();

	await page.keyboard.press('ControlOrMeta+v');

	await expect(hits).toHaveCount(3);

	const xs = await page
		.locator('.editor-workspace rect[fill="#0b5fff"]')
		.evaluateAll((nodes) =>
			nodes.map((node) => Number(node.getAttribute('x')))
		);

	expect(new Set(xs).size).toBe(3);

	// Each paste is one undo entry.

	await page.getByRole('button', {exact: true, name: 'Undo'}).click();

	await expect(hits).toHaveCount(2);
});

test('a shift-built group drags as one and undoes as one', async ({page}) => {
	await openEditor(page);

	await page.getByRole('button', {exact: true, name: 'Add shape'}).click();
	await page
		.locator('.dropdown-menu.show')
		.getByRole('button', {name: 'Rectangle'})
		.click();

	await page.getByRole('button', {exact: true, name: 'Add shape'}).click();
	await page
		.locator('.dropdown-menu.show')
		.getByRole('button', {name: 'Circle'})
		.click();

	const rectangle = page.locator(
		'.editor-workspace rect[fill]:not([class])'
	);
	const circle = page.locator('.editor-workspace ellipse');

	// Both spawn at the crop's centre; walk the circle aside first so
	// each hit target is its own.

	for (let step = 0; step < 8; step++) {
		await page.keyboard.press('Shift+ArrowDown');
	}

	const before = {
		circleX: Number(await circle.getAttribute('cx')),
		rectangleX: Number(await rectangle.getAttribute('x')),
	};

	// The circle arrived selected, so a single Shift+click on the
	// rectangle seeds the pair with it: selection plus Shift reads as
	// "these two together".

	const hits = page.locator('.editor-workspace .overlay-hit');

	await hits.first().click({modifiers: ['Shift'], position: {x: 12, y: 12}});

	await expect(page.locator('.editor-group-note')).toContainText(
		'2 annotations are grouped'
	);

	// While the group exists, no handles: it moves and does nothing else.

	await expect(page.locator('.object-handle')).toHaveCount(0);

	// Drag one member; the other travels with it.

	await hits.first().hover({position: {x: 12, y: 12}});
	await page.mouse.down();

	const box = (await hits.first().boundingBox())!;

	await page.mouse.move(box.x + 12 + 80, box.y + 12 + 40, {steps: 8});
	await page.mouse.up();

	await expect(page.locator('.editor-announcer')).toContainText(
		'2 annotations moved together'
	);

	const after = {
		circleX: Number(await circle.getAttribute('cx')),
		rectangleX: Number(await rectangle.getAttribute('x')),
	};

	expect(after.rectangleX - before.rectangleX).toBeGreaterThan(50);
	expect(after.circleX - before.circleX).toBe(
		after.rectangleX - before.rectangleX
	);

	// One undo returns both.

	await page.getByRole('button', {exact: true, name: 'Undo'}).click();

	expect(Number(await rectangle.getAttribute('x'))).toBe(before.rectangleX);
	expect(Number(await circle.getAttribute('cx'))).toBe(before.circleX);

	// While the group lives the properties yield to a note, and a plain
	// click outside the group dissolves it: a third thing selected next
	// to two rings must not look like three.

	await expect(page.getByText(/move and delete together/)).toBeVisible();

	await page.getByRole('button', {exact: true, name: 'Add shape'}).click();
	await page
		.locator('.dropdown-menu.show')
		.getByRole('button', {name: 'Square'})
		.click();

	await expect(page.getByText(/move and delete together/)).toHaveCount(0);
	await expect(page.getByText(/Selected layer/)).toBeVisible();

	// Deleting a member of a rebuilt group removes every member, and one
	// undo returns them all.

	const rebuiltHits = page.locator('.editor-workspace .overlay-hit');

	await rebuiltHits.first().click({modifiers: ['Shift'], position: {x: 8, y: 8}});

	await rebuiltHits.first().focus();
	await page.keyboard.press('Delete');

	await expect(rebuiltHits).toHaveCount(1);

	await page.getByRole('button', {exact: true, name: 'Undo'}).click();

	await expect(rebuiltHits).toHaveCount(3);

	// Exactly one ringed annotation remains: the newcomer. Which ring it
	// wears depends on how focus arrived, so both kinds are counted.

	expect(
		await page
			.locator(
				'.editor-stage .focus-ring-outer, .editor-stage .selection-ring'
			)
			.count()
	).toBeLessThanOrEqual(2);

	expect(
		await page.evaluate(
			() =>
				new Set(
					[...document.querySelectorAll(
						'.editor-stage .focus-ring-outer, .editor-stage .selection-ring'
					)].map((ring) => ring.closest('g'))
				).size
		)
	).toBe(1);
});

test('undo works immediately after a deletion, no click needed', async ({
	page,
}) => {
	await openEditor(page);

	await page.getByRole('button', {exact: true, name: 'Add redaction'}).click();

	const hits = page.locator('.editor-workspace .overlay-hit');

	await expect(hits).toHaveCount(1);

	// Delete from the stage and undo at once: the focus handover to the
	// workspace is what keeps the shortcut alive, since the focused node
	// just unmounted.

	await hits.first().focus();
	await page.keyboard.press('Delete');

	await expect(hits).toHaveCount(0);

	await page.keyboard.press('ControlOrMeta+z');

	await expect(hits).toHaveCount(1);

	// The same round trip from a layer row's Delete key.

	await page.locator('.editor-layer-name').first().focus();
	await page.keyboard.press('Delete');

	await expect(hits).toHaveCount(0);

	await page.keyboard.press('ControlOrMeta+z');

	await expect(hits).toHaveCount(1);
});
