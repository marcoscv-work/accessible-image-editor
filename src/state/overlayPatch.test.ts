/**
 * SPDX-FileCopyrightText: (c) 2026 Liferay, Inc. https://liferay.com
 * SPDX-License-Identifier: LGPL-2.1-or-later OR LicenseRef-Liferay-DXP-EULA-2.0.0-2023-06
 */

import {describe, expect, it} from 'vitest';

import {patchFor, patchOverlay} from './overlayPatch';
import {ShapeOverlay, TextOverlay} from './types';

const SHAPE: ShapeOverlay = {
	color: '#0b5fff',
	height: 100,
	id: 'shape-1',
	kind: 'shape',
	width: 300,
	x: 100,
	y: 200,
};

const TEXT: TextOverlay = {
	color: '#ffffff',
	fontFamily: 'sans-serif',
	fontSize: 50,
	id: 'text-1',
	kind: 'text',
	text: 'Hello',
	x: 400,
	y: 500,
};

describe('patchOverlay', () => {
	it('applies keys the kind owns', () => {
		expect(patchOverlay(SHAPE, {width: 500, x: 50})).toMatchObject({
			width: 500,
			x: 50,
			y: 200,
		});
	});

	it('drops keys another kind owns', () => {
		const next = patchOverlay(SHAPE, {
			points: [0, 0, 10, 10],
			text: 'smuggled',
		} as never);

		expect(next).toBe(SHAPE);
	});

	it('never lets a non-finite number into the state', () => {
		const next = patchOverlay(SHAPE, {x: Number.NaN, y: 300});

		expect(next.x).toBe(100);
		expect(next.y).toBe(300);

		expect(patchOverlay(SHAPE, {width: Infinity})).toBe(SHAPE);
	});

	it('clamps the domains: opacity to its range, sizes to one', () => {
		expect(patchOverlay(SHAPE, {opacity: 250})).toMatchObject({
			opacity: 100,
		});
		expect(patchOverlay(SHAPE, {opacity: -3})).toMatchObject({opacity: 0});
		expect(patchOverlay(TEXT, {fontSize: 0})).toMatchObject({fontSize: 1});
		expect(patchOverlay(SHAPE, {height: -20})).toMatchObject({height: 1});
	});

	it('rejects values outside an enum', () => {
		expect(patchOverlay(SHAPE, {rotation: '45' as never})).toBe(SHAPE);

		const arrow = patchOverlay(
			{
				color: '#000000',
				dx: 10,
				dy: 10,
				head: 'filled',
				id: 'arrow-1',
				kind: 'arrow',
				thickness: 4,
				x: 0,
				y: 0,
			},
			{head: 'banana' as never}
		);

		expect(arrow).toMatchObject({head: 'filled'});
	});

	it('clears an optional key on an explicit undefined', () => {
		const seeded = patchOverlay(SHAPE, {sketchSeed: 42}) as ShapeOverlay;

		expect(seeded.sketchSeed).toBe(42);

		// Back to the clean style: the seed leaves the state entirely.

		const cleaned = patchOverlay(seeded, {
			sketchSeed: undefined,
		}) as ShapeOverlay;

		expect('sketchSeed' in cleaned && cleaned.sketchSeed).toBeUndefined();

		// But a position cannot be cleared, only moved.

		expect(patchOverlay(SHAPE, {x: undefined})).toBe(SHAPE);
	});

	it('rejects an odd point list and keeps the border unsigned', () => {
		const stroke = patchOverlay(
			{
				color: '#000000',
				id: 'stroke-1',
				kind: 'stroke',
				points: [0, 0, 10, 10],
				smooth: true,
				width: 4,
				x: 0,
				y: 0,
			},
			{points: [0, 0, 10]}
		);

		// An odd-length array is not a point list.

		expect(stroke).toMatchObject({points: [0, 0, 10, 10]});

		// A border can be absent (zero), never inverted.

		expect(patchOverlay(SHAPE, {borderWidth: -4})).toMatchObject({
			borderWidth: 0,
		});
	});

	it('types the patch against the kind at narrowed call sites', () => {
		const typed = patchFor(SHAPE);

		expect(typed({width: 500})).toEqual({width: 500});

		// @ts-expect-error a shape has no `text`; the compiler is the
		// first line of defence, the whitelist the second.

		typed({text: 'nope'});
	});

	it('returns the same reference when nothing changes', () => {
		expect(patchOverlay(SHAPE, {width: 300, x: 100})).toBe(SHAPE);
		expect(patchOverlay(SHAPE, {})).toBe(SHAPE);
	});
});
