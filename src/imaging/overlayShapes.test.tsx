/**
 * SPDX-FileCopyrightText: (c) 2026 Liferay, Inc. https://liferay.com
 * SPDX-License-Identifier: LGPL-2.1-or-later OR LicenseRef-Liferay-DXP-EULA-2.0.0-2023-06
 */

import {describe, expect, it} from 'vitest';

import {
	ArrowOverlay,
	EmojiOverlay,
	ImageOverlay,
	isBoxOverlay,
} from '../state/types';
import {
	arrowGeometry,
	mirrorOverlay,
	overlayBounds,
	overlayHitBox,
	overlayLabel,
	overlayRotation,
} from './overlayShapes';

const PICTURE: ImageOverlay = {
	description: 'Team badge',
	height: 40,
	id: 'image-1',
	kind: 'image',
	src: 'data:image/png;base64,AAAA',
	width: 80,
	x: 100,
	y: 50,
};

describe('an image annotation', () => {
	it('is one more box, so it stretches and mirrors like the rest', () => {
		expect(isBoxOverlay(PICTURE)).toBe(true);

		expect(overlayBounds(PICTURE)).toEqual({
			height: 40,
			width: 80,
			x: 100,
			y: 50,
		});

		// Mirrored inside a 1000 wide frame: 1000 - 100 - 80.

		expect(mirrorOverlay(PICTURE, 1000)).toMatchObject({x: 820});
	});

	it('is named by its description, which is what is read out', () => {
		expect(overlayLabel(PICTURE)).toBe('Team badge');
	});

	it('keeps a full size target when the picture is a small badge', () => {
		const stamp = {...PICTURE, height: 6, width: 6};

		// Painted at 6, hit at 24, centred on the same point (WCAG 2.5.8).

		expect(overlayHitBox(stamp, 24)).toEqual({
			height: 24,
			width: 24,
			x: 91,
			y: 41,
		});
	});
});

const ARROW: ArrowOverlay = {
	color: '#0b5fff',
	dx: 200,
	dy: -100,
	head: 'filled',
	id: 'arrow-1',
	kind: 'arrow',
	thickness: 6,
	x: 300,
	y: 400,
};

describe('an arrow', () => {
	it('is not a box, so it is placed by its ends rather than stretched', () => {
		expect(isBoxOverlay(ARROW)).toBe(false);

		// The box around both ends, grown by the stroke: the tip is up and
		// to the right of the tail, so the box starts at the tip's y.

		expect(overlayBounds(ARROW)).toEqual({
			height: 106,
			width: 206,
			x: 297,
			y: 297,
		});
	});

	it('has no rotation of its own, because its ends already aim it', () => {
		expect(overlayRotation(ARROW)).toBe(0);
	});

	it('keeps pointing at what it pointed at when the photo mirrors', () => {
		const mirrored = mirrorOverlay(ARROW, 1000) as ArrowOverlay;

		// The tail reflects and the vector flips, so the tip lands where
		// the tip's own reflection is: 1000 - 500.

		expect(mirrored.x).toBe(700);
		expect(mirrored.dx).toBe(-200);
		expect(mirrored.x + mirrored.dx).toBe(500);

		// Nothing happens vertically, which is what mirroring means.

		expect(mirrored.dy).toBe(ARROW.dy);
	});

	it('sizes its head from the stroke, and its shaft stops at the head', () => {
		const geometry = arrowGeometry(ARROW);

		expect(geometry.tipX).toBe(500);
		expect(geometry.tipY).toBe(300);

		// 3.2 times the stroke, and short of the tip by exactly that.

		expect(geometry.headLength).toBeCloseTo(19.2, 5);

		expect(
			Math.hypot(geometry.tipX - geometry.shaftX, geometry.tipY - geometry.shaftY)
		).toBeCloseTo(geometry.headLength, 5);

		// A thicker arrow grows its head with it.

		expect(arrowGeometry({...ARROW, thickness: 12}).headLength).toBeCloseTo(
			38.4,
			5
		);
	});

	it('will not let the head eat a short arrow', () => {
		// A third of the length is the ceiling, so a stubby arrow is still
		// a line with a head and not a bare triangle.

		const stub = arrowGeometry({...ARROW, dx: 30, dy: 0});

		expect(stub.headLength).toBeCloseTo(10, 5);
	});

	it('survives being given no length at all', () => {
		const degenerate = arrowGeometry({...ARROW, dx: 0, dy: 0});

		expect(degenerate.tipX).toBe(ARROW.x);
		expect(degenerate.headPoints).toBe('');
	});

	it('is named as an arrow', () => {
		expect(overlayLabel(ARROW)).toBe('Arrow');
	});
});

const EMOJI_OVERLAY: EmojiOverlay = {
	character: '🎉',
	id: 'emoji-1',
	kind: 'emoji',
	name: 'party popper',
	size: 120,
	x: 400,
	y: 300,
};

describe('an emoji annotation', () => {
	it('is a square centred on its point', () => {
		expect(isBoxOverlay(EMOJI_OVERLAY)).toBe(false);

		expect(overlayBounds(EMOJI_OVERLAY)).toEqual({
			height: 120,
			width: 120,
			x: 340,
			y: 240,
		});
	});

	it('is named by Unicode, not by us', () => {
		expect(overlayLabel(EMOJI_OVERLAY)).toBe('party popper');
	});

	it('mirrors by its point when the photograph flips', () => {
		expect(mirrorOverlay(EMOJI_OVERLAY, 1000)).toMatchObject({x: 600});
	});
});
